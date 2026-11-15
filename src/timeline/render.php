<?php
/**
 * Server render for the Events Timeline block.
 *
 * Filtering runs on the Interactivity API. The server renders the same state the
 * client will (including a filter from ?event_type= in the URL), so a filtered
 * link works without JavaScript and nothing flashes on load.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner content (unused).
 * @var WP_Block $block      Block instance.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

$evtl_show   = in_array( $attributes['show'] ?? 'upcoming', array( 'upcoming', 'past', 'all' ), true ) ? $attributes['show'] : 'upcoming';
$evtl_layout = 'horizontal' === ( $attributes['layout'] ?? '' ) ? 'horizontal' : 'vertical';
$evtl_level  = in_array( (int) ( $attributes['headingLevel'] ?? 3 ), array( 2, 3, 4 ), true ) ? (int) $attributes['headingLevel'] : 3;
$evtl_events = evtl_get_events(
	array(
		'show'  => $evtl_show,
		'types' => $attributes['eventTypes'] ?? array(),
		'limit' => $attributes['limit'] ?? 10,
	)
);
$evtl_now = evtl_now();
$evtl_base = 'wp-block-events-timeline-timeline';

if ( ! $evtl_events ) {
	$evtl_empty = array(
		'upcoming' => __( 'No upcoming events. Check back soon.', 'events-timeline' ),
		'past'     => __( 'No past events yet.', 'events-timeline' ),
		'all'      => __( 'No events yet.', 'events-timeline' ),
	);
	printf(
		'<div %1$s><p class="%2$s__empty">%3$s</p></div>',
		get_block_wrapper_attributes( array( 'class' => "is-layout-{$evtl_layout}" ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		esc_attr( $evtl_base ),
		esc_html( $evtl_empty[ $evtl_show ] )
	);
	return;
}

// Collect each event's data and the event types actually present, in first-seen order.
$evtl_items = array();
$evtl_types = array();
foreach ( $evtl_events as $evtl_post ) {
	$evtl_terms = get_the_terms( $evtl_post, EVTL_TAXONOMY );
	$evtl_terms = is_array( $evtl_terms ) ? $evtl_terms : array();
	foreach ( $evtl_terms as $evtl_term ) {
		$evtl_types[ $evtl_term->slug ] = $evtl_term->name;
	}
	$evtl_start   = get_post_meta( $evtl_post->ID, 'evtl_start', true );
	$evtl_end     = get_post_meta( $evtl_post->ID, 'evtl_end', true );
	$evtl_items[] = array(
		'post'     => $evtl_post,
		'start'    => $evtl_start,
		'end'      => $evtl_end,
		'location' => get_post_meta( $evtl_post->ID, 'evtl_location', true ),
		'url'      => get_post_meta( $evtl_post->ID, 'evtl_url', true ),
		'terms'    => $evtl_terms,
		'slugs'    => wp_list_pluck( $evtl_terms, 'slug' ),
		'live'     => $evtl_start && $evtl_start <= $evtl_now && $evtl_end && $evtl_end >= $evtl_now,
	);
}

natcasesort( $evtl_types ); // Filter buttons in alphabetical order.

// A filter in the URL is honored only if it names a type that is on this timeline.
// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only display filter.
$evtl_requested = isset( $_GET['event_type'] ) ? sanitize_key( wp_unslash( $_GET['event_type'] ) ) : '';
$evtl_filter    = isset( $evtl_types[ $evtl_requested ] ) ? $evtl_requested : '';
$evtl_filters   = ! empty( $attributes['showFilters'] ) && count( $evtl_types ) > 1;

/* translators: 1: number of events shown, 2: total number of events. */
$evtl_status_template = __( 'Showing %1$s of %2$s events', 'events-timeline' );

