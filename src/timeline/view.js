/**
 * Front-end behavior for the Events Timeline block (Interactivity API).
 *
 * The derived state below mirrors the closures in render.php, so the page the
 * server sends and the page the browser hydrates are identical.
 */
import { store, getContext } from '@wordpress/interactivity';

const { state } = store( 'events-timeline', {
	state: {
		get isActive() {
			const ctx = getContext();
			return ctx.filter === ctx.value;
		},
		get isHidden() {
			const ctx = getContext();
			return ctx.filter !== '' && ! ctx.itemTypes.includes( ctx.filter );
		},
		get statusText() {
			const ctx = getContext();
			const total = ctx.types.length;
			const shown =
				ctx.filter === ''
					? total
					: ctx.types.filter( ( t ) => t.includes( ctx.filter ) )
							.length;
			return ctx.statusTemplate
				.replace( '%1$s', shown.toLocaleString() )
				.replace( '%2$s', total.toLocaleString() );
		},
	},
	actions: {
		setFilter() {
			const ctx = getContext();
			ctx.filter = ctx.value;

			// Keep the filter in the URL so it can be shared, bookmarked and reloaded.
			const url = new URL( window.location.href );
			if ( ctx.filter ) {
				url.searchParams.set( ctx.param, ctx.filter );
			} else {
				url.searchParams.delete( ctx.param );
			}
			window.history.pushState( {}, '', url );
		},
		syncFromUrl() {
			const ctx = getContext();
			const value =
				new URL( window.location.href ).searchParams.get( ctx.param ) ??
				'';
			ctx.filter = Object.prototype.hasOwnProperty.call(
				ctx.labels,
				value
			)
				? value
				: '';
		},
	},
} );

export default state;
