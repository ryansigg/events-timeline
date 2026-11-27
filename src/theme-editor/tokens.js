/**
 * Turns theme tokens into the wrapper classes and custom properties the block's
 * stylesheet reads. Mirrors evtl_theme_wrapper_parts() in includes/themes.php; the
 * end-to-end tests check the two produce the same values.
 */

/** Classes a theme may add; removed before applying another. */
const THEME_CLASS =
	/^(has-evtl-theme|has-evtl-glow|is-bars-\S+|is-evtl-theme-\S+)$/;

/** Custom properties a theme may set; cleared before applying another. */
export const THEME_VARS = [
	'--evtl-surface',
	'--evtl-ink',
	'--evtl-strong',
	'--evtl-on-strong',
	'--evtl-grid-mix',
	'--evtl-line-mix',
	'--evtl-lift',
	'--evtl-radius',
	'--evtl-lane-height',
	'--evtl-font',
	'--evtl-heading-font',
	'--evtl-label-case',
	'--evtl-label-tracking',
];

/**
 * WCAG relative luminance of a #rrggbb or #rgb color.
 *
 * @param {string} hex Color.
 * @return {number} Luminance, 0 to 1.
 */
export function luminance( hex ) {
	let h = hex.replace( '#', '' );
	if ( h.length === 3 ) {
		h = h
			.split( '' )
			.map( ( c ) => c + c )
			.join( '' );
	}
	const [ r, g, b ] = [ 0, 2, 4 ].map( ( i ) => {
		const c = parseInt( h.slice( i, i + 2 ), 16 ) / 255;
		return c <= 0.03928 ? c / 12.92 : ( ( c + 0.055 ) / 1.055 ) ** 2.4;
	} );
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colors.
 *
 * @param {string} a First color.
 * @param {string} b Second color.
 * @return {number} Ratio, 1 to 21.
 */
export function contrast( a, b ) {
	const [ hi, lo ] = [ luminance( a ), luminance( b ) ].sort(
		( x, y ) => y - x
	);
	return ( hi + 0.05 ) / ( lo + 0.05 );
}

/**
 * Black or white, whichever reads better on a color. Same rule as evtl_text_on().
 *
 * @param {string} hex Background color.
 * @return {string} "#000" or "#fff".
 */
export function textOn( hex ) {
	const l = luminance( hex );
	return 1.05 / ( l + 0.05 ) >= ( l + 0.05 ) / 0.05 ? '#fff' : '#000';
}

/**
 * Classes and custom properties for a theme.
 *
 * @param {Object} tokens           Theme tokens.
 * @param {string} slug             Theme slug.
 * @param {Object} config           Font stacks and densities, from PHP.
 * @param {Object} config.fonts     Font slug => { stack }.
 * @param {Object} config.densities Density slug => row height.
 * @return {{classes: string[], vars: Object<string, string>}} What to put on the wrapper.
 */
export function wrapperParts( tokens, slug, { fonts, densities } ) {
	const heading =
		tokens.headingFont === 'same' ? tokens.font : tokens.headingFont;
	const vars = {
		'--evtl-surface': tokens.background,
		'--evtl-ink': tokens.text,
		'--evtl-strong': tokens.accent,
		'--evtl-on-strong': textOn( tokens.accent ),
		'--evtl-grid-mix': `${ tokens.grid }%`,
		'--evtl-line-mix': `${ Math.min( 60, tokens.grid * 2 ) }%`,
		'--evtl-lift': `${ tokens.lift }%`,
		'--evtl-radius': `${ tokens.radius }px`,
		'--evtl-lane-height': densities[ tokens.density ],
		'--evtl-font': fonts[ tokens.font ].stack,
		'--evtl-heading-font': fonts[ heading ].stack,
	};
	if ( tokens.labels === 'uppercase' ) {
		vars[ '--evtl-label-case' ] = 'uppercase';
		vars[ '--evtl-label-tracking' ] = '0.06em';
	}
	const classes = [ 'has-evtl-theme', `is-bars-${ tokens.bars }` ];
	if ( slug ) {
		classes.push( `is-evtl-theme-${ slug }` );
	}
	if ( tokens.glow ) {
		classes.push( 'has-evtl-glow' );
	}
	return { classes, vars };
}

/**
 * Applies a theme to a block wrapper element, replacing any theme already on it.
 *
 * @param {HTMLElement} element Block wrapper.
 * @param {Object|null} parts   Result of wrapperParts(), or null for no theme.
 */
export function applyToElement( element, parts ) {
	[ ...element.classList ]
		.filter( ( name ) => THEME_CLASS.test( name ) )
		.forEach( ( name ) => element.classList.remove( name ) );
	THEME_VARS.forEach( ( name ) => element.style.removeProperty( name ) );
	if ( ! parts ) {
		return;
	}
	element.classList.add( ...parts.classes );
	Object.entries( parts.vars ).forEach( ( [ name, value ] ) =>
		element.style.setProperty( name, value )
	);
}
