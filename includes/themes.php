<?php
/**
 * Timeline themes: three built-in looks, custom themes saved site-wide, and a site default.
 *
 * A theme is a small set of design tokens (colors, corner radius, density, fonts, bar
 * style). The block's stylesheet reads them as CSS custom properties, so applying a theme
 * is just a few variables and classes on the block's wrapper. With no theme the block
 * takes its colors from the site's theme, as it always has.
 *
 * Custom themes live in one option, the site default in another. The theme editor
 * (src/theme-editor) reads and writes them through the REST routes at the end of this file.
 *
 * @package EventsTimeline
 */

defined( 'ABSPATH' ) || exit;

/** Option holding custom themes, slug => array( 'name' => ..., 'tokens' => ... ). */
const EVTL_THEMES_OPTION = 'evtl_timeline_themes';

/** Option holding the slug of the theme blocks use when they don't pick one. */
const EVTL_DEFAULT_THEME_OPTION = 'evtl_default_timeline_theme';

/** Slug meaning "no theme": the block inherits the site's look. */
const EVTL_NO_THEME = 'none';

/**
 * Font stacks a theme can choose from. System fonts only, so themes load nothing extra.
 *
 * @return array<string, array{label: string, stack: string}>
 */
function evtl_theme_fonts() {
	return array(
		'inherit'   => array(
			'label' => __( 'Site font', 'events-timeline' ),
			'stack' => 'inherit',
		),
		'system'    => array(
			'label' => __( 'System sans-serif', 'events-timeline' ),
			'stack' => 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
		),
		'condensed' => array(
			'label' => __( 'Condensed', 'events-timeline' ),
			'stack' => '"Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
		),
		'rounded'   => array(
			'label' => __( 'Rounded', 'events-timeline' ),
			'stack' => 'ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif',
		),
		'serif'     => array(
			'label' => __( 'Serif', 'events-timeline' ),
			'stack' => '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
		),
		'mono'      => array(
			'label' => __( 'Monospace', 'events-timeline' ),
			'stack' => 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
		),
	);
}

/**
 * Row heights for each density, in rem.
 *
 * @return array<string, string>
 */
function evtl_theme_densities() {
	return array(
		'compact'     => '1.875rem',
		'comfortable' => '2.25rem',
		'roomy'       => '2.75rem',
	);
}

/**
 * Every token, with the value used when a theme leaves it out.
 *
 * @return array<string, mixed>
 */
function evtl_theme_token_defaults() {
	return array(
		'background'  => '#ffffff',
		'text'        => '#1e1e1e',
		'accent'      => '#1e1e1e',
		'grid'        => 15,
		'lift'        => 0,
		'radius'      => 6,
		'density'     => 'comfortable',
		'font'        => 'inherit',
		'headingFont' => 'same',
		'bars'        => 'solid',
		'glow'        => false,
		'labels'      => 'normal',
	);
}

/**
 * The built-in themes. They can be duplicated and edited, but not changed or deleted.
 *
 * @return array<string, array{name: string, tokens: array<string, mixed>}>
 */
function evtl_builtin_themes() {
	return array(
		'broadcast' => array(
			'name'   => __( 'Broadcast', 'events-timeline' ),
			'tokens' => array(
				'background'  => '#0e1320',
				'text'        => '#e9edf5',
				'accent'      => '#f2b705',
				'grid'        => 16,
				'lift'        => 10,
				'radius'      => 2,
				'density'     => 'compact',
				'font'        => 'condensed',
				'headingFont' => 'same',
				'bars'        => 'solid',
				'glow'        => false,
				'labels'      => 'uppercase',
			),
		),
		'paper'     => array(
			'name'   => __( 'Paper', 'events-timeline' ),
			'tokens' => array(
				'background'  => '#faf7f0',
				'text'        => '#2a2520',
				'accent'      => '#9a3412',
				'grid'        => 12,
				'lift'        => 0,
				'radius'      => 4,
				'density'     => 'roomy',
				'font'        => 'serif',
				'headingFont' => 'same',
				'bars'        => 'soft',
				'glow'        => false,
				'labels'      => 'normal',
			),
		),
		'neon'      => array(
			'name'   => __( 'Neon', 'events-timeline' ),
			'tokens' => array(
				'background'  => '#08070f',
				'text'        => '#f1f0ff',
				'accent'      => '#22d3ee',
				'grid'        => 14,
				'lift'        => 45,
				'radius'      => 24,
				'density'     => 'comfortable',
				'font'        => 'system',
				'headingFont' => 'mono',
				'bars'        => 'outline',
				'glow'        => true,
				'labels'      => 'normal',
			),
		),
	);
}

