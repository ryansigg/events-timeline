/**
 * "Event details" panel in the block editor's document sidebar, for the Event post type.
 * Reads and writes the evtl_* fields through the REST API via the editor's entity store.
 */
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import {
	PluginDocumentSettingPanel,
	store as editorStore,
} from '@wordpress/editor';
import {
	Flex,
	Notice,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEntityProp } from '@wordpress/core-data';
import { useEffect } from '@wordpress/element';

const POST_TYPE = 'evtl_event';
const LOCK = 'evtl-missing-start';
const PANEL = 'evtl-event-details/evtl-event-details'; // "<plugin name>/<panel name>"

function EventDetailsPanel() {
	const { postType, isPanelOpen } = useSelect(
		( select ) => ( {
			postType: select( editorStore ).getCurrentPostType(),
			isPanelOpen: select( editorStore ).isEditorPanelOpened( PANEL ),
		} ),
		[]
	);
	const [ meta, setMeta ] = useEntityProp( 'postType', POST_TYPE, 'meta' );
	const { lockPostSaving, unlockPostSaving, toggleEditorPanelOpened } =
		useDispatch( editorStore );

	const isEvent = postType === POST_TYPE;
	const start = meta?.evtl_start ?? '';
	const end = meta?.evtl_end ?? '';
	const endBeforeStart = start && end && end < start;

	// A new event's required field shouldn't start out hidden in a collapsed panel.
	// Only on load, so the panel stays closed if someone closes it.
	useEffect( () => {
		if ( isEvent && ! start && ! isPanelOpen ) {
			toggleEditorPanelOpened( PANEL );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isEvent ] );

	// An event without a start date cannot appear on a timeline, so require one before saving.
	useEffect( () => {
		if ( ! isEvent ) {
			return;
		}
		if ( start ) {
			unlockPostSaving( LOCK );
		} else {
			lockPostSaving( LOCK );
		}
		return () => unlockPostSaving( LOCK );
	}, [ isEvent, start, lockPostSaving, unlockPostSaving ] );

	if ( ! isEvent ) {
		return null;
	}

	const update = ( key ) => ( value ) =>
		setMeta( { ...meta, [ key ]: value } );

	// All-day events edit dates only, stored as the start and end of those days.
	const allDay = !! meta?.evtl_all_day;
	const dateOnly = ( value ) => ( value || '' ).slice( 0, 10 );
	const setAllDay = ( value ) =>
		setMeta( {
			...meta,
			evtl_all_day: value,
			...( value && start
				? { evtl_start: `${ dateOnly( start ) }T00:00` }
				: {} ),
			...( value && end
				? { evtl_end: `${ dateOnly( end ) }T23:59` }
				: {} ),
		} );
	const dateField = ( key, time ) =>
		allDay
			? {
					type: 'date',
					value: dateOnly( meta?.[ key ] ),
					onChange: ( value ) =>
						update( key )( value ? `${ value }T${ time }` : '' ),
				}
			: {
					type: 'datetime-local',
					value: meta?.[ key ] ?? '',
					onChange: update( key ),
				};

	return (
		<PluginDocumentSettingPanel
			name="evtl-event-details"
			title={ __( 'Event details', 'events-timeline' ) }
			className="evtl-event-details"
		>
			<Flex direction="column" align="stretch" gap={ 4 }>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'All day', 'events-timeline' ) }
					help={ __(
						'Show dates only, and fill whole days on the timeline.',
						'events-timeline'
					) }
					checked={ allDay }
					onChange={ setAllDay }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					{ ...dateField( 'evtl_start', '00:00' ) }
					label={ __( 'Starts', 'events-timeline' ) }
					help={
						start
							? undefined
							: __(
									'Required before you can save.',
									'events-timeline'
								)
					}
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					{ ...dateField( 'evtl_end', '23:59' ) }
					label={ __( 'Ends', 'events-timeline' ) }
					help={ __( 'Optional.', 'events-timeline' ) }
					min={ ( allDay ? dateOnly( start ) : start ) || undefined }
				/>
				{ endBeforeStart && (
					<Notice status="warning" isDismissible={ false }>
						{ __(
							'The end is before the start.',
							'events-timeline'
						) }
					</Notice>
				) }
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Location', 'events-timeline' ) }
					help={ __(
						'A venue, a city or "Online".',
						'events-timeline'
					) }
					value={ meta?.evtl_location ?? '' }
					onChange={ update( 'evtl_location' ) }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="url"
					label={ __( 'Event link', 'events-timeline' ) }
					help={ __(
						'Optional. Tickets, registration or a stream. The timeline links here instead of the event page.',
						'events-timeline'
					) }
					value={ meta?.evtl_url ?? '' }
					onChange={ update( 'evtl_url' ) }
				/>
			</Flex>
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'evtl-event-details', { render: EventDetailsPanel } );
