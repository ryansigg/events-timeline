<?php
/**
 * Demo calendars, events, and a page that uses the Timeline block.
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

$evtl_term = static function ( $name, $taxonomy, $color = '' ) {
	$term = wp_insert_term( $name, $taxonomy );
	$id   = is_wp_error( $term ) ? (int) $term->get_error_data( 'term_exists' ) : $term['term_id'];
	if ( $color ) {
		update_term_meta( $id, 'evtl_color', $color );
	}
	return $id;
};

$calendars = array(
	'pro'       => $evtl_term( 'Pro Circuit', EVTL_CALENDAR, '#1f5f8b' ),
	'community' => $evtl_term( 'Community', EVTL_CALENDAR, '#2e7d32' ),
	'studio'    => $evtl_term( 'Studio', EVTL_CALENDAR, '#9c2f6b' ),
);
$types     = array();
foreach ( array( 'Tournament', 'Meetup', 'Livestream', 'Workshop' ) as $name ) {
	$types[ strtolower( $name ) ] = $evtl_term( $name, EVTL_TAXONOMY );
}

$tz   = wp_timezone();
$at   = static fn( $days, $time ) => ( new DateTimeImmutable( 'today', $tz ) )->modify( "{$days} days" )->format( 'Y-m-d' ) . 'T' . $time;
$live = ( new DateTimeImmutable( 'now', $tz ) )->setTime( (int) wp_date( 'G' ), 0 );

// Title, calendar, type, start, end, all day, location, excerpt.
$events = array(
	array( 'Autumn Open Qualifier', 'pro', 'tournament', $at( -40, '10:00' ), $at( -40, '18:00' ), false, 'Online', 'Open bracket, best of three.' ),
	array( 'Map Makers Meetup', 'community', 'meetup', $at( -21, '18:30' ), $at( -21, '20:30' ), false, 'Portland, OR', 'Show-and-tell for custom map creators.' ),
	array( 'Patch Notes Live', 'studio', 'livestream', $at( -7, '12:00' ), $at( -7, '13:00' ), false, 'Online', 'Walkthrough of the latest balance changes.' ),
	array( 'Weekend Ladder Marathon', 'studio', 'livestream', $live->format( 'Y-m-d\TH:i' ), $live->modify( '+4 hours' )->format( 'Y-m-d\TH:i' ), false, 'Online', 'Ranked play all afternoon, with commentary.' ),
	array( 'Qualifier Week 2', 'pro', 'tournament', $at( 4, '12:00' ), $at( 4, '20:00' ), false, 'Online', 'Last chance to qualify for the invitational.' ),
	array( 'Winter Invitational', 'pro', 'tournament', $at( 4, '09:00' ), $at( 6, '17:00' ), false, 'Seattle, WA', 'Sixteen invited teams over three days.' ),
	array( 'New Player Night', 'community', 'meetup', $at( 9, '19:00' ), $at( 9, '21:00' ), false, 'Online', 'Coaching and casual games for newcomers.' ),
	array( 'Modding Workshop', 'community', 'workshop', $at( 12, '00:00' ), $at( 12, '23:59' ), true, 'Portland, OR', 'A hands-on day building your first mod.' ),
	array( 'Developer Q&A', 'studio', 'livestream', $at( 12, '11:00' ), $at( 12, '12:00' ), false, 'Online', 'Questions from the community, answered live.' ),
	array( 'Pro League Finals', 'pro', 'tournament', $at( 18, '00:00' ), $at( 20, '23:59' ), true, 'Berlin', 'Three days of finals with the top eight teams.' ),
	array( 'Community Cup', 'community', 'tournament', $at( 20, '10:00' ), '', false, 'Online', 'Monthly cup for all skill levels.' ),
	array( 'Map Makers Meetup', 'community', 'meetup', $at( 33, '18:30' ), $at( 33, '20:30' ), false, 'Portland, OR', 'Bring a work-in-progress map for feedback.' ),
	array( 'Season Launch Stream', 'studio', 'livestream', $at( 45, '10:00' ), $at( 45, '14:00' ), false, 'Online', 'First look at the new season.' ),
);

foreach ( $events as list( $title, $calendar, $type, $start, $end, $all_day, $location, $excerpt ) ) {
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
	if ( $all_day ) {
		update_post_meta( $id, 'evtl_all_day', true );
	}
	update_post_meta( $id, 'evtl_location', $location );
	wp_set_object_terms( $id, array( $calendars[ $calendar ] ), EVTL_CALENDAR );
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
				'<!-- wp:events-timeline/timeline {"show":"all","limit":100,"align":"wide"} /-->',
				"<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">Past events</h2>\n<!-- /wp:heading -->",
				'<!-- wp:events-timeline/timeline {"show":"past","defaultView":"list","showViewToggle":false,"limit":5,"showFilters":false,"showExcerpt":false} /-->',
			)
		),
	)
);

WP_CLI::success( count( $events ) . ' demo events in 3 calendars, and an Events page, created.' );