/**
 * Cleans a set of tokens: unknown keys dropped, bad values replaced by the defaults.
 *
 * @param mixed $tokens Raw tokens, e.g. from a REST request.
 * @return array<string, mixed> A complete, safe token set.
 */
function evtl_sanitize_theme_tokens( $tokens ) {
	$tokens   = is_array( $tokens ) ? $tokens : array();
	$defaults = evtl_theme_token_defaults();
	$clean    = array();

	foreach ( array( 'background', 'text', 'accent' ) as $key ) {
		$color         = isset( $tokens[ $key ] ) ? sanitize_hex_color( (string) $tokens[ $key ] ) : '';
		$clean[ $key ] = $color ? strtolower( $color ) : $defaults[ $key ];
	}

	$clean['grid']   = isset( $tokens['grid'] ) && is_numeric( $tokens['grid'] ) ? max( 5, min( 40, (int) $tokens['grid'] ) ) : $defaults['grid'];
	$clean['lift']   = isset( $tokens['lift'] ) && is_numeric( $tokens['lift'] ) ? max( 0, min( 60, (int) $tokens['lift'] ) ) : $defaults['lift'];
	$clean['radius'] = isset( $tokens['radius'] ) && is_numeric( $tokens['radius'] ) ? max( 0, min( 24, (int) $tokens['radius'] ) ) : $defaults['radius'];

	$choices = array(
		'density'     => array_keys( evtl_theme_densities() ),
		'font'        => array_keys( evtl_theme_fonts() ),
		'headingFont' => array_merge( array( 'same' ), array_keys( evtl_theme_fonts() ) ),
		'bars'        => array( 'solid', 'soft', 'outline' ),
		'labels'      => array( 'normal', 'uppercase' ),
	);
	foreach ( $choices as $key => $allowed ) {
		$value         = isset( $tokens[ $key ] ) ? (string) $tokens[ $key ] : '';
		$clean[ $key ] = in_array( $value, $allowed, true ) ? $value : $defaults[ $key ];
	}

	$clean['glow'] = ! empty( $tokens['glow'] ) && 'false' !== $tokens['glow'];

	return $clean;
}

/**
 * Custom themes saved on this site.
 *
 * @return array<string, array{name: string, tokens: array<string, mixed>}>
 */
function evtl_custom_themes() {
	$saved  = get_option( EVTL_THEMES_OPTION, array() );
	$themes = array();
	foreach ( is_array( $saved ) ? $saved : array() as $slug => $theme ) {
		if ( is_array( $theme ) && ! empty( $theme['name'] ) ) {
			$themes[ (string) $slug ] = array(
				'name'   => (string) $theme['name'],
				'tokens' => evtl_sanitize_theme_tokens( $theme['tokens'] ?? array() ),
			);
		}
	}
	return $themes;
}

/**
 * All themes, built-in first.
 *
 * @return array<string, array{name: string, tokens: array<string, mixed>, builtIn: bool}>
 */
function evtl_all_themes() {
	$themes = array();
	foreach ( evtl_builtin_themes() as $slug => $theme ) {
		$themes[ $slug ] = array(
			'name'    => $theme['name'],
			'tokens'  => evtl_sanitize_theme_tokens( $theme['tokens'] ),
			'builtIn' => true,
		);
	}
	foreach ( evtl_custom_themes() as $slug => $theme ) {
		$themes[ $slug ] = $theme + array( 'builtIn' => false );
	}
	return $themes;
}

/**
 * The site default theme's slug, or "none".
 *
 * @return string
 */
function evtl_default_theme() {
	$slug = (string) get_option( EVTL_DEFAULT_THEME_OPTION, EVTL_NO_THEME );
	return isset( evtl_all_themes()[ $slug ] ) ? $slug : EVTL_NO_THEME;
}

/**
 * The theme a block should use: its own choice if that still exists, else the site default.
 *
 * @param string $choice The block's "theme" attribute; empty means "site default".
 * @return array{slug: string, tokens: array<string, mixed>}|null Null for no theme.
 */
function evtl_resolve_theme( $choice ) {
	$themes = evtl_all_themes();
	$slug   = (string) $choice;
	if ( EVTL_NO_THEME !== $slug && ! isset( $themes[ $slug ] ) ) {
		$slug = evtl_default_theme();
	}
	if ( EVTL_NO_THEME === $slug ) {
		return null;
	}
	return array(
		'slug'   => $slug,
		'tokens' => $themes[ $slug ]['tokens'],
	);
}

/**
 * The classes and CSS custom properties that apply a theme. Mirrored in
 * src/theme-editor/tokens.js for the live preview; keep the two in step.
 *
 * @param array<string, mixed> $tokens Sanitized tokens.
 * @param string               $slug   Theme slug, for the is-evtl-theme-{slug} class.
 * @return array{class: string, style: string}
 */
