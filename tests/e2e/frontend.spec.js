/**
 * Front end: timeline and list views, ranges and navigation, filters, shareable
 * URLs, the details popover, keyboard use, phones, no-JavaScript rendering and
 * accessibility. Runs logged out, against the "Events" page from
 * bin/demo-content.php, whose dates are relative to today.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const AxeBuilder = require( '@axe-core/playwright' ).default;

const PAGE = '/events-demo/';
const B = '.wp-block-events-timeline-timeline';
const TOTAL = 13;

test.use( { storageState: { cookies: [], origins: [] } } );

const block = ( page ) => page.locator( B ).first();
const label = ( page ) => block( page ).locator( `${ B }__range-label` );
const status = ( page ) => block( page ).locator( `${ B }__status` );
const bars = ( page ) => block( page ).locator( `${ B }__bar:not([hidden])` );
const rows = ( page ) => block( page ).locator( `${ B }__row:not([hidden])` );
const listItems = ( page ) =>
	block( page ).locator( `${ B }__item:not([hidden])` );
const button = ( page, name ) =>
	block( page ).getByRole( 'button', { name, exact: true } );

// The demo site runs in UTC, like the test runner.
const monthLabel = new Intl.DateTimeFormat( 'en-US', {
	timeZone: 'UTC',
	month: 'long',
	year: 'numeric',
} ).format( new Date() );

test.describe( 'Timeline view', () => {
	test( 'opens on this month, with a row per calendar', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		await expect( label( page ) ).toHaveText( monthLabel );
		await expect( button( page, 'Month' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( rows( page ).locator( `${ B }__row-label` ) ).toHaveText(
			[ 'Community', 'Pro Circuit', 'Studio' ]
		);
		await expect( status( page ) ).toContainText( `in ${ monthLabel }` );
	} );

	test( 'marks the event happening now, and the current time', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		const live = block( page ).locator( `${ B }__bar.is-happening-now` );
		await expect( live ).toBeVisible();
		await expect( live ).toContainText( 'Weekend Ladder Marathon' );
		await expect( block( page ).locator( `${ B }__now` ) ).toBeVisible();
	} );

	test( 'stacks overlapping events in separate lanes', async ( { page } ) => {
		await page.goto( PAGE );
		const lane = ( title ) =>
			block( page )
				.locator( `${ B }__bar`, { hasText: title } )
				.evaluate( ( el ) =>
					el.style.getPropertyValue( '--evtl-lane' ).trim()
				);
		expect( await lane( 'Winter Invitational' ) ).not.toBe(
			await lane( 'Qualifier Week 2' )
		);
	} );

	test( 'every visible bar sits inside the window', async ( { page } ) => {
		await page.goto( PAGE );
		for ( const range of [ 'Week', 'Month', 'Year' ] ) {
			await button( page, range ).click();
			const boxes = await bars( page ).evaluateAll( ( els ) =>
				els.map( ( el ) => [
					parseFloat( el.style.left ),
					parseFloat( el.style.width ),
				] )
			);
			for ( const [ left, width ] of boxes ) {
				expect( left ).toBeGreaterThanOrEqual( 0 );
				expect( left + width ).toBeLessThanOrEqual( 100.001 );
			}
		}
	} );

	test( 'switches ranges and steps through time', async ( { page } ) => {
		await page.goto( PAGE );
		await button( page, 'Week' ).click();
		await expect( page ).toHaveURL( /[?&]range=week/ );
		const thisWeek = await label( page ).textContent();
		expect( thisWeek ).toMatch( / – / );
		await expect( block( page ).locator( `${ B }__tick` ) ).toHaveCount(
			7
		);

		await button( page, 'Next' ).click();
		await expect( label( page ) ).not.toHaveText( thisWeek );
		await button( page, 'Today' ).click();
		await expect( label( page ) ).toHaveText( thisWeek );

		await button( page, 'Year' ).click();
		await expect( label( page ) ).toHaveText(
			String( new Date().getUTCFullYear() )
		);
		await expect( block( page ).locator( `${ B }__tick` ) ).toHaveCount(
			12
		);
	} );

	test( 'opens event details in a popover, by mouse or keyboard', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		const live = block( page ).locator( `${ B }__bar.is-happening-now` );
		await live.click();
		const popover = page.locator( ':popover-open' );
		await expect( popover ).toHaveCount( 1 );
		await expect( popover ).toContainText( 'Weekend Ladder Marathon' );
		await expect( popover ).toContainText( 'Happening now' );
		await expect(
			popover.getByRole( 'link', { name: 'Event details' } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( popover ).toHaveCount( 0 );

		await live.focus();
		await page.keyboard.press( 'Enter' );
		await expect( page.locator( ':popover-open' ) ).toContainText(
			'Weekend Ladder Marathon'
		);
		await page
			.locator( ':popover-open' )
			.getByRole( 'button', { name: 'Close' } )
			.click();
		await expect( page.locator( ':popover-open' ) ).toHaveCount( 0 );
	} );
} );

test.describe( 'Filters and the URL', () => {
	test( 'calendar filter keeps one row and updates the URL', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		await button( page, 'Studio' ).click();
		await expect( button( page, 'Studio' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( rows( page ) ).toHaveCount( 1 );
		await expect( rows( page ) ).toContainText( 'Studio' );
		await expect( page ).toHaveURL( /[?&]calendar=studio/ );
	} );

	test( 'type filter hides other events in both views', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		await button( page, 'Livestream' ).click();
		await expect( page ).toHaveURL( /[?&]event_type=livestream/ );
		const calendarsShown = await bars( page ).evaluateAll( ( els ) => [
			...new Set(
				els.map(
					( el ) =>
						el
							.closest( '[data-wp-context*="row"]' )
							.querySelector( 'p' ).textContent
				)
			),
		] );
		expect( calendarsShown ).toEqual( [ 'Studio' ] );

		await button( page, 'List' ).click();
		await expect( listItems( page ) ).toHaveCount( 4 );
		await expect( status( page ) ).toHaveText(
			`Showing 4 of ${ TOTAL } events`
		);
	} );

	test( 'back and forward restore filters and view', async ( { page } ) => {
		await page.goto( PAGE );
		await button( page, 'Pro Circuit' ).click();
		await button( page, 'List' ).click();
		await expect( page ).toHaveURL( /view=list/ );

		await page.goBack();
		await expect( button( page, 'Timeline' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( button( page, 'Pro Circuit' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await page.goBack();
		await expect( rows( page ) ).toHaveCount( 3 );
	} );

	test( 'unknown values in the URL are ignored', async ( { page } ) => {
		await page.goto(
			`${ PAGE }?view=bogus&range=decade&calendar=nope&event_type=nope`
		);
		await expect( button( page, 'Timeline' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( label( page ) ).toHaveText( monthLabel );
		await expect( rows( page ) ).toHaveCount( 3 );
	} );
} );

test.describe( 'Without JavaScript', () => {
	test( 'a shared link renders exactly as sent', async ( { browser } ) => {
		const context = await browser.newContext( {
			javaScriptEnabled: false,
			storageState: { cookies: [], origins: [] },
		} );
		const page = await context.newPage();

		await page.goto( `${ PAGE }?view=list&calendar=studio` );
		await expect(
			block( page ).locator( `${ B }__timeline` )
		).toBeHidden();
		await expect( listItems( page ) ).toHaveCount( 4 );
		await expect( status( page ) ).toHaveText(
			`Showing 4 of ${ TOTAL } events`
		);

		await page.goto( `${ PAGE }?range=year` );
		await expect( label( page ) ).toHaveText(
			String( new Date().getUTCFullYear() )
		);
		await expect( block( page ).locator( `${ B }__tick` ) ).toHaveCount(
			12
		);
		await expect( bars( page ).first() ).toBeVisible();

		// Event details still open: popovers are plain HTML.
		await block( page ).locator( `${ B }__bar.is-happening-now` ).click();
		await expect( page.locator( ':popover-open' ) ).toContainText(
			'Weekend Ladder Marathon'
		);
		await context.close();
	} );
} );

test.describe( 'List view and phones', () => {
	test( 'phones open in the list unless the link asks for the timeline', async ( {
		browser,
	} ) => {
		const context = await browser.newContext( {
			viewport: { width: 390, height: 844 },
			storageState: { cookies: [], origins: [] },
		} );
		const page = await context.newPage();
		await page.goto( PAGE );
		await expect( button( page, 'List' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( listItems( page ) ).toHaveCount( TOTAL );

		await page.goto( `${ PAGE }?view=timeline` );
		await expect( button( page, 'Timeline' ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			block( page ).locator( `${ B }__scroller` )
		).toHaveAttribute( 'tabindex', '0' );
		await context.close();
	} );

	test( 'a list-only block lists past events newest first', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		const past = page.locator( B ).nth( 1 );
		await expect(
			past.getByRole( 'button', { name: 'Timeline' } )
		).toHaveCount( 0 );
		await expect( past.locator( `${ B }__title` ) ).toHaveText( [
			'Patch Notes Live',
			'Map Makers Meetup',
			'Autumn Open Qualifier',
		] );
	} );
} );

test.describe( 'Accessibility', () => {
	for ( const view of [ 'timeline', 'list' ] ) {
		test( `no serious or critical violations in the ${ view } view`, async ( {
			page,
		} ) => {
			await page.goto( `${ PAGE }?view=${ view }` );
			const results = await new AxeBuilder( { page } )
				.include( B )
				.withTags( [
					'wcag2a',
					'wcag2aa',
					'wcag21a',
					'wcag21aa',
					'wcag22aa',
				] )
				.analyze();
			const blocking = results.violations.filter( ( v ) =>
				[ 'serious', 'critical' ].includes( v.impact )
			);
			expect(
				blocking.map(
					( v ) =>
						`${ v.id }: ${ v.help } (${ v.nodes[ 0 ]?.target })`
				)
			).toEqual( [] );
		} );
	}
} );
