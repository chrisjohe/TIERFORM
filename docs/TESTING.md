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

The standard run executes 4,651 assertions across five suites, plus 13 direct
module assertions and 8 artifact assertions: 4,672 assertion calls in total.
These counts are not independent scenarios or a coverage percentage.

| Suite | Assertion calls | Main evidence |
| --- | ---: | --- |
| `harness.js` | 1,680 | Native layouts, photo framing, renderer agreement and PDF byte offsets |
| `dom.js` | 35 in 10 contracts | Markup/ARIA references, commands, artwork provenance, licenses, font and privacy boundaries |
| `document.js` | 1,416 | History, edit sessions, asynchronous operations, document and tour restoration |
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
functions or reads `_test/source.html`.

Document, fixture and import controller-isolation tests still use that legacy
adapter. It removes module declarations, maps feature-state qualifications to
isolated variables and connects notifications to existing stubs. It does not
prove initialization or imports. The remaining extractor copies have shared
behavioral self-checks. Their JavaScriptCore fallback remains; the standard
runner, native harness, integrity and artifact tests require Node.

`modules.mjs` covers engine-instance isolation, document/history behavior,
CSV and SVG escaping, layer boundaries and unresolved names across every
module. `artifacts.mjs` checks hosted/portable equality, project-relative
paths, CSP, font bytes, download parity and reproducibility.

## Browser and release checks

Four flows run in each Chromium, Firefox and WebKit project, against both
`file://` and a local `/TIERFORM/` build: 24 configured browser cases.

1. Boot, open photos, all layouts, roster Save, PNG/PDF/SVG/CSV values and
   hosted Copy PNG, with saved-status icon visibility.
2. Ribbon keys, modal initial focus, Tab/Shift+Tab wrapping, inert background,
   Escape and returned focus, coalesced typing, undo/redo and dirty icons.
3. Narrow roster visibility, accessible names/tooltips and no document edit.
4. Tour cancellation by Escape and Close, restoring chart, dirty status and
   undo history. Only generated clip IDs are normalized, preserving their
   distinct reference mapping.

Every flow checks console/page errors and network requests after initial
static loading. Exports are performed once per project, replacing repeated
export runs in separate network and console tests.

`engine-parity.mjs` compares 4,368 configurations with frozen hashes generated
solely from commit `7be5c66` (2026.8b). Complete geometry, normalized SVG and
input snapshots cover two measurement models. No git history is required;
never regenerate expected hashes from the candidate implementation.

The refactor's independent Chromium/WebKit comparisons matched the original
for both outputs: SVG, screenshots, PNG pixels, PDF/CSV bytes, saved documents,
editing, undo/redo, tour restoration, CSP and network behavior. Test reduction
kept all application-source and generated-output bytes unchanged.

The reduced local browser run passes all 16 Chromium/WebKit cases. The
Playwright Firefox binary fails before its automation handshake on this macOS
environment; its projects remain enabled in CI. Separate native Firefox 157
checks passed startup, photos, clipboard, PNG/PDF, layout undo and Save. Native
Safari passed startup, photos and clipboard; native Safari downloads and the
published Pages URL remain manual checks. See `test/MANUAL.md`.

## Mutation checks

`npm run test:mutations` checks module/artifact contracts, reduced framing
coverage and the replacement integrity contracts in a temporary copy.
`node scripts/parity-mutation-check.mjs` breaks geometry, SVG, input immutability
and fixture identity in another temporary copy.
`node scripts/browser-mutation-check.mjs` exercises deliberate export, focus,
keyboard, roster, session and tour regressions in isolated built copies.
These scripts require assertion failures; startup failures and crashes do not
count as detection. They leave repository sources and hosted files untouched.
