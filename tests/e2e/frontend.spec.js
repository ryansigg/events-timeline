/**
 * Front end: filtering, shareable URLs, keyboard use, layouts and accessibility.
 * Runs logged out, against the "Events" page from bin/demo-content.php.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const AxeBuilder = require( '@axe-core/playwright' ).default;

const PAGE = '/events-demo/';

test.use( { storageState: { cookies: [], origins: [] } } );

const upcoming = ( page ) =>
	page.locator( '.wp-block-events-timeline-timeline' ).first();
const visibleItems = ( timeline ) =>
	timeline.locator(
		'.wp-block-events-timeline-timeline__item:not([hidden])'
	);

test.describe( 'Timeline on the front end', () => {
	test( 'filters by type and keeps the filter in the URL', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		const timeline = upcoming( page );
		const status = timeline.locator(
			'.wp-block-events-timeline-timeline__status'
		);

		await expect( visibleItems( timeline ) ).toHaveCount( 6 );
		await expect( status ).toHaveText( 'Showing 6 of 6 events' );

		const tournament = timeline.getByRole( 'button', {
			name: 'Tournament',
		} );
		await tournament.click();

		await expect( tournament ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			timeline.getByRole( 'button', { name: 'All' } )
		).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( visibleItems( timeline ) ).toHaveCount( 2 );
		await expect( status ).toHaveText( 'Showing 2 of 6 events' );
		await expect( page ).toHaveURL( /[?&]event_type=tournament/ );

		await timeline.getByRole( 'button', { name: 'All' } ).click();
		await expect( visibleItems( timeline ) ).toHaveCount( 6 );
		await expect( page ).not.toHaveURL( /event_type=/ );
	} );

	test( 'back and forward restore the filter', async ( { page } ) => {
		await page.goto( PAGE );
		const timeline = upcoming( page );
		await timeline.getByRole( 'button', { name: 'Tournament' } ).click();
		await timeline.getByRole( 'button', { name: 'Community' } ).click();
		await expect( page ).toHaveURL( /event_type=community/ );

		await page.goBack();
		await expect( page ).toHaveURL( /event_type=tournament/ );
		await expect(
			timeline.getByRole( 'button', { name: 'Tournament' } )
		).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( visibleItems( timeline ) ).toHaveCount( 2 );
	} );

	test( 'a filtered link renders filtered, even without JavaScript', async ( {
		browser,
	} ) => {
		const context = await browser.newContext( {
			javaScriptEnabled: false,
			storageState: { cookies: [], origins: [] },
		} );
		const page = await context.newPage();
		await page.goto( `${ PAGE }?event_type=community` );
		const timeline = upcoming( page );

		await expect( visibleItems( timeline ) ).toHaveCount( 2 );
		await expect(
			timeline.getByRole( 'button', { name: 'Community' } )
		).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			timeline.locator( '.wp-block-events-timeline-timeline__status' )
		).toHaveText( 'Showing 2 of 6 events' );
		await context.close();
	} );

	test( 'an unknown filter in the URL is ignored', async ( { page } ) => {
		await page.goto( `${ PAGE }?event_type=not-a-type` );
		await expect( visibleItems( upcoming( page ) ) ).toHaveCount( 6 );
	} );

	test( 'filters work from the keyboard', async ( { page } ) => {
		await page.goto( PAGE );
		const timeline = upcoming( page );
		const livestream = timeline.getByRole( 'button', {
			name: 'Livestream',
		} );

		await livestream.focus();
		await page.keyboard.press( 'Enter' );
		await expect( livestream ).toHaveAttribute( 'aria-pressed', 'true' );

		await timeline.getByRole( 'button', { name: 'All' } ).focus();
		await page.keyboard.press( 'Space' );
		await expect( visibleItems( timeline ) ).toHaveCount( 6 );
	} );

	test( 'marks the event that is happening now', async ( { page } ) => {
		await page.goto( PAGE );
		const live = upcoming( page ).locator( '.is-happening-now' );
		await expect( live ).toHaveCount( 1 );
		await expect( live ).toContainText( 'Happening now' );
		await expect( live ).toContainText( 'Weekend Ladder Marathon' );
	} );

	test( 'past events are listed newest first', async ( { page } ) => {
		await page.goto( PAGE );
		const past = page
			.locator( '.wp-block-events-timeline-timeline' )
			.nth( 1 );
		await expect(
			past.locator( '.wp-block-events-timeline-timeline__title' )
		).toHaveText( [
			'Patch Notes Live',
			'Map Makers Meetup',
			'Autumn Open Qualifier',
		] );
		// Filters are turned off on this block.
		await expect( past.getByRole( 'group' ) ).toHaveCount( 0 );
	} );

	test( 'horizontal on wide screens, a stacked list on phones', async ( {
		page,
	} ) => {
		const list = upcoming( page ).locator(
			'.wp-block-events-timeline-timeline__list'
		);

		await page.setViewportSize( { width: 1280, height: 800 } );
		await page.goto( PAGE );
		await expect( list ).toHaveCSS( 'display', 'grid' );
		await expect( list ).toHaveAttribute( 'tabindex', '0' ); // Scroll region reachable by keyboard.

		await page.setViewportSize( { width: 390, height: 844 } );
		await expect( list ).toHaveCSS( 'display', 'block' );
	} );

	test( 'has no serious or critical accessibility violations', async ( {
		page,
	} ) => {
		await page.goto( PAGE );
		const results = await new AxeBuilder( { page } )
			.include( '.wp-block-events-timeline-timeline' )
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
		expect( blocking.map( ( v ) => `${ v.id }: ${ v.help }` ) ).toEqual(
			[]
		);
	} );
} );
