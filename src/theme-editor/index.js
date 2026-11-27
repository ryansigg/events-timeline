/**
 * Events > Timeline Themes: browse, edit, save and delete timeline themes, and set the
 * site default, with a live preview of the real block next to the controls.
 */
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { createRoot, useEffect, useMemo, useState } from '@wordpress/element';
import {
	Button,
	ColorIndicator,
	ColorPicker,
	Dropdown,
	Notice,
	Panel,
	PanelBody,
	RangeControl,
	SelectControl,
	TextControl,
	ToggleControl,
	Modal,
} from '@wordpress/components';
import { THEMES_PATH, ThemeSwatch } from '../shared/themes';
import { applyToElement, contrast, wrapperParts } from './tokens';
import './editor.scss';

const config = window.evtlThemeEditor;
const NONE = 'none';

const sameTheme = ( a, b ) =>
	!! a &&
	!! b &&
	a.name === b.name &&
	JSON.stringify( a.tokens ) === JSON.stringify( b.tokens );

/**
 * A color swatch button that opens a color picker.
 *
 * @param {Object}                  props
 * @param {string}                  props.label    Field label.
 * @param {string}                  props.value    Hex color.
 * @param {(color: string) => void} props.onChange Called with the new hex color.
 */
function ColorField( { label, value, onChange } ) {
	return (
		<Dropdown
			className="evtl-color-field"
			popoverProps={ { placement: 'left-start', offset: 36 } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					className="evtl-color-field__toggle"
					onClick={ onToggle }
					aria-expanded={ isOpen }
				>
					<ColorIndicator colorValue={ value } />
					<span className="evtl-color-field__label">{ label }</span>
					<code className="evtl-color-field__value">{ value }</code>
				</Button>
			) }
			renderContent={ () => (
				<ColorPicker
					color={ value }
					enableAlpha={ false }
					onChange={ ( color ) => onChange( color.slice( 0, 7 ) ) }
				/>
			) }
		/>
	);
}

/**
 * Contrast warnings for the theme's colors, the way the block uses them.
 *
 * @param {Object} props
 * @param {Object} props.tokens Theme tokens.
 */
function ContrastCheck( { tokens } ) {
	const text = contrast( tokens.text, tokens.background );
	const accent = contrast( tokens.accent, tokens.background );
	const ratio = ( value ) => value.toFixed( 1 );
	const problems = [];
	if ( text < 4.5 ) {
		problems.push(
			sprintf(
				/* translators: %s: contrast ratio such as 3.2. */
				__(
					'Text on the background is %s:1. Body text needs at least 4.5:1 to be readable.',
					'events-timeline'
				),
				ratio( text )
			)
		);
	}
	if ( accent < 3 ) {
		problems.push(
			sprintf(
				/* translators: %s: contrast ratio such as 2.1. */
				__(
					'The accent is %s:1 against the background. Selected buttons and the “now” line need at least 3:1 to stand out.',
					'events-timeline'
				),
				ratio( accent )
			)
		);
	}
	if ( ! problems.length ) {
		return (
			<p className="evtl-contrast is-ok">
				{ sprintf(
					/* translators: 1: text contrast ratio, 2: accent contrast ratio. */
					__(
						'Contrast: text %1$s:1, accent %2$s:1. Both pass.',
						'events-timeline'
					),
					ratio( text ),
					ratio( accent )
				) }
			</p>
		);
	}
	return (
		<Notice
			status="warning"
			isDismissible={ false }
			className="evtl-contrast"
			spokenMessage={ null }
		>
			{ problems.map( ( problem ) => (
				<p key={ problem }>{ problem }</p>
			) ) }
		</Notice>
	);
}

/**
 * The controls for one theme's tokens.
 *
 * @param {Object}                   props
 * @param {Object}                   props.tokens   Theme tokens.
 * @param {(tokens: Object) => void} props.onChange Called with changed tokens.
 */
