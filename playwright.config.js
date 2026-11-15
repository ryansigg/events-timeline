/**
 * End-to-end tests, built on the Playwright config that ships with @wordpress/scripts
 * (REST login in global setup, saved admin session, Chromium).
 *
 * Point WP_BASE_URL at a WordPress site with this plugin active and the demo content
 * loaded (bin/demo-content.php). See the README for a one-command local site.
 */
const { defineConfig } = require( '@playwright/test' );
const base = require( '@wordpress/scripts/config/playwright.config.js' );

// The base config starts wp-env; this project brings its own site, so drop that.
const { webServer, ...rest } = base;

module.exports = defineConfig( {
	...rest,
	testDir: './tests/e2e',
	reporter: process.env.CI ? [ [ 'github' ], [ 'html', { open: 'never' } ] ] : [ [ 'list' ] ],
} );
