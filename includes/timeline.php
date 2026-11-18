<?php
/**
 * Timeline math and the block's server-side Interactivity state.
 *
 * Times are "wall clock" minutes: the site-local date and time, counted as if it
 * were UTC. That keeps the PHP here and the JavaScript in view.js in exact
 * agreement, whatever time zone the visitor's browser is in.
 *
 * Every derived value below has a twin getter in src/timeline/view.js. WordPress
 * evaluates these while rendering, so the first page load arrives already laid
 * out; the browser then takes over with identical results.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

const EVTL_DAY = 1440; // Minutes in a day.

/**
 * @return DateTimeZone
 */
function evtl_utc() {
	static $utc = null;
	return $utc ? $utc : ( $utc = new DateTimeZone( 'UTC' ) );
}

/**
 * Wall-clock minutes for "Y-m-d\TH:i" or "Y-m-d".
 *
 * @param string $local Local date (and time).
 * @return int|null
 */
function evtl_wall_minutes( $local ) {
	$format = strlen( (string) $local ) > 10 ? '!Y-m-d\TH:i' : '!Y-m-d';
	$date   = DateTimeImmutable::createFromFormat( $format, (string) $local, evtl_utc() );
	return $date ? intdiv( $date->getTimestamp(), 60 ) : null;
}

/**
 * The first day of the week, month or year window that contains a date.
 *
 * @param string $range      "week", "month" or "year".
 * @param string $ymd        Any date in the window, "Y-m-d".
 * @param int    $week_start 0 (Sunday) to 6, from the site's settings.
 * @return string "Y-m-d"
 */
function evtl_window_anchor( $range, $ymd, $week_start ) {
	$date = DateTimeImmutable::createFromFormat( '!Y-m-d', $ymd, evtl_utc() );
	if ( 'year' === $range ) {
		return $date->format( 'Y-01-01' );
	}
	if ( 'month' === $range ) {
		return $date->format( 'Y-m-01' );
	}
	$back = ( (int) $date->format( 'w' ) - $week_start + 7 ) % 7;
	return $date->modify( "-{$back} days" )->format( 'Y-m-d' );
}

/**
 * Move a window anchor by one week, month or year.
 *
 * @param string $range  Range.
 * @param string $anchor Window start.
 * @param int    $steps  Positive or negative number of windows.
 * @return string
 */
function evtl_shift_anchor( $range, $anchor, $steps ) {
	$date = DateTimeImmutable::createFromFormat( '!Y-m-d', $anchor, evtl_utc() );
	return $date->modify( sprintf( '%+d %s', $steps, $range ) )->format( 'Y-m-d' );
}

/**
 * Window start and end (exclusive), in wall minutes.
 *
 * @param string $range  Range.
 * @param string $anchor Window start.
 * @return int[]
 */
function evtl_window_bounds( $range, $anchor ) {
	return array( evtl_wall_minutes( $anchor ), evtl_wall_minutes( evtl_shift_anchor( $range, $anchor, 1 ) ) );
}

/**
 * Where an event sits on the timeline. In month and year views it snaps to whole
 * days so short events stay visible and line up with the day grid.
 *
 * @param int    $s     Start, wall minutes.
 * @param int    $e     End, wall minutes.
 * @param string $range Range.
 * @return int[]
 */
function evtl_span( $s, $e, $range ) {
	if ( 'week' !== $range ) {
		$s = $s - ( ( $s % EVTL_DAY ) + EVTL_DAY ) % EVTL_DAY;
		$e = (int) ( ceil( $e / EVTL_DAY ) * EVTL_DAY );
	}
	return array( $s, max( $e, $s + 1 ) );
}

/**
 * Date format in UTC, so wall minutes print as the stored local time.
 *
 * @param string $format  PHP date format.
 * @param int    $minutes Wall minutes.
 * @return string
 */
function evtl_wall_format( $format, $minutes ) {
	return wp_date( $format, $minutes * 60, evtl_utc() );
}

/**
 * Heading for the current window: "Nov 16 – Nov 22, 2026", "November 2026" or "2026".
 *
 * @param string $range  Range.
 * @param string $anchor Window start.
 * @return string
 */
