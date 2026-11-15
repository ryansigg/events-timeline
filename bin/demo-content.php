<?php
/**
 * Demo events and two pages that use the Timeline block.
 * Run with WP-CLI after activating the plugin:  wp eval-file bin/demo-content.php
 *
 * Dates are relative to today, so there are always past, upcoming and live events.
 *
 * @package EventsTimeline
 */

if ( ! defined( 'WP_CLI' ) ) {
	exit( "Run this with: wp eval-file bin/demo-content.php\n" );
}

if ( get_page_by_path( 'events-demo' ) ) {
	WP_CLI::success( 'Demo content already exists.' );
	return;
}

$types = array();
foreach ( array( 'Tournament', 'Community', 'Livestream' ) as $name ) {
	$term                         = wp_insert_term( $name, EVTL_TAXONOMY );
	$types[ sanitize_title( $name ) ] = is_wp_error( $term ) ? 0 : $term['term_id'];
}

$tz = wp_timezone();
$at = static function ( $modifier, $time ) use ( $tz ) {
	return ( new DateTimeImmutable( 'today', $tz ) )->modify( $modifier )->format( 'Y-m-d' ) . 'T' . $time;
};

$live_start = ( new DateTimeImmutable( 'now', $tz ) )->setTime( (int) wp_date( 'G' ), 0 );

$events = array(
	// Past.
	array( 'Autumn Open Qualifier', 'tournament', $at( '-40 days', '10:00' ), $at( '-40 days', '18:00' ), 'Online', 'Open bracket, best of three.' ),
	array( 'Map Makers Meetup', 'community', $at( '-21 days', '18:30' ), $at( '-21 days', '20:30' ), 'Portland, OR', 'Show-and-tell for custom map creators.' ),
	array( 'Patch Notes Live', 'livestream', $at( '-7 days', '12:00' ), $at( '-7 days', '13:00' ), 'Online', 'Walkthrough of the latest balance changes.' ),
	// Happening now: started at the top of the hour, ends four hours later.
	array( 'Weekend Ladder Marathon', 'livestream', $live_start->format( 'Y-m-d\TH:i' ), $live_start->modify( '+4 hours' )->format( 'Y-m-d\TH:i' ), 'Online', 'Ranked play all afternoon, with commentary.' ),
	// Upcoming.
	array( 'Winter Invitational', 'tournament', $at( '+5 days', '09:00' ), $at( '+6 days', '17:00' ), 'Seattle, WA', 'Sixteen invited teams over two days.' ),
	array( 'New Player Night', 'community', $at( '+9 days', '19:00' ), $at( '+9 days', '21:00' ), 'Online', 'Coaching and casual games for newcomers.' ),
	array( 'Developer Q&A', 'livestream', $at( '+12 days', '11:00' ), $at( '+12 days', '12:00' ), 'Online', 'Questions from the community, answered live.' ),
	array( 'Community Cup', 'tournament', $at( '+20 days', '10:00' ), '', 'Online', 'Monthly cup for all skill levels.' ),
	array( 'Map Makers Meetup', 'community', $at( '+33 days', '18:30' ), $at( '+33 days', '20:30' ), 'Portland, OR', 'Bring a work-in-progress map for feedback.' ),
);

foreach ( $events as list( $title, $type, $start, $end, $location, $excerpt ) ) {
	$id = wp_insert_post(
		array(
			'post_type'    => EVTL_POST_TYPE,
			'post_status'  => 'publish',
			'post_title'   => $title,
			'post_excerpt' => $excerpt,
			'post_content' => "<!-- wp:paragraph -->\n<p>{$excerpt}</p>\n<!-- /wp:paragraph -->",
		)
	);
	update_post_meta( $id, 'evtl_start', $start );
	if ( $end ) {
		update_post_meta( $id, 'evtl_end', $end );
	}
	update_post_meta( $id, 'evtl_location', $location );
	wp_set_object_terms( $id, array( $types[ $type ] ), EVTL_TAXONOMY );
}

wp_insert_post(
	array(
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_title'   => 'Events',
		'post_name'    => 'events-demo',
		'post_content' => implode(
			"\n\n",
			array(
				"<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">Upcoming events</h2>\n<!-- /wp:heading -->",
				'<!-- wp:events-timeline/timeline {"layout":"horizontal","align":"wide"} /-->',
				"<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">Past events</h2>\n<!-- /wp:heading -->",
				'<!-- wp:events-timeline/timeline {"show":"past","limit":5,"showFilters":false,"showExcerpt":false} /-->',
			)
		),
	)
);

WP_CLI::success( count( $events ) . ' demo events and an Events page created.' );
