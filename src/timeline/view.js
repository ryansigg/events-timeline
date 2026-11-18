/**
 * Front-end behavior for the Events Timeline block (Interactivity API).
 *
 * Times are "wall clock" minutes: the site-local date and time counted as if it
 * were UTC, exactly as in includes/timeline.php. Every getter here has a PHP twin
 * there, so the page the server sends and the page the browser hydrates match.
 */
import { store, getContext } from '@wordpress/interactivity';

const DAY = 1440;
const RANGES = [ 'week', 'month', 'year' ];
const VIEWS = [ 'timeline', 'list' ];
const PARAMS = {
	view: 'view',
	range: 'range',
	calendar: 'calendar',
	type: 'event_type',
};

/* Date helpers, all in UTC so the browser's own time zone never leaks in. */

const parseDay = ( ymd ) => {
	const [ y, m, d ] = ymd.split( '-' ).map( Number );
	return new Date( Date.UTC( y, m - 1, d ) );
};
const toYmd = ( date ) => date.toISOString().slice( 0, 10 );
const toMinutes = ( date ) => Math.floor( date.getTime() / 60000 );
const fromMinutes = ( minutes ) => new Date( minutes * 60000 );
const percent = ( fraction ) => `${ Math.round( fraction * 100000 ) / 1000 }%`;

const locale = () => document.documentElement.lang || undefined;
const format = ( minutes, options ) =>
	new Intl.DateTimeFormat( locale(), { timeZone: 'UTC', ...options } ).format(
		fromMinutes( minutes )
	);

/**
 * First day of the week, month or year window containing a date.
 *
 * @param {string} range     week, month or year.
 * @param {string} ymd       Any date in the window.
 * @param {number} weekStart 0 (Sunday) to 6.
 * @return {string} Window start, Y-m-d.
 */
export function anchorFor( range, ymd, weekStart ) {
	const date = parseDay( ymd );
	if ( range === 'year' ) {
		return `${ date.getUTCFullYear() }-01-01`;
	}
	if ( range === 'month' ) {
		return toYmd(
			new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth(), 1 ) )
		);
	}
	const back = ( date.getUTCDay() - weekStart + 7 ) % 7;
	date.setUTCDate( date.getUTCDate() - back );
	return toYmd( date );
}

export function shiftAnchor( range, anchor, steps ) {
	const date = parseDay( anchor );
	if ( range === 'week' ) {
		date.setUTCDate( date.getUTCDate() + 7 * steps );
	} else if ( range === 'month' ) {
		date.setUTCMonth( date.getUTCMonth() + steps );
	} else {
		date.setUTCFullYear( date.getUTCFullYear() + steps );
	}
	return toYmd( date );
}

export function windowBounds( range, anchor ) {
	return [
		toMinutes( parseDay( anchor ) ),
		toMinutes( parseDay( shiftAnchor( range, anchor, 1 ) ) ),
	];
}

/**
 * Where an event sits on the timeline. Month and year views snap events to whole
 * days so short events stay visible and line up with the day grid.
 *
 * @param {number} s     Start, wall minutes.
 * @param {number} e     End, wall minutes.
 * @param {string} range week, month or year.
 * @return {number[]} Start and end.
 */
export function span( s, e, range ) {
	if ( range !== 'week' ) {
		s = s - ( ( ( s % DAY ) + DAY ) % DAY );
		e = Math.ceil( e / DAY ) * DAY;
	}
	return [ s, Math.max( e, s + 1 ) ];
}

export function rangeLabel( range, anchor ) {
	if ( range === 'year' ) {
		return anchor.slice( 0, 4 );
	}
	const bounds = windowBounds( range, anchor );
	if ( range === 'month' ) {
		return format( bounds[ 0 ], { month: 'long', year: 'numeric' } );
	}
	const [ ws, we ] = bounds;
	return `${ format( ws, { month: 'short', day: 'numeric' } ) } – ${ format(
		we - DAY,
		{
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}
	) }`;
}

