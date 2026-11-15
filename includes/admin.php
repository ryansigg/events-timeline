<?php
/**
 * Events list screen: a sortable "Starts" column.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'manage_' . EVTL_POST_TYPE . '_posts_columns',
	static function ( $columns ) {
		$out = array();
		foreach ( $columns as $key => $label ) {
			$out[ $key ] = $label;
			if ( 'title' === $key ) {
				$out['evtl_start'] = __( 'Starts', 'events-timeline' );
			}
		}
		return $out;
	}
);

add_action(
	'manage_' . EVTL_POST_TYPE . '_posts_custom_column',
	static function ( $column, $post_id ) {
		if ( 'evtl_start' !== $column ) {
			return;
		}
		$start = get_post_meta( $post_id, 'evtl_start', true );
		echo $start ? esc_html( evtl_format_range( $start ) ) : '<span aria-hidden="true">&ndash;</span><span class="screen-reader-text">' . esc_html__( 'No start date', 'events-timeline' ) . '</span>';
	},
	10,
	2
);

add_filter(
	'manage_edit-' . EVTL_POST_TYPE . '_sortable_columns',
	static function ( $columns ) {
		$columns['evtl_start'] = 'evtl_start';
		return $columns;
	}
);

add_action(
	'pre_get_posts',
	static function ( WP_Query $query ) {
		if ( ! is_admin() || ! $query->is_main_query() || EVTL_POST_TYPE !== $query->get( 'post_type' ) ) {
			return;
		}
		// Default and "Starts" sort: by start date. A named OR clause (instead of meta_key)
		// keeps drafts that have no start date yet in the list.
		if ( ! $query->get( 'orderby' ) || 'evtl_start' === $query->get( 'orderby' ) ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
			$query->set(
				'meta_query',
				array(
					'relation'   => 'OR',
					'evtl_start' => array( 'key' => 'evtl_start', 'compare' => 'EXISTS' ),
					array( 'key' => 'evtl_start', 'compare' => 'NOT EXISTS' ),
				)
			);
			$query->set( 'orderby', 'evtl_start' );
			if ( ! $query->get( 'order' ) ) {
				$query->set( 'order', 'DESC' );
			}
		}
	}
);
