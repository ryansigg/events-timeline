/**
 * Timeline themes: built-in themes on the front end, the site default and fallbacks,
 * the Timeline Themes screen (live preview, save, rename, delete, unsaved changes,
 * contrast warnings), the theme picker in the block sidebar, and accessibility for
 * each built-in theme. Uses the events from bin/demo-content.php.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const AxeBuilder = require( '@axe-core/playwright' ).default;

const B = '.wp-block-events-timeline-timeline';
const EDITOR = '/wp-admin/edit.php?post_type=evtl_event&page=evtl-themes';
const API = '/events-timeline/v1/themes';
const BUILT_IN = [ 'broadcast', 'paper', 'neon' ];

// Kept in step with THEME_VARS in src/theme-editor/tokens.js.
const THEME_VARS = [
	'--evtl-surface',
	'--evtl-ink',
	'--evtl-strong',
	'--evtl-on-strong',
	'--evtl-grid-mix',
	'--evtl-line-mix',
	'--evtl-lift',
	'--evtl-radius',
	'--evtl-lane-height',
	'--evtl-font',
	'--evtl-heading-font',
	'--evtl-label-case',
	'--evtl-label-tracking',
];

const readVars = ( locator ) =>
	locator.evaluate(
		( el, names ) =>
			Object.fromEntries(
				names.map( ( name ) => [
					name,
					window
						.getComputedStyle( el )
						.getPropertyValue( name )
						.trim(),
				] )
			),
		THEME_VARS
	);

const pages = [];

/**
 * Publishes a page holding one Timeline block with the given attributes.
 *
 * @param {Object} requestUtils WordPress REST helpers.
 * @param {Object} attributes   Block attributes.
 * @return {Promise<string>} The page's path.
 */
async function blockPage( requestUtils, attributes ) {
	const created = await requestUtils.createPage( {
		title: `Themes test ${ pages.length + 1 }`,
		status: 'publish',
		content: `<!-- wp:events-timeline/timeline ${ JSON.stringify( {
			show: 'all',
			limit: 100,
			...attributes,
		} ) } /-->`,
	} );
	pages.push( created.id );
	return new URL( created.link ).pathname;
}

async function resetThemes( requestUtils ) {
	const { themes } = await requestUtils.rest( { path: API } );
	for ( const theme of themes.filter( ( t ) => ! t.builtIn ) ) {
		await requestUtils.rest( {
			path: `${ API }/${ theme.slug }`,
			method: 'DELETE',
		} );
	}
	await requestUtils.rest( {
		path: `${ API }/default`,
		method: 'POST',
		data: { slug: 'none' },
	} );
}

test.beforeAll( async ( { requestUtils } ) => resetThemes( requestUtils ) );

test.afterAll( async ( { requestUtils } ) => {
	await resetThemes( requestUtils );
	for ( const id of pages.splice( 0 ) ) {
		await requestUtils.rest( {
			path: `/wp/v2/pages/${ id }`,
			method: 'DELETE',
			params: { force: true },
		} );
	}
} );