// Derived state, mirrored in view.js, so the server and the browser render the same thing.
wp_interactivity_state(
	'events-timeline',
	array(
		'isActive'   => static function () {
			$ctx = wp_interactivity_get_context();
			return $ctx['filter'] === $ctx['value'];
		},
		'isHidden'   => static function () {
			$ctx = wp_interactivity_get_context();
			return '' !== $ctx['filter'] && ! in_array( $ctx['filter'], $ctx['itemTypes'], true );
		},
		'statusText' => static function () {
			$ctx   = wp_interactivity_get_context();
			$shown = '' === $ctx['filter']
				? count( $ctx['types'] )
				: count( array_filter( $ctx['types'], static fn( $t ) => in_array( $ctx['filter'], $t, true ) ) );
			return sprintf( $ctx['statusTemplate'], number_format_i18n( $shown ), number_format_i18n( count( $ctx['types'] ) ) );
		},
	)
);

$evtl_context = array(
	'filter'         => $evtl_filter,
	'param'          => 'event_type',
	'types'          => wp_list_pluck( $evtl_items, 'slugs' ),
	'labels'         => (object) $evtl_types, // Always a JSON object, even for numeric slugs.
	'statusTemplate' => $evtl_status_template,
);

$evtl_wrapper = get_block_wrapper_attributes(
	array(
		'class'               => "is-layout-{$evtl_layout}",
		'data-wp-interactive' => 'events-timeline',
		'data-wp-context'     => wp_json_encode( $evtl_context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP ),
		'data-wp-on-window--popstate' => 'actions.syncFromUrl',
	)
);
?>
<div <?php echo $evtl_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<?php if ( $evtl_filters ) : ?>
		<div class="<?php echo esc_attr( $evtl_base ); ?>__filters" role="group" aria-label="<?php esc_attr_e( 'Filter events by type', 'events-timeline' ); ?>">
			<?php foreach ( array_merge( array( '' => __( 'All', 'events-timeline' ) ), $evtl_types ) as $evtl_slug => $evtl_label ) : ?>
				<button
					type="button"
					class="<?php echo esc_attr( $evtl_base ); ?>__filter"
					data-wp-context="<?php echo esc_attr( wp_json_encode( array( 'value' => (string) $evtl_slug ) ) ); ?>"
					data-wp-on--click="actions.setFilter"
					data-wp-bind--aria-pressed="state.isActive"
				><?php echo esc_html( $evtl_label ); ?></button>
			<?php endforeach; ?>
		</div>
		<p class="<?php echo esc_attr( $evtl_base ); ?>__status" aria-live="polite" data-wp-text="state.statusText"></p>
	<?php endif; ?>

	<ol
		class="<?php echo esc_attr( $evtl_base ); ?>__list"
		<?php if ( 'horizontal' === $evtl_layout ) : ?>
			tabindex="0"
			aria-label="<?php esc_attr_e( 'Events timeline. Scroll sideways for more events.', 'events-timeline' ); ?>"
		<?php endif; ?>
	>
		<?php foreach ( $evtl_items as $evtl_item ) : ?>
			<?php
			$evtl_post    = $evtl_item['post'];
			$evtl_start_ts = evtl_timestamp( $evtl_item['start'] );
			$evtl_classes = array( "{$evtl_base}__item" );
			if ( $evtl_item['live'] ) {
				$evtl_classes[] = 'is-happening-now';
			}
			$evtl_link = $evtl_item['url'] ? $evtl_item['url'] : get_permalink( $evtl_post );
			?>
			<li
				class="<?php echo esc_attr( implode( ' ', $evtl_classes ) ); ?>"
				data-wp-context="<?php echo esc_attr( wp_json_encode( array( 'itemTypes' => array_values( $evtl_item['slugs'] ) ) ) ); ?>"
				data-wp-bind--hidden="state.isHidden"
			>
				<article class="<?php echo esc_attr( $evtl_base ); ?>__card">
					<?php if ( $evtl_start_ts ) : ?>
						<p class="<?php echo esc_attr( $evtl_base ); ?>__date">
							<time datetime="<?php echo esc_attr( wp_date( 'c', $evtl_start_ts ) ); ?>"><?php echo esc_html( evtl_format_range( $evtl_item['start'], $evtl_item['end'] ) ); ?></time>
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

					<?php if ( $evtl_item['terms'] ) : ?>
						<ul class="<?php echo esc_attr( $evtl_base ); ?>__types" aria-label="<?php esc_attr_e( 'Event type', 'events-timeline' ); ?>">
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
