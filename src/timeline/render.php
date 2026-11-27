<?php
/**
 * Server render for the Events Timeline block.
 *
 * Two views of the same events: a timeline (one row per calendar, week, month or
 * year at a time) and a list. Filters, the view and the range are kept in the URL
 * (?calendar=, ?event_type=, ?view=, ?range=), and the server renders whatever
 * the URL asks for, so shared links open exactly as they were sent.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner content (unused).
 * @var WP_Block $block      Block instance.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only display state from the URL.

$evtl_base   = 'wp-block-events-timeline-timeline';
$evtl_show   = in_array( $attributes['show'] ?? 'upcoming', array( 'upcoming', 'past', 'all' ), true ) ? $attributes['show'] : 'upcoming';
$evtl_layout = 'horizontal' === ( $attributes['layout'] ?? '' ) ? 'horizontal' : 'vertical';
$evtl_level  = in_array( (int) ( $attributes['headingLevel'] ?? 3 ), array( 2, 3, 4 ), true ) ? (int) $attributes['headingLevel'] : 3;
$evtl_events = evtl_get_events(
	array(
		'show'      => $evtl_show,
		'types'     => $attributes['eventTypes'] ?? array(),
		'calendars' => $attributes['calendars'] ?? array(),
		'limit'     => $attributes['limit'] ?? 50,
	)
);

if ( ! $evtl_events ) {
	$evtl_empty = array(
		'upcoming' => __( 'No upcoming events. Check back soon.', 'events-timeline' ),
		'past'     => __( 'No past events yet.', 'events-timeline' ),
		'all'      => __( 'No events yet.', 'events-timeline' ),
	);
	printf(
		'<div %1$s><p class="%2$s__empty">%3$s</p></div>',
		get_block_wrapper_attributes( evtl_theme_wrapper_attributes( $attributes ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		esc_attr( $evtl_base ),
		esc_html( $evtl_empty[ $evtl_show ] )
	);
	return;
}

$evtl_now_local = evtl_now();
$evtl_uid       = wp_unique_id( 'evtl-' );

// Gather everything once: display data, timeline data, and the types and calendars present.
$evtl_items     = array();
$evtl_types     = array();
$evtl_calendars = array();
foreach ( $evtl_events as $evtl_post ) {
	$evtl_terms = get_the_terms( $evtl_post, EVTL_TAXONOMY );
	$evtl_terms = is_array( $evtl_terms ) ? $evtl_terms : array();
	foreach ( $evtl_terms as $evtl_term ) {
		$evtl_types[ $evtl_term->slug ] = $evtl_term->name;
	}
	$evtl_cals = get_the_terms( $evtl_post, EVTL_CALENDAR );
	$evtl_cal  = is_array( $evtl_cals ) && $evtl_cals ? $evtl_cals[0] : null;
	if ( $evtl_cal ) {
		$evtl_color                          = evtl_calendar_color( $evtl_cal );
		$evtl_calendars[ $evtl_cal->slug ] = array(
			'name'  => $evtl_cal->name,
			'color' => $evtl_color,
			'on'    => evtl_text_on( $evtl_color ),
		);
	}

	$evtl_start   = get_post_meta( $evtl_post->ID, 'evtl_start', true );
	$evtl_end     = get_post_meta( $evtl_post->ID, 'evtl_end', true );
	$evtl_all_day = (bool) get_post_meta( $evtl_post->ID, 'evtl_all_day', true );

	// Effective span in wall minutes. All-day events cover whole days; events with
	// no end are drawn as two hours long (a whole day if all-day).
	$evtl_s = evtl_wall_minutes( $evtl_start );
	if ( $evtl_all_day ) {
		$evtl_s = $evtl_s - ( $evtl_s % EVTL_DAY );
		$evtl_e = $evtl_end ? evtl_wall_minutes( substr( $evtl_end, 0, 10 ) ) + EVTL_DAY : $evtl_s + EVTL_DAY;
	} else {
		$evtl_e = $evtl_end ? evtl_wall_minutes( $evtl_end ) : $evtl_s + 120;
	}
	$evtl_e = max( $evtl_e, $evtl_s + 30 );

	$evtl_items[] = array(
		'post'     => $evtl_post,
		'start'    => $evtl_start,
		'end'      => $evtl_end,
		'allDay'   => $evtl_all_day,
		'location' => get_post_meta( $evtl_post->ID, 'evtl_location', true ),
		'url'      => get_post_meta( $evtl_post->ID, 'evtl_url', true ),
		'terms'    => $evtl_terms,
		'calendar' => $evtl_cal,
		'live'     => $evtl_start && $evtl_start <= $evtl_now_local && ( $evtl_end ? $evtl_end >= $evtl_now_local : false ),
		'pop'      => "{$evtl_uid}-{$evtl_post->ID}",
		's'        => $evtl_s,
		'e'        => $evtl_e,
		'c'        => $evtl_cal ? $evtl_cal->slug : '',
		't'        => array_values( wp_list_pluck( $evtl_terms, 'slug' ) ),
	);
}
natcasesort( $evtl_types );
uasort( $evtl_calendars, static fn( $a, $b ) => strnatcasecmp( $a['name'], $b['name'] ) );
list( $evtl_items, $evtl_lanes ) = evtl_assign_lanes( $evtl_items );

// Timeline rows: one per calendar, plus "Other" for events without one.
$evtl_rows = array();
foreach ( $evtl_calendars as $evtl_slug => $evtl_cal_data ) {
	$evtl_rows[ $evtl_slug ] = $evtl_cal_data + array( 'lanes' => $evtl_lanes[ $evtl_slug ] ?? 1 );
}
if ( isset( $evtl_lanes[''] ) ) {
	$evtl_rows[''] = array(
		'name'  => __( 'Other', 'events-timeline' ),
		'color' => '#5a5a5a',
		'on'    => '#fff',
		'lanes' => $evtl_lanes[''],
	);
}

// Initial state: block settings, overridden by the URL when the URL names something valid.
$evtl_get   = static fn( $key ) => isset( $_GET[ $key ] ) ? sanitize_key( wp_unslash( $_GET[ $key ] ) ) : '';
$evtl_view  = in_array( $evtl_get( 'view' ), array( 'timeline', 'list' ), true ) ? $evtl_get( 'view' ) : ( 'list' === ( $attributes['defaultView'] ?? '' ) ? 'list' : 'timeline' );
$evtl_range = in_array( $evtl_get( 'range' ), array( 'week', 'month', 'year' ), true ) ? $evtl_get( 'range' ) : ( in_array( $attributes['range'] ?? '', array( 'week', 'month', 'year' ), true ) ? $attributes['range'] : 'month' );
$evtl_week  = (int) get_option( 'start_of_week', 1 );

// Open the timeline on today, unless every event is in the past (then on the latest one).
$evtl_focus = substr( $evtl_now_local, 0, 10 );
if ( 'past' === $evtl_show ) {
	$evtl_focus = substr( $evtl_items[0]['start'], 0, 10 );
}

$evtl_filters = ! empty( $attributes['showFilters'] );
$evtl_groups  = array();
if ( $evtl_filters && count( $evtl_calendars ) > 1 ) {
	$evtl_groups['calendar'] = array(
		'label' => __( 'Calendar', 'events-timeline' ),
		'aria'  => __( 'Filter by calendar', 'events-timeline' ),
		'items' => wp_list_pluck( $evtl_calendars, 'name' ),
	);
}
if ( $evtl_filters && count( $evtl_types ) > 1 ) {
	$evtl_groups['type'] = array(
		'label' => __( 'Type', 'events-timeline' ),
		'aria'  => __( 'Filter by event type', 'events-timeline' ),
		'items' => $evtl_types,
	);
}

$evtl_context = array(
	'view'      => $evtl_view,
	'range'     => $evtl_range,
	'anchor'    => evtl_window_anchor( $evtl_range, $evtl_focus, $evtl_week ),
	'weekStart' => $evtl_week,
	'now'       => evtl_wall_minutes( $evtl_now_local ),
	'calendar'  => isset( $evtl_calendars[ $evtl_get( 'calendar' ) ] ) ? $evtl_get( 'calendar' ) : '',
	'type'      => isset( $evtl_types[ $evtl_get( 'event_type' ) ] ) ? $evtl_get( 'event_type' ) : '',
	'calendars' => (object) array_map( '__return_true', $evtl_calendars ),
	'types'     => (object) array_map( '__return_true', $evtl_types ),
	'items'     => array_map(
		static fn( $i ) => array( 's' => $i['s'], 'e' => $i['e'], 'c' => $i['c'], 't' => $i['t'] ),
		$evtl_items
	),
	'strings'   => array(
		/* translators: 1: number of events shown, 2: total number of events. */
		'listStatus'      => __( 'Showing %1$s of %2$s events', 'events-timeline' ),
		/* translators: 1: number of events (1), 2: date range such as "November 2026". */
		'rangeStatusOne'  => __( '%1$s event in %2$s', 'events-timeline' ),
		/* translators: 1: number of events, 2: date range such as "November 2026". */
		'rangeStatusMany' => __( '%1$s events in %2$s', 'events-timeline' ),
	),
);

