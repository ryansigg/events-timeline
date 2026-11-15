<?php
/**
 * Plugin Name:       Events Timeline
 * Plugin URI:        https://github.com/ryansigg/events-timeline
 * Description:       An Event post type and a Timeline block: upcoming or past events on a horizontal or vertical timeline, with type filters you can link to.
 * Version:           1.0.0
 * Requires at least: 6.7
 * Requires PHP:      7.4
 * Author:            Ryan Sigg
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       events-timeline
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

define( 'EVTL_VERSION', '1.0.0' );
define( 'EVTL_FILE', __FILE__ );
define( 'EVTL_DIR', plugin_dir_path( __FILE__ ) );

require_once EVTL_DIR . 'includes/post-type.php';
require_once EVTL_DIR . 'includes/query.php';
require_once EVTL_DIR . 'includes/admin.php';

/**
 * Register the Timeline block from its compiled block.json.
 */
function evtl_register_blocks() {
	register_block_type( EVTL_DIR . 'build/timeline' );
}
add_action( 'init', 'evtl_register_blocks' );

/**
 * Load the Event details sidebar panel in the block editor.
 * The script renders nothing outside the Event post type.
 */
function evtl_enqueue_editor_assets() {
	$asset_file = EVTL_DIR . 'build/event-details/index.asset.php';
	if ( ! file_exists( $asset_file ) ) {
		return;
	}
	$asset = require $asset_file;
	wp_enqueue_script(
		'evtl-event-details',
		plugins_url( 'build/event-details/index.js', EVTL_FILE ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
	wp_set_script_translations( 'evtl-event-details', 'events-timeline' );
}
add_action( 'enqueue_block_editor_assets', 'evtl_enqueue_editor_assets' );

/**
 * Flush rewrite rules so /events/ works right after activation.
 */
function evtl_activate() {
	evtl_register_post_type();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'evtl_activate' );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );
