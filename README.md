# TIERFORM

Build a team chart from a list of names and photos — as a **pyramid**, a
**tornado**, a **histogram**, **swimlanes**, a **hive** or a **matrix** — and
export it as a PNG, a PDF, an SVG or a CSV.

**Version 2026.10a.** Use the hosted app, or download the self-contained HTML
file and open it offline. No install or account is needed.

![Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue) — see [LICENSE](LICENSE)

---

## Using it

[Download `tierform_app.html`](https://github.com/chrisjohe/TIERFORM/releases/latest/download/tierform_app.html)
and double-click it. That is the whole setup.

Or [open it at chrisjohe.github.io/TIERFORM](https://chrisjohe.github.io/TIERFORM/)
in your browser. The hosted app loads its JavaScript, styles and Open Sans font
from this site. After that initial load, editing and exporting make no network
requests. The offline download embeds the same code, styles and font. Hosting
also enables **Copy PNG** in browsers that withhold it from `file://` pages.

The ribbon has three tabs — **Start**, **Structure** and **Design** — and a
**Roster** panel down the left that lists everyone on the chart. The panel can
be hidden; a slim rail at the left edge brings it back.

1. **Start** — file commands, exports, adding people and the Info documents,
   in groups running File, Export, People, Info from left to right.
2. **Structure** — the grades: add, rename, reorder, colour and combine them;
   apply a template; manage the groups that give the chart its second
   dimension.
3. **Design** — the look: layout, spacing, page, angle, header, labels,
   colours and the font.

Your work lives in a **roster file** (`.json`) that you save and re-open. The
app stores nothing between visits — see [Privacy](#privacy) for why that is
deliberate.

---

## Privacy

**Nothing leaves your machine.** While you edit and while you export, the app
makes **no network requests at all** — no uploads, no analytics, no
telemetry, no error reporting. The hosted app first loads its static files
from this site; the offline file already includes them. Attribution links in
the Info group reach their destinations only when you click them.

This is enforced, not just promised: the test suite fails the build if
`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, a dynamic `import()` or
a `<form>` appears anywhere in the source.

**There is no in-app storage — deliberately.** No localStorage, no IndexedDB,
not even a draft. Opened from a file there is no reliable storage to use, so
anything "saved" in-app would evaporate on reload and quietly lose work. The
roster file is the only durable thing, which is why the app warns before you
close a tab with unsaved changes.

### Roster files are personal data

A roster file contains names, groups, roles and the photos themselves,
embedded in full. In most jurisdictions that makes it personal data, with the
obligations that follow. So do the exports: the PNG, the PDF, the SVG and the
CSV all carry the names, and all but the CSV the faces.

Share rosters and charts only with people entitled to see who is in the team.
Emailing a chart to a wide distribution list is a disclosure like any other.

### ⚠️ Opening a roster file from someone else

This is the one genuinely risky action. A roster file is a document from an
untrusted source, and it is treated as one:

- Every imported file is validated before it is opened, and refused whole if
  its structure cannot be trusted — including a file that declares a roster
  format this build does not read. A refused file never touches the roster
  you have open.
- All identifiers are regenerated on import, so nothing from the file can
  reach the page as markup.
- Photos must be JPEG or PNG data URLs within a size limit. URLs, SVG data
  URLs and anything else are dropped, and you are told which person lost a
  picture.
- **Each photo's header is read from the bytes before the browser is asked to
  decode it** — the PNG signature and IHDR, or the JPEG start marker and its
  first frame header. The type the file declares has to match what is
  actually there, so a PNG labelled as a JPEG, an SVG document inside a JPEG
  envelope, or a paragraph of text inside either one is refused at that
  point. The size the header declares is checked against the limits there
  too, so a picture far too large to draw is dropped without ever being
  decoded.
- The photo is then decoded to confirm the rest of it is readable, and the
  decoded dimensions must agree with the header. The real dimensions are
  used, not the ones the file claims. A roster full of photos takes a moment
  to open; the status bar says so while it works.
- **A bad photo costs only that photo.** The person keeps their name, grade,
  group and role, the rest of the roster opens normally, and the reason is
  listed for you afterwards. Only a broken *structure* refuses the file
  whole.
- Values that are merely wrong — an unknown colour, an unknown layout — are
  repaired to their defaults, counted, and reported after opening.

None of this sandboxes image decoding — no page can do that — and the checks
are deliberately bounded rather than exhaustive; [SECURITY.md](SECURITY.md)
states precisely what they do and do not prove. The ordinary habit is still
the right one: **open roster files from people you know.**
