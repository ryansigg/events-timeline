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
import { Flex, Notice, TextControl } from '@wordpress/components';
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

	return (
		<PluginDocumentSettingPanel
			name="evtl-event-details"
			title={ __( 'Event details', 'events-timeline' ) }
			className="evtl-event-details"
		>
			<Flex direction="column" align="stretch" gap={ 4 }>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="datetime-local"
					label={ __( 'Starts', 'events-timeline' ) }
					help={
						start
							? undefined
							: __(
									'Required before you can save.',
									'events-timeline'
								)
					}
					value={ start }
					onChange={ update( 'evtl_start' ) }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="datetime-local"
					label={ __( 'Ends', 'events-timeline' ) }
					help={ __( 'Optional.', 'events-timeline' ) }
					min={ start || undefined }
					value={ end }
					onChange={ update( 'evtl_end' ) }
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
