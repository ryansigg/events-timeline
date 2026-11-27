/**
 * @wordpress/scripts finds the Timeline block through its block.json. This adds the
 * Event details sidebar panel (an editor plugin) and the Timeline Themes admin screen.
 */
const defaults = require( '@wordpress/scripts/config/webpack.config' );

const [ scriptConfig, ...moduleConfigs ] = Array.isArray( defaults ) ? defaults : [ defaults ];

module.exports = [
	{
		...scriptConfig,
		entry: async () => {
			const base =
				typeof scriptConfig.entry === 'function'
					? await scriptConfig.entry()
					: scriptConfig.entry;
			return {
				...base,
				'event-details/index': './src/event-details/index.js',
				'theme-editor/index': './src/theme-editor/index.js',
			};
		},
	},
	...moduleConfigs,
];