export function ticks( range, anchor ) {
	const [ ws, we ] = windowBounds( range, anchor );
	const total = we - ws;
	if ( range === 'year' ) {
		return Array.from( { length: 12 }, ( _, m ) => {
			const at = toMinutes(
				parseDay( shiftAnchor( 'month', anchor, m ) )
			);
			return {
				key: String( m ),
				label: format( at, { month: 'short' } ),
				left: percent( ( at - ws ) / total ),
				minor: false,
			};
		} );
	}
	const days = total / DAY;
	return Array.from( { length: days }, ( _, d ) => {
		const at = ws + d * DAY;
		let label = String( d + 1 );
		if ( range === 'week' ) {
			const parts = new Intl.DateTimeFormat( locale(), {
				timeZone: 'UTC',
				weekday: 'short',
				day: 'numeric',
			} ).formatToParts( fromMinutes( at ) );
			const part = ( type ) =>
				parts.find( ( p ) => p.type === type )?.value;
			label = `${ part( 'weekday' ) } ${ part( 'day' ) }`;
		}
		return {
			key: String( d ),
			label,
			left: percent( d / days ),
			minor: range === 'month' && d % 2 === 1,
		};
	} );
}

/* State and behavior. */

const matches = ( ctx, c, t ) =>
	( ctx.calendar === '' || c === ctx.calendar ) &&
	( ctx.type === '' || t.includes( ctx.type ) );

const inView = ( ctx, s, e ) => {
	const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
	const [ a, b ] = span( s, e, ctx.range );
	return b > ws && a < we;
};

const visibleItems = ( ctx ) =>
	ctx.items.filter( ( i ) => matches( ctx, i.c, i.t ) );

function syncUrl( ctx, keys ) {
	const url = new URL( window.location.href );
	for ( const key of keys ) {
		const value = ctx[ key ];
		if ( value ) {
			url.searchParams.set( PARAMS[ key ], value );
		} else {
			url.searchParams.delete( PARAMS[ key ] );
		}
	}
	window.history.pushState( {}, '', url );
}

function setRangeKeepingFocus( ctx, range ) {
	const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
	const focus = ctx.now >= ws && ctx.now < we ? ctx.now : ws;
	ctx.range = range;
	ctx.anchor = anchorFor(
		range,
		toYmd( fromMinutes( focus ) ),
		ctx.weekStart
	);
}

