# TIERFORM testing

Use Node 24. Run `npm ci` and `npm run build`, then `npm test` for the
standard developer checks. Install browser binaries with
`npx playwright install chromium firefox webkit` and run `npm run test:browser`
for interaction and export checks.

`npm run test:parity` runs the full frozen original comparison separately.
`npm run test:release` runs standard tests, parity and all browser projects;
`npm run check` builds first. GitHub Actions requires all three test groups
before Pages deployment, and runs the same checks on pull requests.

## Standard checks

The standard run executes 4,649 assertions across five suites, plus 14 direct
module contracts, 10 artifact contracts and 16,069 full-document reorder
comparisons. These counts are not a coverage percentage.

| Suite | Assertion calls | Main evidence |
| --- | ---: | --- |
| `harness.js` | 1,680 | Native layouts, photo framing, renderer agreement and PDF byte offsets |
| `dom.js` | 35 in 10 contracts | Markup/ARIA references, commands, artwork provenance, licenses, font and privacy boundaries |
| `document.js` | 1,414 | History, edit sessions, asynchronous operations, document and tour restoration |
| `fixtures.js` | 812 | Fixture verdicts, drag/drop, keyboard/controller and layout availability behavior |
| `import.js` | 708 | Validation, CSV/paste, photo limits/preflight, decode failures and stale results |

The reduction removes repeated work, not just assertion counters:

- Photo framing uses 84 representative shape/zoom/pan combinations instead
  of 2,058 combinations. Square, wide, tall and near-square images, both pan
  signs and axes, zoom boundaries and malformed inputs remain covered.
  Preview/chart scaling uses 14 combinations instead of 168. Separate literal
  coordinate checks catch reversed pan directions.
- General finite-layout checks use 300 cases across all six layouts and five
  boundary profiles. Layout-specific packing, ordering, spacing and fit
  invariants remain, as do PNG/SVG agreement and PDF cross-reference offsets.
- The 6,785-line DOM source-shape suite becomes compact integrity contracts.
  CSS widths, text order and function-body patterns are no longer pinned.
  Real browser interactions replace the relevant keyboard, focus, responsive
  roster and tour guards.
- Duplicate fixture/layout round trips, repeated individual history-setting
  assertions and historical function-name bans are removed. Structural
  repairs, malformed inputs, security limits and asynchronous race cases stay.

The harness imports actual engine, model, SVG, Canvas and PDF modules. Its
Canvas, Image, Blob and font-readiness environment is stubbed; browser tests
exercise the real browser rendering and download APIs. It no longer extracts
functions or reads the generated legacy source.

Document, fixture and import controller-isolation tests read `_test/source.js`,
written directly by the legacy adapter. It removes module declarations, maps
feature-state qualifications to isolated variables and connects notifications
to existing stubs. It does not prove initialization or imports. Markup and CSS
checks read the built HTML and stylesheet separately. The remaining extractor
copies have shared behavioral self-checks. Their JavaScriptCore fallback remains; the standard
runner, native harness, integrity and artifact tests require Node.

`modules.mjs` covers engine-instance isolation, document/history behavior,
CSV and SVG escaping, layer boundaries and unresolved names across every
module. It also verifies that repeated calculations refresh label lookups and
preserve first-match behavior. `artifacts.mjs` checks hosted/portable equality, project-relative
paths, CSP, font bytes, download parity and reproducibility.
Integrity and artifact checks use the development-only `parse5-sax-parser`
to inspect HTML tokens, including comments and inline script/style content.
Markup comparisons omit resource tokens without stripping and reparsing HTML.

## Browser and release checks

Six flows run in each Chromium, Firefox and WebKit project, against both
`file://` and a local `/TIERFORM/` build: 36 configured browser cases.

1. Boot, open photos, all layouts, roster Save, PNG/PDF/SVG/CSV values and
   hosted Copy PNG, with saved-status icon visibility.
2. Ribbon keys, modal initial focus, Tab/Shift+Tab wrapping, inert background,
   Escape and returned focus, coalesced typing, undo/redo and dirty icons.