function evtl_range_label( $range, $anchor ) {
	list( $ws, $we ) = evtl_window_bounds( $range, $anchor );
	if ( 'year' === $range ) {
		return evtl_wall_format( 'Y', $ws );
	}
	if ( 'month' === $range ) {
		return evtl_wall_format( 'F Y', $ws );
	}
	return evtl_wall_format( 'M j', $ws ) . ' – ' . evtl_wall_format( 'M j, Y', $we - EVTL_DAY );
}

/**
 * Scale ticks for the window: days for week and month, months for year.
 *
 * @param string $range  Range.
 * @param string $anchor Window start.
 * @return array<int, array{key: string, label: string, left: string, minor: bool}>
 */
function evtl_ticks( $range, $anchor ) {
	list( $ws, $we ) = evtl_window_bounds( $range, $anchor );
	$total           = $we - $ws;
	$ticks           = array();
	if ( 'year' === $range ) {
		for ( $m = 0; $m < 12; $m++ ) {
			$at      = evtl_wall_minutes( evtl_shift_anchor( 'month', $anchor, $m ) );
			$ticks[] = array(
				'key'   => (string) $m,
				'label' => evtl_wall_format( 'M', $at ),
				'left'  => evtl_percent( ( $at - $ws ) / $total ),
				'minor' => false,
			);
		}
		return $ticks;
	}
	$days = intdiv( $total, EVTL_DAY );
	for ( $d = 0; $d < $days; $d++ ) {
		$at      = $ws + $d * EVTL_DAY;
		$ticks[] = array(
			'key'   => (string) $d,
			'label' => 'week' === $range ? evtl_wall_format( 'D j', $at ) : (string) ( $d + 1 ),
			'left'  => evtl_percent( $d / $days ),
			'minor' => 'month' === $range && 1 === $d % 2,
		);
	}
	return $ticks;
}

/**
 * CSS percentage with the same rounding as view.js.
 *
 * @param float $fraction 0 to 1.
 * @return string
 */
function evtl_percent( $fraction ) {
	return ( round( $fraction * 100000 ) / 1000 ) . '%';
}

/**
 * Stack overlapping events within each calendar row into lanes. Uses whole-day
 * spans, and reserves at least five days per event so a short event's title,
 * which can extend past its bar, never runs into the next event in its lane.
 *
 * @param array $items Items with "c" (calendar), "s" and "e".
 * @return array Same items with "lane" set; plus "lanes" per calendar under the key "_lanes".
 */
function evtl_assign_lanes( array $items ) {
	$lane_ends = array();
	$order     = array_keys( $items );
	usort( $order, static fn( $a, $b ) => $items[ $a ]['s'] <=> $items[ $b ]['s'] );
	foreach ( $order as $i ) {
		list( $s, $e ) = evtl_span( $items[ $i ]['s'], $items[ $i ]['e'], 'month' );
		$e             = max( $e, $s + 5 * EVTL_DAY );
		$cal           = $items[ $i ]['c'];
		$lanes         = $lane_ends[ $cal ] ?? array();
		$lane          = 0;
		while ( isset( $lanes[ $lane ] ) && $lanes[ $lane ] > $s ) {
			++$lane;
		}
		$lanes[ $lane ]       = $e;
		$lane_ends[ $cal ]    = $lanes;
		$items[ $i ]['lane']  = $lane;
	}
	$counts = array();
	foreach ( $lane_ends as $cal => $lanes ) {
		$counts[ $cal ] = count( $lanes );
	}
	return array( $items, $counts );
}

/**
 * Derived state for the block, evaluated by WordPress while rendering.
 * Mirrors the getters in src/timeline/view.js.
 */