function TokenControls( { tokens, onChange } ) {
	const set = ( key ) => ( value ) =>
		onChange( { ...tokens, [ key ]: value } );
	const fontOptions = Object.entries( config.fonts ).map(
		( [ value, font ] ) => ( { value, label: font.label } )
	);

	return (
		<Panel className="evtl-token-panel">
			<PanelBody title={ __( 'Colors', 'events-timeline' ) }>
				<div className="evtl-color-fields">
					<ColorField
						label={ __( 'Background', 'events-timeline' ) }
						value={ tokens.background }
						onChange={ set( 'background' ) }
					/>
					<ColorField
						label={ __( 'Text', 'events-timeline' ) }
						value={ tokens.text }
						onChange={ set( 'text' ) }
					/>
					<ColorField
						label={ __( 'Accent', 'events-timeline' ) }
						value={ tokens.accent }
						onChange={ set( 'accent' ) }
					/>
				</div>
				<ContrastCheck tokens={ tokens } />
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __(
						'Brighten calendar colors',
						'events-timeline'
					) }
					help={ __(
						'Lifts calendar colors toward white for dots, outlines and glows. Useful on dark backgrounds.',
						'events-timeline'
					) }
					value={ tokens.lift }
					onChange={ set( 'lift' ) }
					min={ 0 }
					max={ 60 }
					step={ 5 }
				/>
			</PanelBody>

			<PanelBody title={ __( 'Bars and grid', 'events-timeline' ) }>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Bar style', 'events-timeline' ) }
					value={ tokens.bars }
					onChange={ set( 'bars' ) }
					options={ [
						{
							value: 'solid',
							label: __( 'Solid', 'events-timeline' ),
						},
						{
							value: 'soft',
							label: __( 'Soft', 'events-timeline' ),
						},
						{
							value: 'outline',
							label: __( 'Outline', 'events-timeline' ),
						},
					] }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Glow', 'events-timeline' ) }
					checked={ tokens.glow }
					onChange={ set( 'glow' ) }
				/>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Density', 'events-timeline' ) }
					value={ tokens.density }
					onChange={ set( 'density' ) }
					options={ [
						{
							value: 'compact',
							label: __( 'Compact', 'events-timeline' ),
						},
						{
							value: 'comfortable',
							label: __( 'Comfortable', 'events-timeline' ),
						},
						{
							value: 'roomy',
							label: __( 'Roomy', 'events-timeline' ),
						},
					] }
				/>
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Corner radius (px)', 'events-timeline' ) }
					help={ __(
						'Large values turn bars into pills.',
						'events-timeline'
					) }
					value={ tokens.radius }
					onChange={ set( 'radius' ) }
					min={ 0 }
					max={ 24 }
				/>
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Grid line strength (%)', 'events-timeline' ) }
					value={ tokens.grid }
					onChange={ set( 'grid' ) }
					min={ 5 }
					max={ 40 }
				/>
			</PanelBody>

			<PanelBody title={ __( 'Type', 'events-timeline' ) }>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Font', 'events-timeline' ) }
					value={ tokens.font }
					options={ fontOptions }
					onChange={ set( 'font' ) }
				/>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Heading font', 'events-timeline' ) }
					help={ __(
						'Event titles and the date range heading.',
						'events-timeline'
					) }
					value={ tokens.headingFont }
					options={ [
						{
							value: 'same',
							label: __( 'Same as the font', 'events-timeline' ),
						},
						...fontOptions,
					] }
					onChange={ set( 'headingFont' ) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Uppercase labels', 'events-timeline' ) }
					help={ __(
						'Buttons, filters, row labels and the date scale.',
						'events-timeline'
					) }
					checked={ tokens.labels === 'uppercase' }
					onChange={ ( on ) =>
						onChange( {
							...tokens,
							labels: on ? 'uppercase' : 'normal',
						} )
					}
				/>
			</PanelBody>
		</Panel>
	);
}

/**
 * A small yes/no dialog.
 *
 * @param {Object}     props
 * @param {string}     props.title         Dialog title.
 * @param {string}     props.confirmLabel  Label of the confirming button.
 * @param {boolean}    props.isDestructive Whether confirming deletes something.
 * @param {() => void} props.onConfirm     Called when confirmed.
 * @param {() => void} props.onCancel      Called when cancelled or closed.
 * @param {Object}     props.children      Message.
 */
function ConfirmModal( {
	title,
	confirmLabel,
	isDestructive = false,
	onConfirm,
	onCancel,
	children,
} ) {
	return (
		<Modal title={ title } onRequestClose={ onCancel } size="small">
			<p>{ children }</p>
			<div className="evtl-confirm__actions">
				<Button variant="tertiary" onClick={ onCancel }>
					{ __( 'Cancel', 'events-timeline' ) }
				</Button>
				<Button
					variant="primary"
					isDestructive={ isDestructive }
					onClick={ onConfirm }
				>
					{ confirmLabel }
				</Button>
			</div>
		</Modal>
	);
}

function initialSelection() {
	const fromUrl = new URLSearchParams( window.location.search ).get(
		'theme'
	);
	const slugs = config.themes.map( ( theme ) => theme.slug );
	if ( slugs.includes( fromUrl ) ) {
		return fromUrl;
	}
	return slugs.includes( config.default ) ? config.default : slugs[ 0 ];
}