test.describe( 'Themes on the front end', () => {
	test.use( { storageState: { cookies: [], origins: [] } } );

	test( 'a block with no theme keeps the site’s look', async ( {
		page,
		requestUtils,
	} ) => {
		await page.goto( await blockPage( requestUtils, {} ) );
		await expect( page.locator( B ).first() ).not.toHaveClass(
			/has-evtl-theme/
		);
	} );

	test( 'Neon: dark surface, outlined glowing pill bars', async ( {
		page,
		requestUtils,
	} ) => {
		await page.goto(
			( await blockPage( requestUtils, { theme: 'neon' } ) ) +
				'?view=timeline&range=month'
		);
		const block = page.locator( B ).first();
		await expect( block ).toHaveClass( /has-evtl-theme/ );
		await expect( block ).toHaveClass( /is-bars-outline/ );
		await expect( block ).toHaveClass( /has-evtl-glow/ );
		await expect( block ).toHaveCSS( 'background-color', 'rgb(8, 7, 15)' );

		const bar = block.locator( `${ B }__bar:not([hidden])` ).first();
		await expect( bar ).toHaveCSS( 'border-top-style', 'solid' );
		const radius = await bar.evaluate( ( el ) =>
			parseFloat( window.getComputedStyle( el ).borderTopLeftRadius )
		);
		const height = await bar.evaluate( ( el ) => el.offsetHeight );
		expect( radius ).toBeCloseTo( height / 2, 0 );
	} );

	test( 'Broadcast: uppercase labels and the accent on the selected filter', async ( {
		page,
		requestUtils,
	} ) => {
		await page.goto(
			await blockPage( requestUtils, { theme: 'broadcast' } )
		);
		const block = page.locator( B ).first();
		const all = block
			.getByRole( 'button', { name: 'All', exact: true } )
			.first();
		await expect( all ).toHaveCSS( 'text-transform', 'uppercase' );
		await expect( all ).toHaveCSS( 'background-color', 'rgb(242, 183, 5)' );
	} );

	test( 'the site default applies to blocks without their own theme, and “No theme” opts out', async ( {
		page,
		requestUtils,
	} ) => {
		const inherits = await blockPage( requestUtils, {} );
		const optsOut = await blockPage( requestUtils, { theme: 'none' } );
		await requestUtils.rest( {
			path: `${ API }/default`,
			method: 'POST',
			data: { slug: 'paper' },
		} );

		await page.goto( inherits );
		await expect( page.locator( B ).first() ).toHaveClass(
			/is-evtl-theme-paper/
		);
		await page.goto( optsOut );
		await expect( page.locator( B ).first() ).not.toHaveClass(
			/has-evtl-theme/
		);

		await requestUtils.rest( {
			path: `${ API }/default`,
			method: 'POST',
			data: { slug: 'none' },
		} );
	} );

	test( 'a block whose theme was deleted falls back to the site default', async ( {
		page,
		requestUtils,
	} ) => {
		const created = await requestUtils.rest( {
			path: API,
			method: 'POST',
			data: { name: 'Short Lived', tokens: { background: '#123456' } },
		} );
		const path = await blockPage( requestUtils, { theme: created.slug } );
		await page.goto( path );
		await expect( page.locator( B ).first() ).toHaveCSS(
			'background-color',
			'rgb(18, 52, 86)'
		);

		await requestUtils.rest( {
			path: `${ API }/${ created.slug }`,
			method: 'DELETE',
		} );
		await requestUtils.rest( {
			path: `${ API }/default`,
			method: 'POST',
			data: { slug: 'broadcast' },
		} );
		await page.goto( path );
		await expect( page.locator( B ).first() ).toHaveClass(
			/is-evtl-theme-broadcast/
		);
		await requestUtils.rest( {
			path: `${ API }/default`,
			method: 'POST',
			data: { slug: 'none' },
		} );
	} );

	test( 'bad token values are cleaned up when saved', async ( {
		requestUtils,
	} ) => {
		const created = await requestUtils.rest( {
			path: API,
			method: 'POST',
			data: {
				name: 'Messy',
				tokens: {
					background: 'red; }</style>',
					radius: 400,
					bars: 'zigzag',
					font: 'comic',
					extra: 'ignored',
				},
			},
		} );
		const theme = created.themes.find( ( t ) => t.slug === created.slug );
		expect( theme.tokens.background ).toBe( '#ffffff' );
		expect( theme.tokens.radius ).toBe( 24 );
		expect( theme.tokens.bars ).toBe( 'solid' );
		expect( theme.tokens.font ).toBe( 'inherit' );
		expect( theme.tokens ).not.toHaveProperty( 'extra' );
		await requestUtils.rest( {
			path: `${ API }/${ created.slug }`,
			method: 'DELETE',
		} );

		// Built-in themes can't be deleted (or changed) through the API.
		const refused = await requestUtils
			.rest( { path: `${ API }/neon`, method: 'DELETE' } )
			.catch( ( error ) => error );
		expect( refused.code ).toBe( 'evtl_builtin_theme' );
	} );

	for ( const slug of BUILT_IN ) {
		for ( const view of [ 'timeline', 'list' ] ) {
			test( `${ slug }: no serious or critical accessibility violations in the ${ view } view`, async ( {
				page,
				requestUtils,
			} ) => {
				await page.goto(
					( await blockPage( requestUtils, { theme: slug } ) ) +
						`?view=${ view }`
				);
				const results = await new AxeBuilder( { page } )
					.include( B )
					.withTags( [ 'wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa' ] )
					.analyze();
				expect(
					results.violations.filter( ( v ) =>
						[ 'serious', 'critical' ].includes( v.impact )
					)
				).toEqual( [] );
			} );
		}
	}
} );

