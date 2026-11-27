/**
 * Theme panel for the block sidebar: pick the site default, no theme, or any saved theme.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	ExternalLink,
	Notice,
	Spinner,
} from '@wordpress/components';
import { useThemes, ThemeSwatch } from '../shared/themes';

const NONE = 'none';

/** Tokens drawn for "no theme": a plain light swatch. */
const PLAIN = {
	background: '#ffffff',
	text: '#1e1e1e',
	accent: '#1e1e1e',
	radius: 4,
	bars: 'solid',
	glow: false,
};

export default function ThemePicker( { value, onChange } ) {
	const { data, error } = useThemes();

	if ( error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ __( 'Couldn’t load timeline themes.', 'events-timeline' ) }
			</Notice>
		);
	}
	if ( ! data ) {
		return <Spinner />;
	}

	const bySlug = Object.fromEntries(
		data.themes.map( ( theme ) => [ theme.slug, theme ] )
	);
	const siteDefault = bySlug[ data.default ];
	// A deleted theme falls back to the site default on the front end; show that here too.
	const current = value === NONE || bySlug[ value ] ? value : '';

	const choices = [
		{
			value: '',
			label: __( 'Site default', 'events-timeline' ),
			detail: siteDefault
				? siteDefault.name
				: __( 'No theme', 'events-timeline' ),
			tokens: siteDefault ? siteDefault.tokens : PLAIN,
		},
		{
			value: NONE,
			label: __( 'No theme', 'events-timeline' ),
			detail: __( 'Match the site', 'events-timeline' ),
			tokens: PLAIN,
		},
		...data.themes.map( ( theme ) => ( {
			value: theme.slug,
			label: theme.name,
			detail: theme.builtIn
				? __( 'Built-in', 'events-timeline' )
				: __( 'Custom', 'events-timeline' ),
			tokens: theme.tokens,
		} ) ),
	];

	return (
		<BaseControl
			__nextHasNoMarginBottom
			id="evtl-theme-picker"
			label={ __( 'Theme', 'events-timeline' ) }
			help={
				value && ! current
					? __(
							'The theme this block used was deleted, so it uses the site default.',
							'events-timeline'
						)
					: undefined
			}
		>
			<div
				className="evtl-theme-picker"
				role="group"
				aria-label={ __( 'Timeline theme', 'events-timeline' ) }
			>
				{ choices.map( ( choice ) => (
					<Button
						key={ choice.value || 'site-default' }
						className="evtl-theme-picker__choice"
						isPressed={ current === choice.value }
						onClick={ () => onChange( choice.value ) }
						aria-label={ sprintf(
							/* translators: 1: theme name, 2: "Built-in", "Custom" or a description. */
							__( '%1$s (%2$s)', 'events-timeline' ),
							choice.label,
							choice.detail
						) }
					>
						<ThemeSwatch tokens={ choice.tokens } />
						<span className="evtl-theme-picker__text">
							<span className="evtl-theme-picker__name">
								{ choice.label }
							</span>
							<span className="evtl-theme-picker__detail">
								{ choice.detail }
							</span>
						</span>
					</Button>
				) ) }
			</div>
			{ data.canManage && (
				<p className="evtl-theme-picker__manage">
					<ExternalLink href={ data.editorUrl }>
						{ __( 'Create or edit themes', 'events-timeline' ) }
					</ExternalLink>
				</p>
			) }
		</BaseControl>
	);
}
