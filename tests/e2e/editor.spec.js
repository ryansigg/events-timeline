/**
 * Block editor: the Event details panel and the Timeline block's settings.
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Event details panel', () => {
	let createdId;

	test.afterEach( async ( { requestUtils } ) => {
		if ( createdId ) {
			await requestUtils.rest( {
				method: 'DELETE',
				path: `/wp/v2/events/${ createdId }`,
				params: { force: true },
			} );
			createdId = undefined;
		}
	} );

	test( 'requires a start date, then saves every field', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'evtl_event' } );
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Spring Showmatch' );
		await editor.openDocumentSettingsSidebar();

		const panel = page.locator( '.evtl-event-details' );
		await expect( panel ).toBeVisible();

		// Saving is locked until there is a start date.
		const publish = page
			.getByRole( 'region', { name: 'Editor top bar' } )
			.getByRole( 'button', { name: 'Publish', exact: true } );
		await expect( publish ).toBeDisabled();
		await expect( panel ).toContainText( 'Required before you can save.' );

		await panel.getByLabel( 'Starts' ).fill( '2027-03-14T19:00' );
		await panel.getByLabel( 'Ends' ).fill( '2027-03-14T17:00' );
		await expect( panel ).toContainText( 'The end is before the start.' );
		await panel.getByLabel( 'Ends' ).fill( '2027-03-14T21:00' );
		await expect( panel ).not.toContainText(
			'The end is before the start.'
		);
		await panel.getByLabel( 'Location' ).fill( 'Portland, OR' );
		await panel
			.getByLabel( 'Event link' )
			.fill( 'https://example.test/tickets' );

		await expect( publish ).toBeEnabled();
		createdId = await editor
			.publishPost()
			.then( () =>
				page.evaluate( () =>
					window.wp.data.select( 'core/editor' ).getCurrentPostId()
				)
			);

		const saved = await page.evaluate(
			( id ) =>
				window.wp.apiFetch( {
					path: `/wp/v2/events/${ id }?context=edit`,
				} ),
			createdId
		);
		expect( saved.meta ).toMatchObject( {
			evtl_start: '2027-03-14T19:00',
			evtl_end: '2027-03-14T21:00',
			evtl_location: 'Portland, OR',
			evtl_url: 'https://example.test/tickets',
		} );
	} );

	test( 'all-day events store whole days', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { postType: 'evtl_event' } );
		await editor.canvas
			.getByRole( 'textbox', { name: 'Add title' } )
			.fill( 'Spring Festival' );
		await editor.openDocumentSettingsSidebar();
		const panel = page.locator( '.evtl-event-details' );

		await panel.getByLabel( 'All day' ).check();
		await expect( panel.getByLabel( 'Starts' ) ).toHaveAttribute(
			'type',
			'date'
		);
		await panel.getByLabel( 'Starts' ).fill( '2027-04-10' );
		await panel.getByLabel( 'Ends' ).fill( '2027-04-11' );

		createdId = await editor
			.publishPost()
			.then( () =>
				page.evaluate( () =>
					window.wp.data.select( 'core/editor' ).getCurrentPostId()
				)
			);
		const saved = await page.evaluate(
			( id ) =>
				window.wp.apiFetch( {
					path: `/wp/v2/events/${ id }?context=edit`,
				} ),
			createdId
		);
		expect( saved.meta ).toMatchObject( {
			evtl_all_day: true,
			evtl_start: '2027-04-10T00:00',
			evtl_end: '2027-04-11T23:59',
		} );
	} );

	test( 'only appears on events', async ( { admin, page, editor } ) => {
		await admin.createNewPost();
		await editor.openDocumentSettingsSidebar();
		await expect( page.locator( '.evtl-event-details' ) ).toHaveCount( 0 );
	} );
} );

test.describe( 'Timeline block', () => {
	test( 'inserts with a live preview that follows its settings', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost();
		await editor.insertBlock( { name: 'events-timeline/timeline' } );

		const preview = editor.canvas.locator(
			'.wp-block-events-timeline-timeline__grid'
		);
		await expect( preview ).toBeVisible();
		// The editor wraps the server-rendered preview, so take the outer element.
		const block = editor.canvas
			.locator( '.wp-block-events-timeline-timeline' )
			.first();
		await expect( block ).toContainText( 'Winter Invitational' );

		await editor.openDocumentSettingsSidebar();
		const settings = page.getByRole( 'region', {
			name: 'Editor settings',
		} );
		await settings
			.getByRole( 'combobox', { name: 'Show' } )
			.selectOption( 'past' );
		await expect( block ).toContainText( 'Patch Notes Live' );
		await expect( block ).not.toContainText( 'Winter Invitational' );

		await settings.getByRole( 'checkbox', { name: 'Community' } ).check();
		await expect( block ).toContainText( 'Map Makers Meetup' );
		await expect( block ).not.toContainText( 'Patch Notes Live' );

		await settings
			.getByRole( 'combobox', { name: 'Opens in' } )
			.selectOption( 'list' );
		await expect(
			editor.canvas
				.locator( '.wp-block-events-timeline-timeline__list' )
				.last()
		).toBeVisible();

		// Dynamic block: it saves as a comment with attributes only, which can never go invalid.
		await expect
			.poll( () => editor.getEditedPostContent() )
			.toBe(
				'<!-- wp:events-timeline/timeline {"show":"past","defaultView":"list","calendars":["community"]} /-->'
			);
	} );
} );
