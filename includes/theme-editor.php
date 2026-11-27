<?php
/**
 * Events > Timeline Themes: the theme editor screen.
 *
 * The controls are a React app (src/theme-editor). The preview next to them is the real
 * Timeline block, rendered here on the server with this site's events and made
 * interactive by the block's own view script, so filters, ranges, the list view and
 * event popovers all work while you edit. The app restyles it live by swapping the
 * theme's custom properties on the block's wrapper.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

/** Admin page slug. */
const EVTL_THEME_EDITOR_PAGE = 'evtl-themes';

/**
 * Adds Timeline Themes under the Events menu.
 */
function evtl_add_theme_editor_page() {
	$GLOBALS['evtl_theme_editor_hook'] = add_submenu_page(
		'edit.php?post_type=evtl_event',
		__( 'Timeline Themes', 'events-timeline' ),
		__( 'Timeline Themes', 'events-timeline' ),
		'edit_theme_options',
		EVTL_THEME_EDITOR_PAGE,
		'evtl_render_theme_editor_page'
	);
}
add_action( 'admin_menu', 'evtl_add_theme_editor_page' );

/**
 * Loads the editor app and the block's front-end styles for the preview.
 *
 * @param string $hook_suffix Current admin page.
 */
function evtl_enqueue_theme_editor( $hook_suffix ) {
	if ( empty( $GLOBALS['evtl_theme_editor_hook'] ) || $GLOBALS['evtl_theme_editor_hook'] !== $hook_suffix ) {
		return;
	}
	$asset_file = EVTL_DIR . 'build/theme-editor/index.asset.php';
	if ( ! file_exists( $asset_file ) ) {
		return;
	}
	$asset = require $asset_file;

	wp_enqueue_script(
		'evtl-theme-editor',
		plugins_url( 'build/theme-editor/index.js', EVTL_FILE ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
	wp_set_script_translations( 'evtl-theme-editor', 'events-timeline' );

	$config = evtl_themes_for_js() + array(
		'fonts'         => evtl_theme_fonts(),
		'densities'     => evtl_theme_densities(),
		'tokenDefaults' => evtl_theme_token_defaults(),
	);
	wp_add_inline_script(
		'evtl-theme-editor',
		'window.evtlThemeEditor = ' . wp_json_encode( $config ) . ';',
		'before'
	);

	wp_enqueue_style(
		'evtl-theme-editor',
		plugins_url( 'build/theme-editor/index.css', EVTL_FILE ),
		array( 'wp-components' ),
		$asset['version']
	);
	// The preview is the real block, so it needs the block's own stylesheet.
	wp_enqueue_style( generate_block_asset_handle( 'events-timeline/timeline', 'style' ) );
}
add_action( 'admin_enqueue_scripts', 'evtl_enqueue_theme_editor' );

/**
 * Prints the page: a mount point for the app and the live block preview.
 */
function evtl_render_theme_editor_page() {
	if ( ! evtl_can_manage_themes() ) {
		return;
	}
	$preview = render_block(
		array(
			'blockName'    => 'events-timeline/timeline',
			'attrs'        => array(
				'show'  => 'all',
				'limit' => 100,
				'theme' => EVTL_NO_THEME,
			),
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		)
	);
	$has_events = (bool) evtl_get_events(
		array(
			'show'  => 'all',
			'limit' => 1,
		)
	);
	?>
	<div class="wrap evtl-themes">
		<h1><?php esc_html_e( 'Timeline Themes', 'events-timeline' ); ?></h1>
		<p class="evtl-themes__intro">
			<?php esc_html_e( 'Pick a theme to see it on your own events, adjust it, and save it as your own. Every Events Timeline block can use any theme, or the site default set here.', 'events-timeline' ); ?>
		</p>
		<div class="evtl-themes__layout">
			<div id="evtl-theme-editor-root" class="evtl-themes__app">
				<p><?php esc_html_e( 'Loading the theme editor…', 'events-timeline' ); ?></p>
			</div>
			<section class="evtl-themes__preview" aria-labelledby="evtl-themes-preview-title">
				<h2 id="evtl-themes-preview-title" class="evtl-themes__preview-title"><?php esc_html_e( 'Preview', 'events-timeline' ); ?></h2>
				<?php if ( ! $has_events ) : ?>
					<div class="notice notice-info inline">
						<p>
							<?php
							printf(
								/* translators: %s: link to add an event. */
								esc_html__( 'The preview shows your events. %s to see a theme with real content.', 'events-timeline' ),
								'<a href="' . esc_url( admin_url( 'post-new.php?post_type=evtl_event' ) ) . '">' . esc_html__( 'Add an event', 'events-timeline' ) . '</a>'
							);
							?>
						</p>
					</div>
				<?php endif; ?>
				<div id="evtl-theme-preview" class="evtl-themes__canvas">
					<?php echo $preview; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- block output, escaped in render.php. ?>
				</div>
			</section>
		</div>
	</div>
	<?php
}