3. Narrow roster visibility, accessible names/tooltips and no document edit.
4. Tour cancellation by Escape and Close, restoring chart, dirty status and
   undo history. Only generated clip IDs are normalized, preserving their
   distinct reference mapping.
5. Shared design bindings, including text colours, preserve saved settings and
   independent undo/redo behavior.
6. Photo panning preserves edit history and keeps pending-add framing out of
   the document until the person is added.

Every flow checks console/page errors and network requests after initial
static loading. PNG/PDF/SVG/CSV exports run once per project, replacing repeated
export runs in separate network and console tests.

`engine-parity.mjs` compares 4,368 configurations with frozen hashes generated
solely from commit `7be5c66` (2026.8b). Complete geometry, normalized SVG and
input snapshots cover two measurement models. No git history is required;
never regenerate expected hashes from the candidate implementation.

`reorder-parity.mjs` compares the optimized ordering algorithm with the frozen
pre-optimization implementation in `reference/person-order.mjs`. Exhaustive
small rosters, deterministic larger cases, empty grades and 2,000-person
boundaries check full order, grade assignment, object identity and planning
immutability. Controller tests separately cover one-step undo, no-op drops and
refusal when the source grade is missing. The obsolete tests that monkey-patched
the old incremental walk are replaced by those behavioral comparisons.

On 2026-10-13, independent comparisons with the pre-optimization portable
build from commit `cde9579` matched under Chromium and WebKit for all six layouts: normalized
preview/export SVG, screenshots and PNG/PDF/CSV bytes. Artifact contracts check
that hosted and portable builds contain identical scripts and styles; browser
flows check saved documents, editing, undo/redo, tour, CSP and network behavior
in both distributions.

The local browser run passes all 24 Chromium/WebKit cases. The
Playwright Firefox binary fails before its automation handshake on this macOS
environment; its projects remain enabled in CI. This also prevented the current
optimization from receiving a local automated Firefox result. Earlier native
Firefox 157 checks passed startup, photos, clipboard, PNG/PDF, layout undo and
Save, and native Safari passed startup, photos and clipboard; those manual
checks have not been repeated for this optimization. Native Safari downloads
and the published Pages URL remain manual checks. See `test/MANUAL.md`.

## Optimization measurements

The JavaScript bundle shrank from 242,528 to 128,798 bytes (46.9%); the portable
HTML shrank from 750,328 to 636,598 bytes (15.2%). Editable JavaScript totals
6,591 lines across 100 modules, compared with 6,700 lines across 97 modules.
Shared helpers replace duplication without compressing the editable source.

An isolated Node 24 comparison against the pre-optimization sources used
deterministic text widths, nine warmups and the median of 21 alternating samples.
These measure calculation work, not complete browser interactions:

| Operation | Before | After |
| --- | ---: | ---: |
| Matrix, 26 people / 26 grades / 26 groups | 0.186 ms | 0.162 ms |
| Matrix, 500 people / 60 grades / 500 groups | 10.475 ms | 2.074 ms |
| Matrix, 2,000 people / 60 grades / 2,000 groups | 149.567 ms | 6.806 ms |
| Move first person after last, 2,000 people in one grade | 209.106 ms | 0.888 ms |
| Same move, 2,000 people interleaved over 60 grades | 48.610 ms | 2.229 ms |

Reordering includes an identical input clone on each side and excludes history
and DOM work. Matrix geometry was also compared exactly before timing. Large
matrix cases benefit most; these figures are not overall application speedups.

## Mutation checks

`npm run test:mutations` checks module/artifact contracts, reduced framing
coverage and the replacement integrity contracts in a temporary copy.
`node scripts/parity-mutation-check.mjs` breaks geometry, SVG, input immutability
and fixture identity in another temporary copy.
`node scripts/browser-mutation-check.mjs` exercises deliberate export, focus,
keyboard, roster, session and tour regressions in isolated built copies.
These scripts require assertion failures; startup failures and crashes do not
count as detection. They leave repository sources and hosted files untouched.
Browser mutations alter editable source and rebuild it, so generated variable
names and minifier formatting are not test contracts. The optimization passes
all 70 module/integrity/artifact mutations, 5 frozen-parity mutations and 18
browser wiring mutations.