test.describe( 'Timeline Themes screen', () => {
	const preview = ( page ) => page.locator( `#evtl-theme-preview ${ B }` );
	const form = ( page ) => page.locator( '.evtl-theme-form' );
	const list = ( page ) => page.getByRole( 'navigation', { name: 'Themes' } );

	test( 'the preview uses exactly the variables the front end gets', async ( {
		page,
		requestUtils,
	} ) => {
		for ( const slug of BUILT_IN ) {
			await page.goto( await blockPage( requestUtils, { theme: slug } ) );
			const front = await readVars( page.locator( B ).first() );
			await page.goto( `${ EDITOR }&theme=${ slug }` );
			await expect( preview( page ) ).toHaveClass(
				new RegExp( `is-evtl-theme-${ slug }` )
			);
			expect( await readVars( preview( page ) ) ).toEqual( front );
		}
	} );

	test( 'the preview is the live block: its view buttons work', async ( {
		page,
	} ) => {
		await page.goto( `${ EDITOR }&theme=paper` );
		await preview( page )
			.getByRole( 'button', { name: 'List', exact: true } )
			.click();
		await expect( preview( page ).locator( `${ B }__list` ) ).toBeVisible();
	} );

	test( 'customize a built-in, save it, rename it, make it the default, delete it', async ( {
		page,
		requestUtils,
	} ) => {
		await page.goto( `${ EDITOR }&theme=paper` );
		await expect(
			form( page ).getByRole( 'heading', { name: 'Paper' } )
		).toBeVisible();
		await expect(
			form( page ).getByRole( 'button', { name: 'Save', exact: true } )
		).toHaveCount( 0 );

		// Edits restyle the preview immediately.
		await form( page )
			.getByRole( 'combobox', { name: 'Bar style' } )
			.selectOption( 'outline' );
		await expect( preview( page ) ).toHaveClass( /is-bars-outline/ );
		await form( page )
			.getByRole( 'spinbutton', { name: 'Corner radius (px)' } )
			.fill( '12' );
		await expect
			.poll(
				async () =>
					( await readVars( preview( page ) ) )[ '--evtl-radius' ]
			)
			.toBe( '12px' );

		await form( page )
			.getByRole( 'button', { name: 'Save as my theme' } )
			.click();
		await expect(
			form( page ).getByText( '“Paper (custom)” saved.' )
		).toBeVisible();
		await expect(
			list( page ).getByRole( 'button', { name: /Paper \(custom\)/ } )
		).toHaveAttribute( 'aria-current', 'true' );
		await expect( page ).toHaveURL( /theme=paper-custom/ );

		let saved = ( await requestUtils.rest( { path: API } ) ).themes.find(
			( t ) => t.slug === 'paper-custom'
		);
		expect( saved.tokens ).toMatchObject( { bars: 'outline', radius: 12 } );

		// Rename and save.
		await form( page )
			.getByRole( 'textbox', { name: 'Theme name' } )
			.fill( 'Club Night' );
		await form( page )
			.getByRole( 'button', { name: 'Save', exact: true } )
			.click();
		await expect(
			form( page ).getByText( '“Club Night” saved.' )
		).toBeVisible();
		await page.reload();
		await expect(
			list( page ).getByRole( 'button', { name: /Club Night/ } )
		).toHaveAttribute( 'aria-current', 'true' );

		// Site default.
		await list( page )
			.getByRole( 'combobox', { name: 'Site default' } )
			.selectOption( 'paper-custom' );
		await expect(
			form( page ).getByText(
				'Blocks without their own theme now use “Club Night”.'
			)
		).toBeVisible();
		saved = await requestUtils.rest( { path: API } );
		expect( saved.default ).toBe( 'paper-custom' );

		// Delete; the default goes back to no theme.
		await form( page ).getByRole( 'button', { name: 'Delete' } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Delete theme?' } );
		await dialog.getByRole( 'button', { name: 'Delete' } ).click();
		await expect(
			form( page ).getByText( '“Club Night” deleted.' )
		).toBeVisible();
		await expect(
			list( page ).getByRole( 'button', { name: /Club Night/ } )
		).toHaveCount( 0 );
		saved = await requestUtils.rest( { path: API } );
		expect( saved.default ).toBe( 'none' );
		expect( saved.themes.map( ( t ) => t.slug ) ).not.toContain(
			'paper-custom'
		);
	} );

	test( 'switching themes with unsaved changes asks first', async ( {
		page,
	} ) => {
		await page.goto( `${ EDITOR }&theme=broadcast` );
		await form( page )
			.getByRole( 'spinbutton', { name: 'Grid line strength (%)' } )
			.fill( '30' );
		await list( page ).getByRole( 'button', { name: /^Neon/ } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Discard changes?' } );
		await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
		await expect(
			list( page ).getByRole( 'button', { name: /^Broadcast/ } )
		).toHaveAttribute( 'aria-current', 'true' );

		await list( page ).getByRole( 'button', { name: /^Neon/ } ).click();
		await dialog.getByRole( 'button', { name: 'Discard' } ).click();
		await expect(
			list( page ).getByRole( 'button', { name: /^Neon/ } )
		).toHaveAttribute( 'aria-current', 'true' );
		await expect(
			form( page ).getByRole( 'spinbutton', {
				name: 'Grid line strength (%)',
			} )
		).toHaveValue( '14' );
	} );

	test( 'warns when text and background colors are too close', async ( {
		page,
	} ) => {
		await page.goto( `${ EDITOR }&theme=paper` );
		await expect( form( page ).locator( '.evtl-contrast' ) ).toContainText(
			'Both pass'
		);
		await form( page ).getByRole( 'button', { name: /^Text/ } ).click();
		const hex = page.getByRole( 'textbox', { name: 'Hex color' } );
		await hex.fill( 'd8d2c4' );
		await hex.press( 'Enter' );
		await expect( form( page ).locator( '.evtl-contrast' ) ).toContainText(
			/Text on the background is 1\.\d:1/
		);
	} );
} );

test.describe( 'Theme picker in the block editor', () => {
	test( 'picks a theme and the preview follows', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.insertBlock( { name: 'events-timeline/timeline' } );
		await editor.openDocumentSettingsSidebar();
		const settings = page.getByRole( 'region', {
			name: 'Editor settings',
		} );

		const group = settings.getByRole( 'group', { name: 'Timeline theme' } );
		await expect(
			group.getByRole( 'button', { name: /^Site default/ } )
		).toHaveAttribute( 'aria-pressed', 'true' );
		await group.getByRole( 'button', { name: /^Neon/ } ).click();

		await expect(
			editor.canvas.locator( `${ B }.is-evtl-theme-neon` )
		).toBeVisible();
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toBe( '<!-- wp:events-timeline/timeline {"theme":"neon"} /-->' );
		await expect(
			settings.getByRole( 'link', { name: /Create or edit themes/ } )
		).toHaveAttribute( 'href', /page=evtl-themes/ );
	} );
} );
