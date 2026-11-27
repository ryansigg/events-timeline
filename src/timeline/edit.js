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
import ThemePicker from './theme-picker';

const TAXONOMY = 'evtl_event_type';
const CALENDARS = 'evtl_calendar';

function useTerms( taxonomy ) {
	return useSelect(
		( select ) => {
			const query = {
				per_page: 100,
				hide_empty: false,
				_fields: 'id,slug,name',
			};
			return {
				terms: select( coreStore ).getEntityRecords(
					'taxonomy',
					taxonomy,
					query
				),
				isLoading: ! select( coreStore ).hasFinishedResolution(
					'getEntityRecords',
					[ 'taxonomy', taxonomy, query ]
				),
			};
		},
		[ taxonomy ]
	);
}

function TermChecklist( {
	id,
	label,
	help,
	empty,
	taxonomy,
	value,
	onChange,
} ) {
	const { terms, isLoading } = useTerms( taxonomy );
	return (
		<BaseControl
			__nextHasNoMarginBottom
			id={ id }
			label={ label }
			help={ help }
		>
			{ isLoading && <Spinner /> }
			{ ! isLoading && ! terms?.length && <p>{ empty }</p> }
			{ terms?.map( ( term ) => (
				<CheckboxControl
					__nextHasNoMarginBottom
					key={ term.id }
					label={ term.name }
					checked={ value.includes( term.slug ) }
					onChange={ ( checked ) =>
						onChange(
							checked
								? [ ...value, term.slug ]
								: value.filter( ( s ) => s !== term.slug )
						)
					}
				/>
			) ) }
		</BaseControl>
	);
}

export default function Edit( { attributes, setAttributes, name } ) {
	const {
		show,
		defaultView,
		range,
		showViewToggle,
		eventTypes,
		calendars,
		limit,
		layout,
		showFilters,
		showLocation,
		showExcerpt,
		headingLevel,
		theme,
	} = attributes;

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
						max={ 100 }
						onChange={ ( value ) =>
							setAttributes( { limit: value ?? 50 } )
						}
					/>
					<TermChecklist
						id="evtl-calendars"
						label={ __( 'Calendars', 'events-timeline' ) }
						help={ __(
							'Leave all unchecked to include every calendar.',
							'events-timeline'
						) }
						empty={ __( 'No calendars yet.', 'events-timeline' ) }
						taxonomy={ CALENDARS }
						value={ calendars }
						onChange={ ( value ) =>
							setAttributes( { calendars: value } )
						}
					/>
					<TermChecklist
						id="evtl-event-types"
						label={ __( 'Event types', 'events-timeline' ) }
						help={ __(
							'Leave all unchecked to include every type.',
							'events-timeline'
						) }
						empty={ __( 'No event types yet.', 'events-timeline' ) }
						taxonomy={ TAXONOMY }
						value={ eventTypes }
						onChange={ ( value ) =>
							setAttributes( { eventTypes: value } )
						}
					/>
				</PanelBody>

				<PanelBody title={ __( 'Views', 'events-timeline' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Opens in', 'events-timeline' ) }
						help={ __(
							'On phones the block opens in the list unless a link asks for the timeline.',
							'events-timeline'
						) }
						value={ defaultView }
						options={ [
							{
								label: __( 'Timeline', 'events-timeline' ),
								value: 'timeline',
							},
							{
								label: __( 'List', 'events-timeline' ),
								value: 'list',
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { defaultView: value } )
						}
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Timeline range', 'events-timeline' ) }
						value={ range }
						options={ [
							{
								label: __( 'Week', 'events-timeline' ),
								value: 'week',
							},
							{
								label: __( 'Month', 'events-timeline' ),
								value: 'month',
							},
							{
								label: __( 'Year', 'events-timeline' ),
								value: 'year',
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { range: value } )
						}
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Show Timeline/List switch',
							'events-timeline'
						) }
						checked={ showViewToggle }
						onChange={ ( value ) =>
							setAttributes( { showViewToggle: value } )
						}
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'List layout', 'events-timeline' ) }
						help={ __(
							'Horizontal lists switch to vertical on small screens.',
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
				</PanelBody>

				<PanelBody title={ __( 'Display', 'events-timeline' ) }>
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
						label={ __(
							'Show calendar and type filters',
							'events-timeline'
						) }
						help={ __(
							'Each set of filters appears when there is more than one choice.',
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

				<PanelBody title={ __( 'Appearance', 'events-timeline' ) }>
					<ThemePicker
						value={ theme }
						onChange={ ( value ) =>
							setAttributes( { theme: value } )
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
