# TIERFORM architecture

Version 2026.10b uses native ES modules as its editable source. The build
bundles them for hosting and for a portable HTML download. Neither output
needs a runtime package, application server or account.

| Source | Responsibility |
| --- | --- |
| `src/model/` | Document defaults and entities, limits, history, photo references, labels, framing, lookup indexes and person ordering |
| `src/engine/` | Text measurement, shared band solver and six layout geometries |
| `src/render/` | Layout to SVG, Canvas and PDF, colour and XML encoding |
| `src/io/` | Roster validation, bounded image preflight and decoding, CSV and downloads |
| `src/ui/` | DOM components, dialogs, menus, roster, ribbon, preview and tour |
| `src/app/` | Commands, document operations, import transactions and event controllers |
| `src/main.js` | Connect model notifications and bind controllers once |
| `src/markup/` | Sprite, ribbon, menus, workspace, dialogs, Info and tour markup |
| `src/styles/` | Ordered base, ribbon, Info and tour, controls, roster, workspace, dialogs and theme styles |

## Engine contract

`createLayoutEngine(measurementContext)` creates an independent engine. Its
`computeLayout(document)` returns page, fit, bands, text and avatar geometry.
The context provides `font` and `measureText(text).width`, as a Canvas 2D
context does. The engine never reads the DOM or current editor document.

Pyramid and Tornado share one triangle solver. Histogram reuses its grouping,
band stack and content emission. Swimlanes, Hive and Matrix have separate
solvers. Text measurement helpers belong to each engine instance. Renderers
consume the layout result, so preview and export use the same geometry.

`engine/shared.js` holds page fitting, headers, avatars and grid-label emission.
Swimlanes and Matrix also share lane measurement and person placement. Grid
grouping preserves roster order across merged grades; band grouping retains
its distinct grade-first order. Matrix fills indexed row cells in one pass
per lane instead of filtering every lane again for every group.

## Model and controllers

`model/document.js` owns the current document, filename, dirty flag and
asynchronous generation. The application edits that document through
`commit` or `edit` in `model/history.js`. History owns snapshots, continuous
editing sessions and deduplicated photo bytes. It exposes checkpoints for
setting aside and restoring the user's document during the tour.

The model reports dirty, history, render-scope and message notifications.
`main.js` connects those callbacks to the UI. Model and engine modules have
no DOM dependency and cannot import application controllers or UI modules.
Feature-local dialog and interaction state stays in its owning component;
components import named functions rather than looking up shared globals.

Controllers perform validation and asynchronous work before committing. UI
components compose each other through named imports, with some cycles among
roster, dialogs and popovers. Those connections resolve through function
calls; they do not form a common mutable context or runtime module registry.

Entity and membership indexes in `model/indexes.js` live for one calculation,
render or export. They are rebuilt on the next call, avoiding stale data after
edits, undo or document replacement. `model/person-order.js` plans a drag move
without mutating its input. It rotates occupied slots per crossed grade,
preserving the complete interleaved roster order of repeated keyboard moves.
The controller applies that plan in one history entry. Photo-pan listeners are
shared, while edit history and pending-add state retain separate callbacks.

## Outputs

`npm run build` uses pinned esbuild to bundle and minify `src/main.js`. Editable
modules retain their names and formatting. It assembles the
same ordered markup and styles into two outputs:

- `_site/index.html` loads `./assets/app.js`, CSS and the bundled font. Relative
  paths work under `/TIERFORM/`. The hosted policy blocks outgoing data
  connections and allows same-origin static loading.
- `tierform_app.html` embeds the identical script, CSS and font for `file://`.
  `_site/tierform_app.html` offers that identical portable download.

The tracked HTML is generated; source changes must rebuild it. The build has
no timestamp or environment-specific paths. CI checks reproducibility and
runs all suites before Pages deployment. Build dependencies never ship as
runtime package dependencies. Font and artwork source assets and licenses
remain in `fonts/`, `sprites/`, `licenses/`, `LICENSE` and `NOTICE`.
