<?php
/**
 * Querying and formatting events.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

/**
 * The current site-local time in the same format events are stored in.
 *
 * @return string
 */
function evtl_now() {
	return wp_date( 'Y-m-d\TH:i' );
}

/**
 * Get published events.
 *
 * Upcoming events include ones in progress (started but not yet ended), in date order.
 * Past events are newest first.
 *
 * @param array $args {
 *     @type string   $show  "upcoming", "past" or "all". Default "upcoming".
 *     @type string[] $types Event type slugs to include. Empty for all types.
 *     @type int      $limit Maximum number of events. Default 10.
 * }
 * @return WP_Post[]
 */
function evtl_get_events( array $args = array() ) {
	$args  = wp_parse_args( $args, array( 'show' => 'upcoming', 'types' => array(), 'limit' => 10 ) );
	$now   = evtl_now();
	$query = array(
		'post_type'           => EVTL_POST_TYPE,
		'post_status'         => 'publish',
		'posts_per_page'      => max( 1, min( 100, (int) $args['limit'] ) ),
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
		'meta_key'            => 'evtl_start', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		'orderby'             => 'meta_value',
		'order'               => 'past' === $args['show'] ? 'DESC' : 'ASC',
	);

	if ( 'upcoming' === $args['show'] ) {
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		$query['meta_query'] = array(
			'relation' => 'OR',
			array( 'key' => 'evtl_start', 'value' => $now, 'compare' => '>=' ),
			array( 'key' => 'evtl_end', 'value' => $now, 'compare' => '>=' ),
		);
	} elseif ( 'past' === $args['show'] ) {
		// An event is past once it has ended, or once it has started if it has no end.
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		$query['meta_query'] = array(
			'relation' => 'OR',
			array(
				'relation' => 'AND',
				array( 'key' => 'evtl_end', 'value' => '', 'compare' => '!=' ),
				array( 'key' => 'evtl_end', 'value' => $now, 'compare' => '<' ),
			),
			array(
				'relation' => 'AND',
				array( 'key' => 'evtl_start', 'value' => $now, 'compare' => '<' ),
				array(
					'relation' => 'OR',
					array( 'key' => 'evtl_end', 'compare' => 'NOT EXISTS' ),
					array( 'key' => 'evtl_end', 'value' => '' ),
				),
			),
		);
	}

	$types = array_filter( array_map( 'sanitize_key', (array) $args['types'] ) );
	if ( $types ) {
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		$query['tax_query'] = array(
			array( 'taxonomy' => EVTL_TAXONOMY, 'field' => 'slug', 'terms' => $types ),
		);
	}

	/**
	 * Filter the WP_Query arguments used by the Timeline block.
	 *
	 * @param array $query Query arguments.
	 * @param array $args  Block-level arguments (show, types, limit).
	 */
	$query = apply_filters( 'evtl_events_query_args', $query, $args );

	return ( new WP_Query( $query ) )->posts;
}

/**
 * Convert a stored local datetime to a timestamp in the site's time zone.
 *
 * @param string $local "Y-m-d\TH:i".
 * @return int|null
 */
function evtl_timestamp( $local ) {
	if ( ! $local ) {
		return null;
	}
	$date = date_create_immutable_from_format( 'Y-m-d\TH:i', $local, wp_timezone() );
	return $date ? $date->getTimestamp() : null;
}

/**
 * Human-readable date range using the site's date and time formats.
 * Same-day ranges show the date once: "March 14, 2027, 7:00 pm to 9:00 pm".
 *
 * @param string $start Stored start.
 * @param string $end   Stored end (optional).
 * @return string
 */
function evtl_format_range( $start, $end = '' ) {
	$start_ts = evtl_timestamp( $start );
	if ( ! $start_ts ) {
		return '';
	}
	$date_format = get_option( 'date_format' );
	$time_format = get_option( 'time_format' );
	$label       = wp_date( $date_format, $start_ts ) . ', ' . wp_date( $time_format, $start_ts );

	$end_ts = evtl_timestamp( $end );
	if ( $end_ts && $end_ts > $start_ts ) {
		$same_day = wp_date( 'Y-m-d', $start_ts ) === wp_date( 'Y-m-d', $end_ts );
		$label    = sprintf(
			/* translators: 1: start date and time, 2: end time or end date and time. */
			__( '%1$s to %2$s', 'events-timeline' ),
			$label,
			$same_day ? wp_date( $time_format, $end_ts ) : wp_date( $date_format, $end_ts ) . ', ' . wp_date( $time_format, $end_ts )
		);
	}
	return $label;
}