function evtl_theme_wrapper_parts( array $tokens, $slug = '' ) {
	$fonts   = evtl_theme_fonts();
	$heading = 'same' === $tokens['headingFont'] ? $tokens['font'] : $tokens['headingFont'];

	$vars = array(
		'--evtl-surface'      => $tokens['background'],
		'--evtl-ink'          => $tokens['text'],
		'--evtl-strong'       => $tokens['accent'],
		'--evtl-on-strong'    => evtl_text_on( $tokens['accent'] ),
		'--evtl-grid-mix'     => $tokens['grid'] . '%',
		'--evtl-line-mix'     => min( 60, $tokens['grid'] * 2 ) . '%',
		'--evtl-lift'         => $tokens['lift'] . '%',
		'--evtl-radius'       => $tokens['radius'] . 'px',
		'--evtl-lane-height'  => evtl_theme_densities()[ $tokens['density'] ],
		'--evtl-font'         => $fonts[ $tokens['font'] ]['stack'],
		'--evtl-heading-font' => $fonts[ $heading ]['stack'],
	);
	if ( 'uppercase' === $tokens['labels'] ) {
		$vars['--evtl-label-case']     = 'uppercase';
		$vars['--evtl-label-tracking'] = '0.06em';
	}

	$style = '';
	foreach ( $vars as $name => $value ) {
		$style .= $name . ':' . $value . ';';
	}

	$classes = array( 'has-evtl-theme', 'is-bars-' . $tokens['bars'] );
	if ( $slug ) {
		$classes[] = 'is-evtl-theme-' . sanitize_html_class( $slug );
	}
	if ( $tokens['glow'] ) {
		$classes[] = 'has-evtl-glow';
	}

	return array(
		'class' => implode( ' ', $classes ),
		'style' => $style,
	);
}

/**
 * Wrapper attributes for a block's theme, ready for get_block_wrapper_attributes().
 *
 * @param array<string, mixed> $attributes Block attributes.
 * @return array<string, string> Empty when the block has no theme.
 */
function evtl_theme_wrapper_attributes( array $attributes ) {
	$theme = evtl_resolve_theme( $attributes['theme'] ?? '' );
	return $theme ? evtl_theme_wrapper_parts( $theme['tokens'], $theme['slug'] ) : array();
}

/**
 * A slug for a new custom theme, unique among all themes.
 *
 * @param string $name Theme name.
 * @return string
 */
function evtl_unique_theme_slug( $name ) {
	$base  = sanitize_title( $name );
	$base  = '' === $base ? 'theme' : $base;
	$taken = array_merge( array_keys( evtl_all_themes() ), array( EVTL_NO_THEME, 'default' ) );
	$slug  = $base;
	for ( $i = 2; in_array( $slug, $taken, true ); $i++ ) {
		$slug = $base . '-' . $i;
	}
	return $slug;
}

/**
 * Themes as the theme editor and the block's theme picker see them.
 *
 * @return array{themes: list<array<string, mixed>>, default: string, canManage: bool, editorUrl: string}
 */
function evtl_themes_for_js() {
	$list = array();
	foreach ( evtl_all_themes() as $slug => $theme ) {
		$list[] = array(
			'slug'    => $slug,
			'name'    => $theme['name'],
			'builtIn' => $theme['builtIn'],
			'tokens'  => $theme['tokens'],
		);
	}
	return array(
		'themes'    => $list,
		'default'   => evtl_default_theme(),
		'canManage' => evtl_can_manage_themes(),
		'editorUrl' => admin_url( 'edit.php?post_type=evtl_event&page=evtl-themes' ),
	);
}

/**
 * Who may create, edit and delete themes, and set the site default.
 *
 * @return bool
 */
function evtl_can_manage_themes() {
	return current_user_can( 'edit_theme_options' );
}

/**
 * REST routes for the theme editor, under events-timeline/v1.
 *
 * GET    /themes             all themes and the site default (anyone who can edit posts)
 * POST   /themes             create a custom theme from { name, tokens }
 * POST   /themes/{slug}      update a custom theme's name and/or tokens
 * DELETE /themes/{slug}      delete a custom theme
 * POST   /themes/default     set the site default to { slug } ("none" for no theme)
 */
