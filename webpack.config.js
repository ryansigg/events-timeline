/**
 * @wordpress/scripts finds the Timeline block through its block.json. This adds the
 * Event details sidebar panel, which is an editor plugin rather than a block.
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
			return { ...base, 'event-details/index': './src/event-details/index.js' };
		},
	},
	...moduleConfigs,
];
