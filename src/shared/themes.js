/**
 * Shared by the block's theme picker and the theme editor: loading the theme list,
 * and a small swatch that shows what a theme looks like.
 */
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';

export const THEMES_PATH = '/events-timeline/v1/themes';

/**
 * The site's timeline themes, from the REST API.
 *
 * @return {{data: Object|null, error: Error|null, setData: (data: Object) => void}} Themes, default and editor link.
 */
export function useThemes() {
	const [ data, setData ] = useState( null );
	const [ error, setError ] = useState( null );
	useEffect( () => {
		let live = true;
		apiFetch( { path: THEMES_PATH } )
			.then( ( result ) => live && setData( result ) )
			.catch( ( err ) => live && setError( err ) );
		return () => {
			live = false;
		};
	}, [] );
	return { data, error, setData };
}

/**
 * A miniature of a theme: its background with a text line, a bar and an accent pill.
 *
 * @param {Object} props
 * @param {Object} props.tokens Theme tokens.
 */
export function ThemeSwatch( { tokens } ) {
	const radius = Math.min( tokens.radius, 6 );
	return (
		<span
			className="evtl-theme-swatch"
			aria-hidden="true"
			style={ {
				background: tokens.background,
				borderRadius: Math.min( tokens.radius, 8 ),
			} }
		>
			<span
				className="evtl-theme-swatch__line"
				style={ { background: tokens.text } }
			/>
			<span
				className="evtl-theme-swatch__bar"
				style={ {
					background:
						tokens.bars === 'solid' ? '#2f6f9f' : 'transparent',
					border: tokens.bars === 'solid' ? 0 : '1.5px solid #6fa8d6',
					borderRadius: radius,
					boxShadow: tokens.glow ? '0 0 6px #6fa8d6' : 'none',
				} }
			/>
			<span
				className="evtl-theme-swatch__pill"
				style={ { background: tokens.accent, borderRadius: radius } }
			/>
		</span>
	);
}
