<?php
/**
 * Event post type, Event type taxonomy and event fields.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

const EVTL_POST_TYPE = 'evtl_event';
const EVTL_TAXONOMY  = 'evtl_event_type';

/**
 * Event fields, all exposed to the REST API so the editor can read and write them.
 * Dates are stored as site-local "Y-m-d\TH:i" strings, which sort correctly as text.
 *
 * @return array<string, array<string, mixed>>
 */
function evtl_meta_fields() {
	return array(
		'evtl_start'    => array(
			'description'       => __( 'Start date and time (site time zone).', 'events-timeline' ),
			'sanitize_callback' => 'evtl_sanitize_datetime',
		),
		'evtl_end'      => array(
			'description'       => __( 'End date and time (site time zone).', 'events-timeline' ),
			'sanitize_callback' => 'evtl_sanitize_datetime',
		),
		'evtl_location' => array(
			'description'       => __( 'Where the event happens: a venue, a city or "Online".', 'events-timeline' ),
			'sanitize_callback' => 'sanitize_text_field',
		),
		'evtl_url'      => array(
			'description'       => __( 'Optional link for tickets, registration or a stream.', 'events-timeline' ),
			'sanitize_callback' => 'esc_url_raw',
		),
	);
}

/**
 * Keep only well-formed local datetimes; anything else is stored as empty.
 *
 * @param mixed $value Raw value.
 * @return string
 */
function evtl_sanitize_datetime( $value ) {
	$value = is_string( $value ) ? trim( $value ) : '';
	if ( preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $value ) ) {
		return $value;
	}
	// Accept seconds or a space separator from imports, and normalize them.
	if ( preg_match( '/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/', $value, $m ) ) {
		return $m[1] . 'T' . $m[2];
	}
	return '';
}

/**
 * Register the Event post type.
 */
function evtl_register_post_type() {
	register_post_type(
		EVTL_POST_TYPE,
		array(
			'labels'       => array(
				'name'               => __( 'Events', 'events-timeline' ),
				'singular_name'      => __( 'Event', 'events-timeline' ),
				'add_new_item'       => __( 'Add New Event', 'events-timeline' ),
				'edit_item'          => __( 'Edit Event', 'events-timeline' ),
				'new_item'           => __( 'New Event', 'events-timeline' ),
				'view_item'          => __( 'View Event', 'events-timeline' ),
				'search_items'       => __( 'Search Events', 'events-timeline' ),
				'not_found'          => __( 'No events found.', 'events-timeline' ),
				'not_found_in_trash' => __( 'No events found in Trash.', 'events-timeline' ),
				'all_items'          => __( 'All Events', 'events-timeline' ),
			),
			'public'       => true,
			'has_archive'  => 'events',
			'rewrite'      => array( 'slug' => 'events' ),
			'menu_icon'    => 'dashicons-calendar-alt',
			'show_in_rest' => true,
			'rest_base'    => 'events',
			// custom-fields is required for registered meta to appear in the REST API.
			'supports'     => array( 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' ),
		)
	);
}

/**
 * Register the Event type taxonomy and the event fields.
 */
function evtl_register_taxonomy_and_meta() {
	register_taxonomy(
		EVTL_TAXONOMY,
		EVTL_POST_TYPE,
		array(
			'labels'            => array(
				'name'          => __( 'Event types', 'events-timeline' ),
				'singular_name' => __( 'Event type', 'events-timeline' ),
				'add_new_item'  => __( 'Add New Event Type', 'events-timeline' ),
				'search_items'  => __( 'Search Event Types', 'events-timeline' ),
				'all_items'     => __( 'All Event Types', 'events-timeline' ),
			),
			'hierarchical'      => true,
			'show_in_rest'      => true,
			'rest_base'         => 'event-types',
			'show_admin_column' => true,
			'rewrite'           => array( 'slug' => 'event-type' ),
		)
	);

	foreach ( evtl_meta_fields() as $key => $args ) {
		register_post_meta(
			EVTL_POST_TYPE,
			$key,
			array_merge(
				array(
					'type'          => 'string',
					'single'        => true,
					'default'       => '',
					'show_in_rest'  => true,
					'auth_callback' => static function ( $allowed, $meta_key, $post_id ) {
						return current_user_can( 'edit_post', $post_id );
					},
				),
				$args
			)
		);
	}
}

add_action( 'init', 'evtl_register_post_type' );
add_action( 'init', 'evtl_register_taxonomy_and_meta' );
