=== Events Timeline ===
Contributors: ryansigg
Tags: events, timeline, calendar, block, schedule
Requires at least: 6.7
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

An Event post type, color-coded calendars, and a Timeline block with week, month and year views and filters you can link to.

== Description ==

Add events with a start and end (or whole days), a location and an optional link, group them into color-coded calendars, then show them anywhere with the Events Timeline block.

* Timeline view: one row per calendar, by week, month or year, with previous, next and Today, and a details popover for each event.
* List view: vertical or horizontal. Phones open in the list.
* Upcoming events (including ones happening now), past events, or both.
* Filters by calendar and event type. The view, range and filters are kept in the address bar, so any view can be shared or bookmarked, and it works without JavaScript.
* Uses your theme's colors and fonts. Supports alignment, color, spacing and font size settings.
* Accessible: real lists and headings, `<time>` elements, pressed states on filters, a live count for screen readers, and a keyboard-reachable scroll area.

== Installation ==

1. Upload the plugin and activate it.
2. Add calendars (with a color) under Events > Calendars and event types under Events > Event types, then add events under Events > Add New Event. The Event details panel in the sidebar holds the dates, location and link.
3. Add the Events Timeline block to any page.

== Frequently Asked Questions ==

= Can I link straight to one type of event? =

Yes. Add `?event_type=` or `?calendar=` and a slug to the page address, for example `/events/?event_type=tournament`. `?view=list` and `?range=week` work too.

= Which time zone are event times in? =

The site's time zone, from Settings > General.

== Changelog ==

= 1.1.0 =
* Timeline view with one row per calendar, week, month and year ranges, navigation and event details popovers.
* Calendars with colors, a calendar filter, and all-day events.
* Timeline/List switch; view and range kept in the URL.

= 1.0.0 =
* First release.