evtl_register_interactivity_state();

$evtl_json  = static fn( $data ) => wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
$evtl_dates = static fn( $i ) => evtl_format_range( $i['start'], $i['end'], $i['allDay'] );
$evtl_theme   = evtl_theme_wrapper_attributes( $attributes );
$evtl_wrapper = get_block_wrapper_attributes(
	array(
		'class'                       => trim( "is-layout-{$evtl_layout} " . ( $evtl_theme['class'] ?? '' ) ),
		'style'                       => $evtl_theme['style'] ?? '',
		'data-wp-interactive'         => 'events-timeline',
		'data-wp-context'             => $evtl_json( $evtl_context ),
		'data-wp-init'                => 'callbacks.init',
		'data-wp-on-window--popstate' => 'actions.syncFromUrl',
	)
);
?>
<div <?php echo $evtl_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<div class="<?php echo esc_attr( $evtl_base ); ?>__toolbar">
		<?php if ( ! empty( $attributes['showViewToggle'] ) ) : ?>
			<div class="<?php echo esc_attr( $evtl_base ); ?>__segmented" role="group" aria-label="<?php esc_attr_e( 'View', 'events-timeline' ); ?>">
				<?php foreach ( array( 'timeline' => __( 'Timeline', 'events-timeline' ), 'list' => __( 'List', 'events-timeline' ) ) as $evtl_value => $evtl_label ) : ?>
					<button type="button"
						data-wp-context="<?php echo esc_attr( $evtl_json( array( 'viewValue' => $evtl_value ) ) ); ?>"
						data-wp-on--click="actions.setView"
						data-wp-bind--aria-pressed="state.isViewActive"
					><?php echo esc_html( $evtl_label ); ?></button>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>

		<?php foreach ( $evtl_groups as $evtl_group => $evtl_def ) : ?>
			<div class="<?php echo esc_attr( $evtl_base ); ?>__filters" role="group" aria-label="<?php echo esc_attr( $evtl_def['aria'] ); ?>">
				<span class="<?php echo esc_attr( $evtl_base ); ?>__filters-label" aria-hidden="true"><?php echo esc_html( $evtl_def['label'] ); ?></span>
				<?php foreach ( array_merge( array( '' => __( 'All', 'events-timeline' ) ), $evtl_def['items'] ) as $evtl_slug => $evtl_label ) : ?>
					<button type="button"
						class="<?php echo esc_attr( $evtl_base ); ?>__filter"
						<?php if ( 'calendar' === $evtl_group && '' !== $evtl_slug ) : ?>
							style="--evtl-color: <?php echo esc_attr( $evtl_calendars[ $evtl_slug ]['color'] ); ?>"
						<?php endif; ?>
						data-wp-context="<?php echo esc_attr( $evtl_json( array( 'group' => $evtl_group, 'value' => (string) $evtl_slug ) ) ); ?>"
						data-wp-on--click="actions.setFilter"
						data-wp-bind--aria-pressed="state.isActive"
					><?php echo esc_html( $evtl_label ); ?></button>
				<?php endforeach; ?>
			</div>
		<?php endforeach; ?>
	</div>

	<p class="<?php echo esc_attr( $evtl_base ); ?>__status" aria-live="polite" data-wp-text="state.statusText"></p>

	<div class="<?php echo esc_attr( $evtl_base ); ?>__timeline" data-wp-bind--hidden="!state.isTimeline">
		<div class="<?php echo esc_attr( $evtl_base ); ?>__nav">
			<button type="button" class="<?php echo esc_attr( $evtl_base ); ?>__step" data-wp-on--click="actions.prev" aria-label="<?php esc_attr_e( 'Previous', 'events-timeline' ); ?>"><span aria-hidden="true">&lsaquo;</span></button>
			<p class="<?php echo esc_attr( $evtl_base ); ?>__range-label" data-wp-text="state.rangeLabel"></p>
			<button type="button" class="<?php echo esc_attr( $evtl_base ); ?>__step" data-wp-on--click="actions.next" aria-label="<?php esc_attr_e( 'Next', 'events-timeline' ); ?>"><span aria-hidden="true">&rsaquo;</span></button>
			<button type="button" class="<?php echo esc_attr( $evtl_base ); ?>__today" data-wp-on--click="actions.today"><?php esc_html_e( 'Today', 'events-timeline' ); ?></button>
			<div class="<?php echo esc_attr( $evtl_base ); ?>__segmented" role="group" aria-label="<?php esc_attr_e( 'Range', 'events-timeline' ); ?>">
				<?php foreach ( array( 'week' => __( 'Week', 'events-timeline' ), 'month' => __( 'Month', 'events-timeline' ), 'year' => __( 'Year', 'events-timeline' ) ) as $evtl_value => $evtl_label ) : ?>
					<button type="button"
						data-wp-context="<?php echo esc_attr( $evtl_json( array( 'rangeValue' => $evtl_value ) ) ); ?>"
						data-wp-on--click="actions.setRange"
						data-wp-bind--aria-pressed="state.isRangeActive"
					><?php echo esc_html( $evtl_label ); ?></button>
				<?php endforeach; ?>
			</div>
		</div>

		<div class="<?php echo esc_attr( $evtl_base ); ?>__scroller" tabindex="0" role="region" aria-label="<?php esc_attr_e( 'Timeline. Scroll sideways on small screens.', 'events-timeline' ); ?>">
			<div class="<?php echo esc_attr( $evtl_base ); ?>__grid" data-wp-class--is-year="state.isYear" data-wp-class--is-month="state.isMonth" data-wp-class--is-week="state.isWeek">
				<div class="<?php echo esc_attr( $evtl_base ); ?>__overlay" aria-hidden="true">
					<template data-wp-each--tick="state.ticks" data-wp-each-key="context.tick.key">
						<span class="<?php echo esc_attr( $evtl_base ); ?>__tick" data-wp-style--left="context.tick.left" data-wp-class--is-minor="context.tick.minor" data-wp-text="context.tick.label"></span>
					</template>
					<span class="<?php echo esc_attr( $evtl_base ); ?>__now" data-wp-bind--hidden="state.isNowHidden" data-wp-style--left="state.nowLeft"></span>
				</div>

				<?php foreach ( $evtl_rows as $evtl_slug => $evtl_row ) : ?>
					<div class="<?php echo esc_attr( $evtl_base ); ?>__row"
						style="--evtl-color: <?php echo esc_attr( $evtl_row['color'] ); ?>; --evtl-on-color: <?php echo esc_attr( $evtl_row['on'] ); ?>; --evtl-lanes: <?php echo (int) $evtl_row['lanes']; ?>"
						data-wp-context="<?php echo esc_attr( $evtl_json( array( 'row' => (string) $evtl_slug ) ) ); ?>"
						data-wp-bind--hidden="state.isRowHidden"
					>
						<p class="<?php echo esc_attr( $evtl_base ); ?>__row-label"><?php echo esc_html( $evtl_row['name'] ); ?></p>
						<div class="<?php echo esc_attr( $evtl_base ); ?>__track">
							<?php foreach ( $evtl_items as $evtl_item ) : ?>
								<?php
								if ( $evtl_item['c'] !== (string) $evtl_slug ) {
									continue;
								}
								?>
								<button type="button"
									class="<?php echo esc_attr( $evtl_base ); ?>__bar<?php echo $evtl_item['live'] ? ' is-happening-now' : ''; ?>"
									popovertarget="<?php echo esc_attr( $evtl_item['pop'] ); ?>"
									style="--evtl-lane: <?php echo (int) $evtl_item['lane']; ?>"
									data-wp-context="<?php echo esc_attr( $evtl_json( array( 's' => $evtl_item['s'], 'e' => $evtl_item['e'], 'c' => $evtl_item['c'], 't' => $evtl_item['t'] ) ) ); ?>"
									data-wp-bind--hidden="state.isBarHidden"
									data-wp-style--left="state.barLeft"
									data-wp-style--width="state.barWidth"
									data-wp-class--is-clipped-start="state.isClippedStart"
									data-wp-class--is-clipped-end="state.isClippedEnd"
									data-wp-class--is-near-end="state.isNearEnd"
								>
									<span class="<?php echo esc_attr( $evtl_base ); ?>__bar-title"><?php echo esc_html( get_the_title( $evtl_item['post'] ) ); ?></span>
									<span class="screen-reader-text">, <?php echo esc_html( $evtl_dates( $evtl_item ) ); ?></span>
								</button>
							<?php endforeach; ?>
						</div>
					</div>
				<?php endforeach; ?>
			</div>
		</div>
		<p class="<?php echo esc_attr( $evtl_base ); ?>__range-empty" data-wp-bind--hidden="state.isRangeEmptyHidden"><?php esc_html_e( 'No events in this range. Try Next or Previous.', 'events-timeline' ); ?></p>
	</div>

	<div class="<?php echo esc_attr( $evtl_base ); ?>__listview" data-wp-bind--hidden="state.isTimeline">
		<ol
			class="<?php echo esc_attr( $evtl_base ); ?>__list"
			<?php if ( 'horizontal' === $evtl_layout ) : ?>
				tabindex="0"
				aria-label="<?php esc_attr_e( 'Events timeline. Scroll sideways for more events.', 'events-timeline' ); ?>"
			<?php endif; ?>
		>
			<?php foreach ( $evtl_items as $evtl_item ) : ?>
				<?php
				$evtl_post     = $evtl_item['post'];
				$evtl_start_ts = evtl_timestamp( $evtl_item['start'] );
				$evtl_link     = $evtl_item['url'] ? $evtl_item['url'] : get_permalink( $evtl_post );
				$evtl_style    = $evtl_item['calendar'] ? '--evtl-color: ' . $evtl_calendars[ $evtl_item['c'] ]['color'] : '';
				?>
				<li
					class="<?php echo esc_attr( $evtl_base ); ?>__item<?php echo $evtl_item['live'] ? ' is-happening-now' : ''; ?>"
					<?php if ( $evtl_style ) : ?>
						style="<?php echo esc_attr( $evtl_style ); ?>"
					<?php endif; ?>
					data-wp-context="<?php echo esc_attr( $evtl_json( array( 'c' => $evtl_item['c'], 't' => $evtl_item['t'] ) ) ); ?>"
					data-wp-bind--hidden="state.isListItemHidden"
				>
					<article class="<?php echo esc_attr( $evtl_base ); ?>__card">
						<?php if ( $evtl_start_ts ) : ?>
							<p class="<?php echo esc_attr( $evtl_base ); ?>__date">
								<time datetime="<?php echo esc_attr( wp_date( $evtl_item['allDay'] ? 'Y-m-d' : 'c', $evtl_start_ts ) ); ?>"><?php echo esc_html( $evtl_dates( $evtl_item ) ); ?></time>
								<?php if ( $evtl_item['live'] ) : ?>
									<span class="<?php echo esc_attr( $evtl_base ); ?>__live"><?php esc_html_e( 'Happening now', 'events-timeline' ); ?></span>
								<?php endif; ?>
							</p>
						<?php endif; ?>

						<h<?php echo (int) $evtl_level; ?> class="<?php echo esc_attr( $evtl_base ); ?>__title">
							<a href="<?php echo esc_url( $evtl_link ); ?>"><?php echo esc_html( get_the_title( $evtl_post ) ); ?></a>
						</h<?php echo (int) $evtl_level; ?>>

						<?php if ( ! empty( $attributes['showLocation'] ) && $evtl_item['location'] ) : ?>
							<p class="<?php echo esc_attr( $evtl_base ); ?>__location">
								<span class="screen-reader-text"><?php esc_html_e( 'Location:', 'events-timeline' ); ?> </span><?php echo esc_html( $evtl_item['location'] ); ?>
							</p>
						<?php endif; ?>

						<?php if ( ! empty( $attributes['showExcerpt'] ) && has_excerpt( $evtl_post ) ) : ?>
							<p class="<?php echo esc_attr( $evtl_base ); ?>__excerpt"><?php echo esc_html( get_the_excerpt( $evtl_post ) ); ?></p>
						<?php endif; ?>

						<?php if ( $evtl_item['calendar'] || $evtl_item['terms'] ) : ?>
							<ul class="<?php echo esc_attr( $evtl_base ); ?>__types" aria-label="<?php esc_attr_e( 'Calendar and event type', 'events-timeline' ); ?>">
								<?php if ( $evtl_item['calendar'] ) : ?>
									<li class="is-calendar"><?php echo esc_html( $evtl_item['calendar']->name ); ?></li>
								<?php endif; ?>
								<?php foreach ( $evtl_item['terms'] as $evtl_term ) : ?>
									<li><?php echo esc_html( $evtl_term->name ); ?></li>
								<?php endforeach; ?>
							</ul>
						<?php endif; ?>
					</article>
				</li>
			<?php endforeach; ?>
		</ol>
	</div>

	<?php foreach ( $evtl_items as $evtl_item ) : ?>
		<?php
		$evtl_post = $evtl_item['post'];
		$evtl_link = $evtl_item['url'] ? $evtl_item['url'] : get_permalink( $evtl_post );
		$evtl_ext  = (bool) $evtl_item['url'];
		?>
		<div
			id="<?php echo esc_attr( $evtl_item['pop'] ); ?>"
			class="<?php echo esc_attr( $evtl_base ); ?>__popover"
			popover
			role="dialog"
			aria-labelledby="<?php echo esc_attr( $evtl_item['pop'] ); ?>-title"
			<?php if ( $evtl_item['calendar'] ) : ?>
				style="--evtl-color: <?php echo esc_attr( $evtl_calendars[ $evtl_item['c'] ]['color'] ); ?>"
			<?php endif; ?>
		>
			<button type="button" class="<?php echo esc_attr( $evtl_base ); ?>__close" popovertarget="<?php echo esc_attr( $evtl_item['pop'] ); ?>" popovertargetaction="hide" aria-label="<?php esc_attr_e( 'Close', 'events-timeline' ); ?>"><span aria-hidden="true">&times;</span></button>
			<?php if ( $evtl_item['calendar'] ) : ?>
				<p class="<?php echo esc_attr( $evtl_base ); ?>__popover-calendar"><?php echo esc_html( $evtl_item['calendar']->name ); ?></p>
			<?php endif; ?>
			<p class="<?php echo esc_attr( $evtl_base ); ?>__popover-title" id="<?php echo esc_attr( $evtl_item['pop'] ); ?>-title"><?php echo esc_html( get_the_title( $evtl_post ) ); ?></p>
			<p class="<?php echo esc_attr( $evtl_base ); ?>__date"><?php echo esc_html( $evtl_dates( $evtl_item ) ); ?>
				<?php if ( $evtl_item['live'] ) : ?>
					<span class="<?php echo esc_attr( $evtl_base ); ?>__live"><?php esc_html_e( 'Happening now', 'events-timeline' ); ?></span>
				<?php endif; ?>
			</p>
			<dl class="<?php echo esc_attr( $evtl_base ); ?>__facts">
				<?php if ( $evtl_item['location'] ) : ?>
					<dt><?php esc_html_e( 'Location', 'events-timeline' ); ?></dt><dd><?php echo esc_html( $evtl_item['location'] ); ?></dd>
				<?php endif; ?>
				<?php if ( $evtl_item['terms'] ) : ?>
					<dt><?php esc_html_e( 'Type', 'events-timeline' ); ?></dt><dd><?php echo esc_html( implode( ', ', wp_list_pluck( $evtl_item['terms'], 'name' ) ) ); ?></dd>
				<?php endif; ?>
			</dl>
			<?php if ( has_excerpt( $evtl_post ) ) : ?>
				<p class="<?php echo esc_attr( $evtl_base ); ?>__excerpt"><?php echo esc_html( get_the_excerpt( $evtl_post ) ); ?></p>
			<?php endif; ?>
			<a class="<?php echo esc_attr( $evtl_base ); ?>__more" href="<?php echo esc_url( $evtl_link ); ?>"<?php echo $evtl_ext ? ' rel="noopener"' : ''; ?>>
				<?php echo $evtl_ext ? esc_html__( 'More info', 'events-timeline' ) : esc_html__( 'Event details', 'events-timeline' ); ?>
			</a>
		</div>
	<?php endforeach; ?>
</div>