function evtl_register_interactivity_state() {
	$ctx      = static fn() => wp_interactivity_get_context();
	$window   = static function () use ( $ctx ) {
		$c = $ctx();
		return evtl_window_bounds( $c['range'], $c['anchor'] );
	};
	$matches  = static function ( $c ) {
		return ( '' === $c['calendar'] || $c['c'] === $c['calendar'] )
			&& ( '' === $c['type'] || in_array( $c['type'], $c['t'], true ) );
	};
	$in_view  = static function ( $c, $s, $e ) use ( $window ) {
		list( $ws, $we ) = $window();
		list( $s, $e )   = evtl_span( $s, $e, $c['range'] );
		return $e > $ws && $s < $we;
	};
	$visible  = static function () use ( $ctx, $in_view ) {
		$c = $ctx();
		return array_values(
			array_filter(
				$c['items'],
				static fn( $i ) => ( '' === $c['calendar'] || $i['c'] === $c['calendar'] )
					&& ( '' === $c['type'] || in_array( $c['type'], $i['t'], true ) )
			)
		);
	};

	wp_interactivity_state(
		'events-timeline',
		array(
			'isTimeline'       => static fn() => 'timeline' === $ctx()['view'],
			'isYear'           => static fn() => 'year' === $ctx()['range'],
			'isMonth'          => static fn() => 'month' === $ctx()['range'],
			'isWeek'           => static fn() => 'week' === $ctx()['range'],
			'isActive'         => static fn() => $ctx()[ $ctx()['group'] ] === $ctx()['value'],
			'isViewActive'     => static fn() => $ctx()['view'] === $ctx()['viewValue'],
			'isRangeActive'    => static fn() => $ctx()['range'] === $ctx()['rangeValue'],
			'isListItemHidden' => static fn() => ! $matches( $ctx() ),
			'isRowHidden'      => static fn() => '' !== $ctx()['calendar'] && $ctx()['row'] !== $ctx()['calendar'],
			'isBarHidden'      => static function () use ( $ctx, $matches, $in_view ) {
				$c = $ctx();
				return ! $matches( $c ) || ! $in_view( $c, $c['s'], $c['e'] );
			},
			'barLeft'          => static function () use ( $ctx, $window ) {
				$c               = $ctx();
				list( $ws, $we ) = $window();
				list( $s )       = evtl_span( $c['s'], $c['e'], $c['range'] );
				return evtl_percent( ( max( $s, $ws ) - $ws ) / ( $we - $ws ) );
			},
			'barWidth'         => static function () use ( $ctx, $window ) {
				$c               = $ctx();
				list( $ws, $we ) = $window();
				list( $s, $e )   = evtl_span( $c['s'], $c['e'], $c['range'] );
				return evtl_percent( ( min( $e, $we ) - max( $s, $ws ) ) / ( $we - $ws ) );
			},
			'isClippedStart'   => static function () use ( $ctx, $window ) {
				$c = $ctx();
				return evtl_span( $c['s'], $c['e'], $c['range'] )[0] < $window()[0];
			},
			'isNearEnd'        => static function () use ( $ctx, $window ) {
				$c               = $ctx();
				list( $ws, $we ) = $window();
				list( $s )       = evtl_span( $c['s'], $c['e'], $c['range'] );
				return ( max( $s, $ws ) - $ws ) / ( $we - $ws ) > 0.8;
			},
			'isClippedEnd'     => static function () use ( $ctx, $window ) {
				$c = $ctx();
				return evtl_span( $c['s'], $c['e'], $c['range'] )[1] > $window()[1];
			},
			'ticks'            => static fn() => evtl_ticks( $ctx()['range'], $ctx()['anchor'] ),
			'rangeLabel'       => static fn() => evtl_range_label( $ctx()['range'], $ctx()['anchor'] ),
			'isNowHidden'      => static function () use ( $ctx, $window ) {
				list( $ws, $we ) = $window();
				return $ctx()['now'] < $ws || $ctx()['now'] >= $we;
			},
			'nowLeft'          => static function () use ( $ctx, $window ) {
				list( $ws, $we ) = $window();
				return evtl_percent( ( $ctx()['now'] - $ws ) / ( $we - $ws ) );
			},
			'isRangeEmptyHidden' => static function () use ( $ctx, $visible, $in_view ) {
				$c = $ctx();
				if ( 'timeline' !== $c['view'] ) {
					return true;
				}
				foreach ( $visible() as $i ) {
					if ( $in_view( $c, $i['s'], $i['e'] ) ) {
						return true;
					}
				}
				return false;
			},
			'statusText'       => static function () use ( $ctx, $visible, $in_view ) {
				$c       = $ctx();
				$matched = $visible();
				if ( 'timeline' !== $c['view'] ) {
					return sprintf( $c['strings']['listStatus'], number_format_i18n( count( $matched ) ), number_format_i18n( count( $c['items'] ) ) );
				}
				$n = count( array_filter( $matched, static fn( $i ) => $in_view( $c, $i['s'], $i['e'] ) ) );
				return sprintf(
					1 === $n ? $c['strings']['rangeStatusOne'] : $c['strings']['rangeStatusMany'],
					number_format_i18n( $n ),
					evtl_range_label( $c['range'], $c['anchor'] )
				);
			},
		)
	);
}
