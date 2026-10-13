# TIERFORM behavioral invariants

These rules explain decisions that are easy to lose during maintenance.
The executable suites check their detailed cases.

## Documents and asynchronous work

Roster JSON is the only durable storage. New starts with no grades, people
or groups. Saving a roster with no grades is refused. The file format remains
version 1; the application version is independent of it.

Every user mutation uses `commit` or `edit`. Discrete actions close typing
sessions; continuous input with the same key shares one undo step until blur,
Escape, another action or 900 ms of inactivity. Undo marks a document dirty
even when it returns to previously saved content. History keeps at most 15
snapshots before the live redo checkpoint and deduplicates photo bytes.

Asynchronous photo writes capture document generation and destination
identity. New, successful Open, whole-structure changes and tour transitions
advance the generation. A person reference is checked by object identity:
Undo can restore the same ID as a different object. Overlapping Opens also
use their request sequence; a superseded decode stops without adopting data.

The tour sets aside the user's complete document and history. Its demo
commits cannot erase saved photo references. Leaving it restores the exact
prior editing context, and replaying steps starts from the same demo.

## Structure and geometry

Grade order and person order are document data. Merging groups preserves
roster order. A group with no members is removed after a mutation. Templates
replace all of their style and structure properties in one undo step and
cannot replace a structure that still has people.

The layout capability table owns UI labels and availability. Unsupported
layout settings remain stored, so switching back is lossless. Unknown
in-memory layouts draw Pyramid; imported unknown values are repaired.

Pyramid and Tornado use a single straight triangle edge. Histogram alone
sizes each band's width from its headcount. Swimlanes use equal widths; Hive
uses equal hexagons. Empty groups in grid layouts disappear except when the
whole chart has nobody on it. Matrix crosses grades with document groups.

Below-photo labels take their ink from the surface beneath them. Attached
bands retain their zero gap. Their centered person grids receive only a
bounded collision offset; explicit left or right placement keeps its anchor.
Photo framing uses one geometry function for preview and every renderer.

## Imports and rendering

Import validates structure before adoption, regenerates identifiers and
refuses broken references. Repairable fields are normalized and reported.
Photo references permit only bounded JPEG or PNG data URLs. The bounded byte
preflight checks signatures, dimensions and declared format before decoding;
actual decoded dimensions must agree, allowing EXIF transposition. A bad
photo removes that photo while retaining its person. See `SECURITY.md` for
the preflight's limits.

One font stack drives CSS and default document text. Layout measures the
chosen document font; renderer text reads that same stack from the layout.
The first preview waits for the bundled font. Exported SVG names fonts but
does not embed them. PNG and PDF use rasterized local glyphs.

UI text uses DOM text properties. SVG text and attributes are escaped at the
export boundary. Rendering never reads CSS to obtain document colours.
After initial hosted asset loading, editing and exporting make no network
requests. No browser storage is used.

## Interaction

Design menus drive canonical controls and their ordinary change events.
Dialogs rebuild destination choices when opened and do not share remembered
import defaults. The roster search changes only the visible list. Its active
filter prevents ambiguous drag reordering. Focus is restored across roster
rebuilds and remains trapped inside dialogs. SVG icon visibility follows CSS
classes rather than assigning the HTML-only `hidden` property.