function evtl_register_theme_routes() {
	$namespace = 'events-timeline/v1';
	$manage    = 'evtl_can_manage_themes';
	$tokens    = array(
		'type'              => 'object',
		'sanitize_callback' => 'evtl_sanitize_theme_tokens',
	);
	$name      = array(
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_text_field',
		'validate_callback' => static fn( $value ) => is_string( $value ) && '' !== trim( $value ) && strlen( $value ) <= 60,
	);

	register_rest_route(
		$namespace,
		'/themes',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => static fn() => current_user_can( 'edit_posts' ),
				'callback'            => static fn() => rest_ensure_response( evtl_themes_for_js() ),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => $manage,
				'args'                => array(
					'name'   => $name + array( 'required' => true ),
					'tokens' => $tokens + array( 'required' => true ),
				),
				'callback'            => 'evtl_rest_create_theme',
			),
		)
	);

	register_rest_route(
		$namespace,
		'/themes/default',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'permission_callback' => $manage,
			'args'                => array(
				'slug' => array(
					'type'     => 'string',
					'required' => true,
				),
			),
			'callback'            => 'evtl_rest_set_default_theme',
		)
	);

	register_rest_route(
		$namespace,
		'/themes/(?P<slug>[a-z0-9-]+)',
		array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => $manage,
				'args'                => array(
					'name'   => $name,
					'tokens' => $tokens,
				),
				'callback'            => 'evtl_rest_update_theme',
			),
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'permission_callback' => $manage,
				'callback'            => 'evtl_rest_delete_theme',
			),
		)
	);
}
add_action( 'rest_api_init', 'evtl_register_theme_routes' );

/**
 * Creates a custom theme.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response
 */
function evtl_rest_create_theme( WP_REST_Request $request ) {
	$themes          = evtl_custom_themes();
	$slug            = evtl_unique_theme_slug( $request['name'] );
	$themes[ $slug ] = array(
		'name'   => $request['name'],
		'tokens' => evtl_sanitize_theme_tokens( $request['tokens'] ),
	);
	update_option( EVTL_THEMES_OPTION, $themes );

	$response = rest_ensure_response( array( 'slug' => $slug ) + evtl_themes_for_js() );
	$response->set_status( 201 );
	return $response;
}

/**
 * Updates a custom theme. Built-in themes can't be changed; duplicate them instead.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function evtl_rest_update_theme( WP_REST_Request $request ) {
	$slug   = (string) $request['slug'];
	$themes = evtl_custom_themes();
	if ( ! isset( $themes[ $slug ] ) ) {
		return evtl_theme_not_editable( $slug );
	}
	if ( null !== $request['name'] ) {
		$themes[ $slug ]['name'] = $request['name'];
	}
	if ( null !== $request['tokens'] ) {
		$themes[ $slug ]['tokens'] = evtl_sanitize_theme_tokens( $request['tokens'] );
	}
	update_option( EVTL_THEMES_OPTION, $themes );
	return rest_ensure_response( array( 'slug' => $slug ) + evtl_themes_for_js() );
}

/**
 * Deletes a custom theme. Blocks that used it fall back to the site default.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function evtl_rest_delete_theme( WP_REST_Request $request ) {
	$slug   = (string) $request['slug'];
	$themes = evtl_custom_themes();
	if ( ! isset( $themes[ $slug ] ) ) {
		return evtl_theme_not_editable( $slug );
	}
	unset( $themes[ $slug ] );
	update_option( EVTL_THEMES_OPTION, $themes );
	if ( get_option( EVTL_DEFAULT_THEME_OPTION ) === $slug ) {
		update_option( EVTL_DEFAULT_THEME_OPTION, EVTL_NO_THEME );
	}
	return rest_ensure_response( evtl_themes_for_js() );
}

/**
 * Sets the site default theme.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function evtl_rest_set_default_theme( WP_REST_Request $request ) {
	$slug = (string) $request['slug'];
	if ( EVTL_NO_THEME !== $slug && ! isset( evtl_all_themes()[ $slug ] ) ) {
		return new WP_Error( 'evtl_unknown_theme', __( 'There is no theme with that name.', 'events-timeline' ), array( 'status' => 404 ) );
	}
	update_option( EVTL_DEFAULT_THEME_OPTION, $slug );
	return rest_ensure_response( evtl_themes_for_js() );
}

/**
 * The error for changing a theme that is built in or doesn't exist.
 *
 * @param string $slug Theme slug.
 * @return WP_Error
 */
function evtl_theme_not_editable( $slug ) {
	if ( isset( evtl_builtin_themes()[ $slug ] ) ) {
		return new WP_Error( 'evtl_builtin_theme', __( 'Built-in themes can’t be changed. Duplicate it to make your own version.', 'events-timeline' ), array( 'status' => 403 ) );
	}
	return new WP_Error( 'evtl_unknown_theme', __( 'There is no theme with that name.', 'events-timeline' ), array( 'status' => 404 ) );
}
