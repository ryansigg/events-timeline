import { __ } from '@wordpress/i18n';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	CheckboxControl,
	PanelBody,
	RangeControl,
	SelectControl,
	Spinner,
	ToggleControl,
	BaseControl,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import ServerSideRender from '@wordpress/server-side-render';

const TAXONOMY = 'evtl_event_type';

export default function Edit( { attributes, setAttributes, name } ) {
	const {
		show,
		eventTypes,
		limit,
		layout,
		showFilters,
		showLocation,
		showExcerpt,
		headingLevel,
	} = attributes;

	const { terms, isLoading } = useSelect( ( select ) => {
		const query = {
			per_page: 100,
			hide_empty: false,
			_fields: 'id,slug,name',
		};
		return {
			terms: select( coreStore ).getEntityRecords(
				'taxonomy',
				TAXONOMY,
				query
			),
			isLoading: ! select( coreStore ).hasFinishedResolution(
				'getEntityRecords',
				[ 'taxonomy', TAXONOMY, query ]
			),
		};
	}, [] );

	const toggleType = ( slug, checked ) =>
		setAttributes( {
			eventTypes: checked
				? [ ...eventTypes, slug ]
				: eventTypes.filter( ( s ) => s !== slug ),
		} );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Events', 'events-timeline' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Show', 'events-timeline' ) }
						value={ show }
						options={ [
							{
								label: __(
									'Upcoming events',
									'events-timeline'
								),
								value: 'upcoming',
							},
							{
								label: __( 'Past events', 'events-timeline' ),
								value: 'past',
							},
							{
								label: __( 'All events', 'events-timeline' ),
								value: 'all',
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { show: value } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Maximum number of events',
							'events-timeline'
						) }
						value={ limit }
						min={ 1 }
						max={ 50 }
						onChange={ ( value ) =>
							setAttributes( { limit: value ?? 10 } )
						}
					/>
					<BaseControl
						__nextHasNoMarginBottom
						id="evtl-event-types"
						label={ __( 'Event types', 'events-timeline' ) }
						help={ __(
							'Leave all unchecked to include every type.',
							'events-timeline'
						) }
					>
						{ isLoading && <Spinner /> }
						{ ! isLoading && ! terms?.length && (
							<p>
								{ __(
									'No event types yet.',
									'events-timeline'
								) }
							</p>
						) }
						{ terms?.map( ( term ) => (
							<CheckboxControl
								__nextHasNoMarginBottom
								key={ term.id }
								label={ term.name }
								checked={ eventTypes.includes( term.slug ) }
								onChange={ ( checked ) =>
									toggleType( term.slug, checked )
								}
							/>
						) ) }
					</BaseControl>
				</PanelBody>

				<PanelBody title={ __( 'Display', 'events-timeline' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Layout', 'events-timeline' ) }
						help={ __(
							'Horizontal timelines switch to a vertical list on small screens.',
							'events-timeline'
						) }
						value={ layout }
						options={ [
							{
								label: __( 'Vertical', 'events-timeline' ),
								value: 'vertical',
							},
							{
								label: __( 'Horizontal', 'events-timeline' ),
								value: 'horizontal',
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { layout: value } )
						}
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Event title heading level',
							'events-timeline'
						) }
						help={ __(
							'Pick the level that fits under the heading above the timeline.',
							'events-timeline'
						) }
						value={ String( headingLevel ) }
						options={ [ 2, 3, 4 ].map( ( level ) => ( {
							label: `H${ level }`,
							value: String( level ),
						} ) ) }
						onChange={ ( value ) =>
							setAttributes( { headingLevel: Number( value ) } )
						}
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show type filters', 'events-timeline' ) }
						help={ __(
							'Shown when the timeline has more than one event type.',
							'events-timeline'
						) }
						checked={ showFilters }
						onChange={ ( value ) =>
							setAttributes( { showFilters: value } )
						}
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show location', 'events-timeline' ) }
						checked={ showLocation }
						onChange={ ( value ) =>
							setAttributes( { showLocation: value } )
						}
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show excerpt', 'events-timeline' ) }
						checked={ showExcerpt }
						onChange={ ( value ) =>
							setAttributes( { showExcerpt: value } )
						}
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...useBlockProps( { className: 'evtl-editor-preview' } ) }>
				<ServerSideRender
					block={ name }
					attributes={ attributes }
					skipBlockSupportAttributes
				/>
			</div>
		</>
	);
}