const { state } = store( 'events-timeline', {
	state: {
		get isTimeline() {
			return getContext().view === 'timeline';
		},
		get isYear() {
			return getContext().range === 'year';
		},
		get isMonth() {
			return getContext().range === 'month';
		},
		get isWeek() {
			return getContext().range === 'week';
		},
		get isActive() {
			const ctx = getContext();
			return ctx[ ctx.group ] === ctx.value;
		},
		get isViewActive() {
			const ctx = getContext();
			return ctx.view === ctx.viewValue;
		},
		get isRangeActive() {
			const ctx = getContext();
			return ctx.range === ctx.rangeValue;
		},
		get isListItemHidden() {
			const ctx = getContext();
			return ! matches( ctx, ctx.c, ctx.t );
		},
		get isRowHidden() {
			const ctx = getContext();
			return ctx.calendar !== '' && ctx.row !== ctx.calendar;
		},
		get isBarHidden() {
			const ctx = getContext();
			return (
				! matches( ctx, ctx.c, ctx.t ) || ! inView( ctx, ctx.s, ctx.e )
			);
		},
		get barLeft() {
			const ctx = getContext();
			const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
			const [ s ] = span( ctx.s, ctx.e, ctx.range );
			return percent( ( Math.max( s, ws ) - ws ) / ( we - ws ) );
		},
		get barWidth() {
			const ctx = getContext();
			const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
			const [ s, e ] = span( ctx.s, ctx.e, ctx.range );
			return percent(
				( Math.min( e, we ) - Math.max( s, ws ) ) / ( we - ws )
			);
		},
		get isClippedStart() {
			const ctx = getContext();
			return (
				span( ctx.s, ctx.e, ctx.range )[ 0 ] <
				windowBounds( ctx.range, ctx.anchor )[ 0 ]
			);
		},
		get isNearEnd() {
			const ctx = getContext();
			const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
			const [ s ] = span( ctx.s, ctx.e, ctx.range );
			return ( Math.max( s, ws ) - ws ) / ( we - ws ) > 0.8;
		},
		get isClippedEnd() {
			const ctx = getContext();
			return (
				span( ctx.s, ctx.e, ctx.range )[ 1 ] >
				windowBounds( ctx.range, ctx.anchor )[ 1 ]
			);
		},
		get ticks() {
			const ctx = getContext();
			return ticks( ctx.range, ctx.anchor );
		},
		get rangeLabel() {
			const ctx = getContext();
			return rangeLabel( ctx.range, ctx.anchor );
		},
		get isNowHidden() {
			const ctx = getContext();
			const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
			return ctx.now < ws || ctx.now >= we;
		},
		get nowLeft() {
			const ctx = getContext();
			const [ ws, we ] = windowBounds( ctx.range, ctx.anchor );
			return percent( ( ctx.now - ws ) / ( we - ws ) );
		},
		get isRangeEmptyHidden() {
			const ctx = getContext();
			return (
				ctx.view !== 'timeline' ||
				visibleItems( ctx ).some( ( i ) => inView( ctx, i.s, i.e ) )
			);
		},
		get statusText() {
			const ctx = getContext();
			const matched = visibleItems( ctx );
			if ( ctx.view !== 'timeline' ) {
				return ctx.strings.listStatus
					.replace( '%1$s', matched.length.toLocaleString() )
					.replace( '%2$s', ctx.items.length.toLocaleString() );
			}
			const n = matched.filter( ( i ) => inView( ctx, i.s, i.e ) ).length;
			return (
				n === 1
					? ctx.strings.rangeStatusOne
					: ctx.strings.rangeStatusMany
			)
				.replace( '%1$s', n.toLocaleString() )
				.replace( '%2$s', rangeLabel( ctx.range, ctx.anchor ) );
		},
	},
	actions: {
		setFilter() {
			const ctx = getContext();
			ctx[ ctx.group ] = ctx.value;
			syncUrl( ctx, [ ctx.group ] );
		},
		setView() {
			const ctx = getContext();
			ctx.view = ctx.viewValue;
			syncUrl( ctx, [ 'view' ] );
		},
		setRange() {
			const ctx = getContext();
			setRangeKeepingFocus( ctx, ctx.rangeValue );
			syncUrl( ctx, [ 'range' ] );
		},
		prev() {
			const ctx = getContext();
			ctx.anchor = shiftAnchor( ctx.range, ctx.anchor, -1 );
		},
		next() {
			const ctx = getContext();
			ctx.anchor = shiftAnchor( ctx.range, ctx.anchor, 1 );
		},
		today() {
			const ctx = getContext();
			ctx.anchor = anchorFor(
				ctx.range,
				toYmd( fromMinutes( ctx.now ) ),
				ctx.weekStart
			);
		},
		syncFromUrl() {
			const ctx = getContext();
			const params = new URL( window.location.href ).searchParams;
			const view = params.get( PARAMS.view );
			if ( VIEWS.includes( view ) ) {
				ctx.view = view;
			}
			const range = params.get( PARAMS.range );
			if ( RANGES.includes( range ) && range !== ctx.range ) {
				setRangeKeepingFocus( ctx, range );
			}
			const calendar = params.get( PARAMS.calendar ) ?? '';
			ctx.calendar = Object.hasOwn( ctx.calendars, calendar )
				? calendar
				: '';
			const type = params.get( PARAMS.type ) ?? '';
			ctx.type = Object.hasOwn( ctx.types, type ) ? type : '';
		},
	},
	callbacks: {
		init() {
			// On phones, start in the list unless the link asked for a view.
			const ctx = getContext();
			const asked = new URL( window.location.href ).searchParams.has(
				PARAMS.view
			);
			if (
				! asked &&
				window.matchMedia( '(max-width: 599px)' ).matches
			) {
				ctx.view = 'list';
			}
		},
	},
} );

export default state;
