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
 *     @type string[] $types     Event type slugs to include. Empty for all types.
 *     @type string[] $calendars Calendar slugs to include. Empty for all calendars.
 *     @type int      $limit Maximum number of events. Default 10.
 * }
 * @return WP_Post[]
 */
function evtl_get_events( array $args = array() ) {
	$args  = wp_parse_args( $args, array( 'show' => 'upcoming', 'types' => array(), 'calendars' => array(), 'limit' => 10 ) );
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

	$tax_query = array();
	foreach ( array( EVTL_TAXONOMY => 'types', EVTL_CALENDAR => 'calendars' ) as $taxonomy => $key ) {
		$slugs = array_filter( array_map( 'sanitize_key', (array) $args[ $key ] ) );
		if ( $slugs ) {
			$tax_query[] = array( 'taxonomy' => $taxonomy, 'field' => 'slug', 'terms' => $slugs );
		}
	}
	if ( $tax_query ) {
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		$query['tax_query'] = array_merge( array( 'relation' => 'AND' ), $tax_query );
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
 * All-day events show dates only: "March 14, 2027 to March 15, 2027".
 *
 * @param string $start   Stored start.
 * @param string $end     Stored end (optional).
 * @param bool   $all_day Whether to leave out times.
 * @return string
 */
function evtl_format_range( $start, $end = '', $all_day = false ) {
	$start_ts = evtl_timestamp( $start );
	if ( ! $start_ts ) {
		return '';
	}
	$date_format = get_option( 'date_format' );
	$time_format = get_option( 'time_format' );
	$label       = $all_day ? wp_date( $date_format, $start_ts ) : wp_date( $date_format, $start_ts ) . ', ' . wp_date( $time_format, $start_ts );

	$end_ts = evtl_timestamp( $end );
	if ( $end_ts && $end_ts > $start_ts ) {
		$same_day = wp_date( 'Y-m-d', $start_ts ) === wp_date( 'Y-m-d', $end_ts );
		if ( $all_day && $same_day ) {
			return $label;
		}
		if ( $all_day ) {
			$end_label = wp_date( $date_format, $end_ts );
		} else {
			$end_label = $same_day ? wp_date( $time_format, $end_ts ) : wp_date( $date_format, $end_ts ) . ', ' . wp_date( $time_format, $end_ts );
		}
		$label = sprintf(
			/* translators: 1: start date (and time), 2: end date and/or time. */
			__( '%1$s to %2$s', 'events-timeline' ),
			$label,
			$end_label
		);
	}
	return $label;
}

/**
 * A calendar's color, falling back to a fixed palette so every calendar has one.
 *
 * @param WP_Term $term Calendar term.
 * @return string Hex color.
 */
function evtl_calendar_color( $term ) {
	$color = sanitize_hex_color( (string) get_term_meta( $term->term_id, 'evtl_color', true ) );
	if ( $color ) {
		return $color;
	}
	$palette = array( '#2f6f9f', '#a23b72', '#3b7d3a', '#b5651d', '#6a4c93', '#1f7a7a' );
	return $palette[ $term->term_id % count( $palette ) ];
}

/**
 * Black or white, whichever reads better on the given background (WCAG relative luminance).
 *
 * @param string $hex Background color.
 * @return string "#000" or "#fff".
 */
function evtl_text_on( $hex ) {
	$hex = ltrim( $hex, '#' );
	if ( 3 === strlen( $hex ) ) {
		$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
	}
	$channel = static function ( $c ) {
		$c = hexdec( $c ) / 255;
		return $c <= 0.03928 ? $c / 12.92 : ( ( $c + 0.055 ) / 1.055 ) ** 2.4;
	};
	$l = 0.2126 * $channel( substr( $hex, 0, 2 ) ) + 0.7152 * $channel( substr( $hex, 2, 2 ) ) + 0.0722 * $channel( substr( $hex, 4, 2 ) );
	// Contrast with white is (1.05 / (l + 0.05)); with black (l + 0.05) / 0.05. Pick the larger.
	return ( 1.05 / ( $l + 0.05 ) ) >= ( ( $l + 0.05 ) / 0.05 ) ? '#fff' : '#000';
}