function App() {
	const [ themes, setThemes ] = useState( config.themes );
	const [ defaultSlug, setDefaultSlug ] = useState( config.default );
	const [ selected, setSelected ] = useState( initialSelection );
	const saved = themes.find( ( theme ) => theme.slug === selected );
	const [ draft, setDraft ] = useState( () => ( {
		name: saved.name,
		tokens: saved.tokens,
	} ) );
	const [ busy, setBusy ] = useState( false );
	const [ message, setMessage ] = useState( null );
	const [ pendingSelect, setPendingSelect ] = useState( null );
	const [ confirmingDelete, setConfirmingDelete ] = useState( false );
	const dirty = ! sameTheme( draft, saved );

	const preview = useMemo(
		() =>
			document.querySelector(
				'#evtl-theme-preview .wp-block-events-timeline-timeline'
			),
		[]
	);

	// Restyle the preview whenever the draft changes.
	useEffect( () => {
		if ( preview ) {
			applyToElement(
				preview,
				wrapperParts( draft.tokens, selected, config )
			);
		}
	}, [ preview, draft, selected ] );

	// Keep the selected theme in the URL, so a reload or a shared link opens it.
	useEffect( () => {
		const url = new URL( window.location.href );
		url.searchParams.set( 'theme', selected );
		window.history.replaceState( null, '', url );
	}, [ selected ] );

	useEffect( () => {
		if ( ! dirty ) {
			return;
		}
		const warn = ( event ) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ dirty ] );

	const open = ( slug, list = themes ) => {
		const theme = list.find( ( item ) => item.slug === slug );
		setSelected( slug );
		setDraft( { name: theme.name, tokens: theme.tokens } );
		setPendingSelect( null );
	};

	const request = async ( options, success, then ) => {
		setBusy( true );
		setMessage( null );
		try {
			const result = await apiFetch( options );
			setThemes( result.themes );
			setDefaultSlug( result.default );
			setMessage( { status: 'success', text: success } );
			if ( then ) {
				then( result );
			}
		} catch ( error ) {
			setMessage( {
				status: 'error',
				text:
					error.message ||
					__( 'Something went wrong. Try again.', 'events-timeline' ),
			} );
		} finally {
			setBusy( false );
		}
	};

	const saveAsNew = ( name, tokens ) =>
		request(
			{ path: THEMES_PATH, method: 'POST', data: { name, tokens } },
			/* translators: %s: theme name. */
			sprintf( __( '“%s” saved.', 'events-timeline' ), name ),
			( result ) => open( result.slug, result.themes )
		);

	const save = () =>
		request(
			{
				path: `${ THEMES_PATH }/${ selected }`,
				method: 'POST',
				data: { name: draft.name.trim(), tokens: draft.tokens },
			},
			sprintf(
				/* translators: %s: theme name. */
				__( '“%s” saved.', 'events-timeline' ),
				draft.name.trim()
			),
			( result ) => open( selected, result.themes )
		);

	const remove = () => {
		setConfirmingDelete( false );
		request(
			{ path: `${ THEMES_PATH }/${ selected }`, method: 'DELETE' },
			/* translators: %s: theme name. */
			sprintf( __( '“%s” deleted.', 'events-timeline' ), saved.name ),
			( result ) =>
				open(
					result.themes.some( ( t ) => t.slug === result.default )
						? result.default
						: result.themes[ 0 ].slug,
					result.themes
				)
		);
	};

	const setSiteDefault = ( slug ) => {
		const theme = themes.find( ( item ) => item.slug === slug );
		request(
			{
				path: `${ THEMES_PATH }/default`,
				method: 'POST',
				data: { slug },
			},
			theme
				? sprintf(
						/* translators: %s: theme name. */
						__(
							'Blocks without their own theme now use “%s”.',
							'events-timeline'
						),
						theme.name
					)
				: __(
						'Blocks without their own theme now match the site.',
						'events-timeline'
					)
		);
	};

	let copyName;
	if ( saved.builtIn ) {
		copyName = sprintf(
			/* translators: %s: built-in theme name. */
			__( '%s (custom)', 'events-timeline' ),
			saved.name
		);
	} else {
		copyName = sprintf(
			/* translators: %s: theme name. */
			__( '%s copy', 'events-timeline' ),
			draft.name.trim()
		);
	}

	return (
		<div className="evtl-theme-editor">
			<nav
				className="evtl-theme-list"
				aria-label={ __( 'Themes', 'events-timeline' ) }
			>
				<ul>
					{ themes.map( ( theme ) => (
						<li key={ theme.slug }>
							<Button
								className="evtl-theme-list__item"
								aria-current={
									theme.slug === selected ? 'true' : undefined
								}
								onClick={ () => {
									if ( theme.slug === selected ) {
										return;
									}
									if ( dirty ) {
										setPendingSelect( theme.slug );
									} else {
										open( theme.slug );
									}
								} }
							>
								<ThemeSwatch
									tokens={
										theme.slug === selected
											? draft.tokens
											: theme.tokens
									}
								/>
								<span className="evtl-theme-list__text">
									<span className="evtl-theme-list__name">
										{ theme.name }
									</span>
									<span className="evtl-theme-list__meta">
										{ theme.builtIn
											? __(
													'Built-in',
													'events-timeline'
												)
											: __(
													'Custom',
													'events-timeline'
												) }
										{ theme.slug === defaultSlug &&
											` · ${ __(
												'Site default',
												'events-timeline'
											) }` }
									</span>
								</span>
							</Button>
						</li>
					) ) }
				</ul>
				<Button
					variant="secondary"
					disabled={ busy }
					onClick={ () =>
						saveAsNew(
							__( 'New theme', 'events-timeline' ),
							config.tokenDefaults
						)
					}
				>
					{ __( 'New theme', 'events-timeline' ) }
				</Button>
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					className="evtl-theme-list__default"
					label={ __( 'Site default', 'events-timeline' ) }
					help={ __(
						'Used by every timeline block that doesn’t pick its own theme.',
						'events-timeline'
					) }
					value={ defaultSlug }
					disabled={ busy }
					options={ [
						{
							value: NONE,
							label: __(
								'No theme (match the site)',
								'events-timeline'
							),
						},
						...themes.map( ( theme ) => ( {
							value: theme.slug,
							label: theme.name,
						} ) ),
					] }
					onChange={ setSiteDefault }
				/>
			</nav>

			<div className="evtl-theme-form">
				{ message && (
					<Notice
						status={ message.status }
						onRemove={ () => setMessage( null ) }
					>
						{ message.text }
					</Notice>
				) }

				{ saved.builtIn ? (
					<div className="evtl-theme-form__builtin">
						<h2>{ saved.name }</h2>
						<p>
							{ __(
								'Built-in themes can’t be changed. Adjust anything below, then save it as a theme of your own.',
								'events-timeline'
							) }
						</p>
					</div>
				) : (
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Theme name', 'events-timeline' ) }
						value={ draft.name }
						maxLength={ 60 }
						onChange={ ( name ) => setDraft( { ...draft, name } ) }
					/>
				) }

				<TokenControls
					tokens={ draft.tokens }
					onChange={ ( tokens ) => setDraft( { ...draft, tokens } ) }
				/>

				<div className="evtl-theme-form__actions">
					{ ! saved.builtIn && (
						<Button
							variant="primary"
							isBusy={ busy }
							disabled={ busy || ! dirty || ! draft.name.trim() }
							onClick={ save }
						>
							{ __( 'Save', 'events-timeline' ) }
						</Button>
					) }
					<Button
						variant={ saved.builtIn ? 'primary' : 'secondary' }
						disabled={ busy }
						onClick={ () => saveAsNew( copyName, draft.tokens ) }
					>
						{ saved.builtIn
							? __( 'Save as my theme', 'events-timeline' )
							: __( 'Duplicate', 'events-timeline' ) }
					</Button>
					{ dirty && (
						<Button
							variant="tertiary"
							disabled={ busy }
							onClick={ () => open( selected ) }
						>
							{ __( 'Discard changes', 'events-timeline' ) }
						</Button>
					) }
					{ ! saved.builtIn && (
						<Button
							variant="tertiary"
							isDestructive
							disabled={ busy }
							onClick={ () => setConfirmingDelete( true ) }
						>
							{ __( 'Delete', 'events-timeline' ) }
						</Button>
					) }
				</div>
			</div>

			{ pendingSelect && (
				<ConfirmModal
					title={ __( 'Discard changes?', 'events-timeline' ) }
					confirmLabel={ __( 'Discard', 'events-timeline' ) }
					onConfirm={ () => open( pendingSelect ) }
					onCancel={ () => setPendingSelect( null ) }
				>
					{ __(
						'You have unsaved changes to this theme. Switching themes will discard them.',
						'events-timeline'
					) }
				</ConfirmModal>
			) }
			{ confirmingDelete && (
				<ConfirmModal
					title={ __( 'Delete theme?', 'events-timeline' ) }
					confirmLabel={ __( 'Delete', 'events-timeline' ) }
					isDestructive
					onConfirm={ remove }
					onCancel={ () => setConfirmingDelete( false ) }
				>
					{ sprintf(
						/* translators: %s: theme name. */
						__(
							'Delete “%s”? Blocks using it will switch to the site default.',
							'events-timeline'
						),
						saved.name
					) }
				</ConfirmModal>
			) }
		</div>
	);
}

const root = document.getElementById( 'evtl-theme-editor-root' );
if ( root && config ) {
	createRoot( root ).render( <App /> );
}
