function readFile(path){
  if(typeof require !== "undefined") return require("fs").readFileSync(path, "utf8");
  ObjC.import("Foundation");
  return $.NSString.stringWithContentsOfFileEncodingError(
    path, $.NSUTF8StringEncoding, null).js;
}
function here(){
  if(typeof __dirname !== "undefined") return __dirname + "/../";
  ObjC.import("Foundation");
  return $.NSFileManager.defaultManager.currentDirectoryPath.js + "/";
}

const HTML   = readFile(here() + "tierform_app.html");
const SCRIPT = /<script>([\s\S]*)<\/script>/.exec(HTML)[1];
const STYLE  = /<style[^>]*>([\s\S]*?)<\/style>/.exec(HTML)[1];

function cssRules(css){
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const at = [];
  let i = 0, buf = "";
  while(i < clean.length){
    const c = clean[i];
    if(c === "{"){
      const sel = buf.trim(); buf = "";
      if(sel.charAt(0) === "@"){ at.push(sel); i++; continue; }
      let j = i + 1, depth = 1;
      while(j < clean.length && depth){
        if(clean[j] === "{") depth++;
        else if(clean[j] === "}") depth--;
        j++;
      }
      rules.push({sel:sel, decls:clean.slice(i + 1, j - 1), at:at.slice()});
      i = j; continue;
    }
    if(c === "}"){ at.pop(); buf = ""; i++; continue; }
    buf += c; i++;
  }
  return rules;
}
const RULES = cssRules(STYLE);

function compound(text){
  const out = {tag:null, id:null, cls:[], attrs:[], pseudo:[], odd:false};
  const re = /(::?[a-z-]+(?:\([^)]*\))?)|(#[\w-]+)|(\.[\w-]+)|(\[[^\]]+\])|([A-Za-z][\w-]*)|(\*)/g;
  let m, seen = 0;
  while((m = re.exec(text))){
    seen += m[0].length;
    if(m[1]) out.pseudo.push(m[1]);
    else if(m[2]) out.id = m[2].slice(1);
    else if(m[3]) out.cls.push(m[3].slice(1));
    else if(m[4]) out.attrs.push(m[4].slice(1, -1));
    else if(m[5]) out.tag = m[5];
  }
  if(seen !== text.length) out.odd = true;
  return out;
}

function parseSelector(sel){
  if(/[>+~]/.test(sel)) return null;
  const parts = sel.trim().split(/\s+/).map(compound);
  return parts.some(p => p.odd) ? null : parts;
}
function matchOne(c, el, active){
  if(c.tag && c.tag !== el.tag) return false;
  if(c.id && c.id !== el.id) return false;
  if(!c.cls.every(k => el.cls.indexOf(k) >= 0)) return false;
  if(!c.attrs.every(a => Object.prototype.hasOwnProperty.call(el.attrs, a.split(/[=~^$*|]/)[0]))) return false;
  if(!c.pseudo.every(p => active.indexOf(p) >= 0)) return false;
  return true;
}

function matches(parts, chain, active){
  let k = chain.length - 1;
  for(let p = parts.length - 1; p >= 0; p--){
    if(p === parts.length - 1){
      if(!matchOne(parts[p], chain[k], active)) return false;
      k--;
    }else{
      let found = false;
      while(k >= 0){ if(matchOne(parts[p], chain[k], active)){ found = true; k--; break; } k--; }
      if(!found) return false;
    }
  }
  return true;
}
function specificity(parts){
  let a = 0, b = 0, c = 0;
  parts.forEach(p => {
    if(p.id) a++;
    b += p.cls.length + p.attrs.length + p.pseudo.filter(x => x.indexOf("::") !== 0).length;
    if(p.tag) c++;
  });
  return a * 10000 + b * 100 + c;
}
function lastDecl(decls, prop){
  const re = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)", "g");
  let m, v = null;
  while((m = re.exec(decls))) v = m[1].trim();
  return v;
}

function tagOf(id){
  const m = new RegExp("<([a-z]+)([^>]*\\sid=\"" + id + "\"[^>]*)>").exec(HTML);
  if(!m) throw new Error("markup for #" + id + " not found");
  const attrs = {};
  let a;
  const re = /([\w-]+)(?:="([^"]*)")?/g;
  while((a = re.exec(m[2]))) attrs[a[1]] = a[2] === undefined ? "" : a[2];
  return {tag:m[1], id:id, cls:(attrs["class"] || "").split(/\s+/).filter(Boolean), attrs:attrs};
}
const ICON_SAVED   = tagOf("docIconSaved");
const ICON_UNSAVED = tagOf("docIconUnsaved");
const DOC_WRAP     = tagOf("docName");

function displayOf(icon, classes, active){
  const wrap = {tag:DOC_WRAP.tag, id:DOC_WRAP.id, cls:classes.slice(), attrs:DOC_WRAP.attrs};
  return resolveDisplay([{tag:"body", id:null, cls:[], attrs:{}}, wrap, icon], active);
}

function resolveProp(chain, prop, active){
  let best = null, bestSpec = -1;
  RULES.forEach(r => {
    if(r.at.length) return;
    r.sel.split(",").forEach(one => {
      const parts = parseSelector(one);
      if(!parts) return;
      if(!matches(parts, chain, active || [])) return;
      const v = lastDecl(r.decls, prop);
      if(v === null) return;
      const spec = specificity(parts);
      if(spec >= bestSpec){ bestSpec = spec; best = v; }
    });
  });
  return best;
}
function resolveDisplay(chain, active){
  const v = resolveProp(chain, "display", active);
  return v === null ? "inline" : v;
}
function iconsShown(classes, active){
  return {saved:   displayOf(ICON_SAVED,   classes, active) !== "none",
          unsaved: displayOf(ICON_UNSAVED, classes, active) !== "none"};
}

function maskLiterals(src){
  const out = src.split(""), n = src.length;
  const sp = k => { if(out[k] !== "\n") out[k] = " "; };

  const REWORD = /^(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;
  const stack = [{tmpl:false, depth:0}];
  let value = false;
  let i = 0;
  while(i < n){
    const top = stack[stack.length - 1], c = src[i];

    if(top.tmpl){
      if(c === "\\"){ sp(i); if(i + 1 < n) sp(i + 1); i += 2; continue; }
      if(c === "`"){ sp(i); i++; stack.pop(); value = true; continue; }
      if(c === "$" && src[i + 1] === "{"){
        sp(i); stack.push({tmpl:false, depth:0}); i += 2; value = false; continue;
      }
      sp(i); i++; continue;
    }

    if(c === "/" && src[i + 1] === "/"){
      while(i < n && src[i] !== "\n"){ sp(i); i++; }
      continue;
    }
    if(c === "/" && src[i + 1] === "*"){
      const e = src.indexOf("*/", i + 2), end = e < 0 ? n : e + 2;
      while(i < end){ sp(i); i++; }
      continue;
    }
    if(c === '"' || c === "'"){
      let j = i + 1;
      while(j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      if(j < n && src[j] === c){ while(i <= j){ sp(i); i++; } }
      else i++;
      value = true; continue;
    }
    if(c === "`"){ sp(i); stack.push({tmpl:true, depth:0}); i++; continue; }
    if(c === "/" && !value){
      let j = i + 1, cls = false, end = -1;
      for(; j < n; j++){
        const ch = src[j];
        if(ch === "\n") break;
        if(ch === "\\"){ j++; continue; }
        if(cls){ if(ch === "]") cls = false; continue; }
        if(ch === "[") cls = true;
        else if(ch === "/"){
          j++;
          while(j < n && /[A-Za-z]/.test(src[j])) j++;
          end = j; break;
        }
      }
      if(end > 0){ while(i < end){ sp(i); i++; } value = true; continue; }
    }
    if(/[A-Za-z0-9_$]/.test(c)){
      let j = i;
      while(j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      value = !REWORD.test(src.slice(i, j));
      i = j; continue;
    }
    if(c === "}" && top.depth === 0 && stack.length > 1){
      stack.pop(); i++; value = true; continue;
    }
    if(c === "{"){ top.depth++; value = false; i++; continue; }
    if(c === "}"){ top.depth--; value = false; i++; continue; }
    if(c === ")" || c === "]"){ value = true; i++; continue; }
    if(c === " " || c === "\t" || c === "\n" || c === "\r"){ i++; continue; }
    value = false; i++;
  }
  return out.join("");
}

const MASK = maskLiterals(SCRIPT);

function grabFn(name){
  const start = MASK.search(new RegExp("(^|\\n)(async\\s+)?function\\s+" + name + "\\s*\\("));
  if(start < 0) throw new Error("not found: function " + name);
  let depth = 0;
  for(let j = MASK.indexOf("{", start); j < MASK.length; j++){
    if(MASK[j] === "{") depth++;
    else if(MASK[j] === "}" && !--depth) return SCRIPT.slice(start, j + 1);
  }
  throw new Error("unbalanced: " + name);
}
function grabDecl(name){
  const m = new RegExp("(^|\\n)(const|let)\\s+" + name + "\\s*=").exec(MASK);
  if(!m) throw new Error("not found: " + name);
  const start = m.index + (m[1] ? 1 : 0);
  let depth = 0;
  for(let j = start; j < MASK.length; j++){
    const c = MASK[j];
    if("{[(".includes(c)) depth++;
    else if("}])".includes(c)) depth--;
    else if(c === ";" && depth === 0) return SCRIPT.slice(start, j + 1);
  }
  throw new Error("unterminated: " + name);
}

function braceBody(start, label){
  const arrow = MASK.indexOf("=>", start);
  const open  = MASK.indexOf("{", arrow);
  let depth = 0;
  for(let j = open; j < MASK.length; j++){
    if(MASK[j] === "{") depth++;
    else if(MASK[j] === "}" && !--depth) return SCRIPT.slice(open, j + 1);
  }
  throw new Error("unbalanced listener: " + label);
}
function grabListener(selector, event, nth){
  const needle = '$("' + selector + '").addEventListener("' + event + '"';
  let start = -1;
  for(let i = 0; i < (nth || 1); i++){
    start = SCRIPT.indexOf(needle, start + 1);
    if(start < 0) throw new Error("not found: listener " + selector + " " + event
      + " #" + (nth || 1));
  }
  return braceBody(start, selector + " " + event);
}

function grabRawListener(needle, label){
  const start = SCRIPT.indexOf(needle);
  if(start < 0) throw new Error("not found: " + (label || needle));
  return braceBody(start, label || needle);
}

const DECLS = ["HEX6","CONTRAST_MIN","SVGNS",
               "uid","HISTORY_MAX","SESSION_IDLE","ZOOM_MAX","docName","dirtyDoc",
               "history","hIndex","historyPending","photoStore","photoIds","photoSeq","session",

               "LIMITS","ENUMS",

               "FILE_FORMAT",
               "docGen","importBusy","openSeq","COMMANDS",

               "importResolve",

               "pasteRows","PASTE_NEW","PASTE_NEW_CODE","PASTE_NEW_LABEL",

               "addPending","PREVIEW_R","modalReturn","PAN_STEP","ADD_FRAME_KEY",

               "personOpen","editId",

               "rosterQuery",

               "tourSaved", "tourStep", "TOUR", "tourCount", "tourCurrent"];

const FNS   = ["updateDocLabel","syncNeverSavedBar","markDirty","resetPerRoster","confirmDiscard","newDoc",

               "saveDoc","stateLimitProblem","encodedPhotoBytes","photoBudgetExceeded","openDoc","fileStem",

               "toCSV",
               "firstTierId",

               "newTier",

               "TEMPLATES","applyTemplate",

               "demoDoc","startTour","endTour","tourGoto","tourLiveSteps",
               "defaults","normalizeGradeLinks","reorderGrade","angleIndex","clampFrame",
               "frameLimit","photoPut","photoGet","photoSweep","packState","unpackState",
               "snapshot","canUndo","canRedo","undo","redo","render","commit","endEdit","edit",

               "newGroup","resolveGroupId","groupLabel","pruneGroups",

               "move","moveGroup","renameGroup","reorderGroupRow",
               "groupRow","syncGroupModal","openGroupModal","closeGroupModal",

               "newGeneration","staleWrite","addFiles","nameFromFile","photoFields","applyPhoto",

               "photolessMatch","addPhotoIntoDialog",

               "addOnePerson","syncAddAvailability","openAddModal","closeAddModal",

               "fillGroupOptions",

               "closePersonMenu","closeEditModal",
               "setAddPhoto","frameRect",

               "syncAddFramePreview","addFrameShim",

               "syncAddPhotoInitials",

               "syncAddRolePlaceholder",

               "askImport","importClose",

               "splitCsvLine","splitPasteRow","matchTierByGrade","parsePasteText",
               "pasteNewTier",

               "pasteGradePlan",
               "showPastePreview","confirmPaste",
               "openPasteModal","closePasteModal","el","fill","clear",

               "clampText",

               "gradeName","moveTarget","moveLabelTo","moveLabel","movePerson",

               "personSlot","personDropIsNoop","walkOnce","reorderPerson",

               "personLabel","validatePhoto","moveAffordance","syncRowIdentity",

               "rosterFiltered","personMatches","clearRosterSearch",

               "validColour","hexFieldValue","luminance","contrastRatio","checkContrast",

               "initials","tierRole","icon","personRowName","editPerson","firstName",
               "openEditModal","syncEditModal","syncEditPhoto","editPhotoBody",
               "framePanel","syncFramePreview","placeFramePreview",

               "rowMenuFor","syncPersonMenu","focusPersonMenuItem","removePerson"];

const PREAMBLE = `
  let framingId = null, state = null;
  let TIMERS = 0;
  function setTimeout(fn){ TIMERS++; return TIMERS; }   // sessions never expire on their own here
  function clearTimeout(){}
  const DOWNLOADS = [], TOASTS = [], LABELS = [];
  let CONFIRM = true;            // what a confirm dialog resolves to
  let PROMPT  = null;            // what a text dialog resolves to (null = cancelled)
  let PICKED  = 0;               // times the file picker was opened
  const ASKED = [];              // every dialog raised, for inspecting the wording
  /* Scripted answer to startTour's one real DOM question: is a modal open.
     Every one of the seven modals shares the class ".modal-backdrop", toggled
     by the "hidden" attribute — startTour asks that exact question through
     document.querySelector, and MODAL_OPEN is the whole of what a test sets
     to answer it either way. */
  let MODAL_OPEN = false;
  /* closeMenu and closeGradePanel are chrome test/dom.js owns — they measure
     and place ribbon popups this suite has no geometry for — so they are
     stubbed as plain no-ops here, the same standing as drawChart just above.
     startTour calls both on its way in; what it does with the rest of the
     document is this suite's business, not whether a menu happened to be
     open. menuOpen is stubbed alongside them for the same reason — nothing
     here opens a menu, so it always answers false. */
  function menuOpen(){ return false; }
  function closeMenu(){}
  function closeGradePanel(){}
  /* The real ask() opens a dialog and resolves when a button is clicked. Here
     it resolves immediately with a scripted answer, so a run stays
     deterministic — but it stays a PROMISE, because these paths are
     genuinely asynchronous, and a stub that resolved synchronously would let
     a caller's await slip past unnoticed. */
  function askConfirm(title, message, label){
    ASKED.push({kind:"confirm", title:title, message:message, label:label});
    return Promise.resolve(CONFIRM);
  }
  /* COMMANDS.addGrade asks for a code and a name and offers a default for each.
     Answered here with exactly the defaults it offered — pressing Enter twice,
     which the command's own comment confirms is still the fast path — so
     the grade it creates can be compared against the one a paste creates
     without either being compared to the constant it was built from. */
  const ASKED_FIELDS = [];
  let FIELD_ANSWER = "defaults";     // "defaults", null for cancelled, or an object
  function askFields(title, message, fields, confirmLabel){
    ASKED_FIELDS.push({title:title, message:message, fields:fields, label:confirmLabel});
    if(FIELD_ANSWER !== "defaults") return Promise.resolve(FIELD_ANSWER);
    const out = {};
    (fields || []).forEach(f => { out[f.key] = f.value; });
    return Promise.resolve(out);
  }
  function askText(title, message, value){
    ASKED.push({kind:"text", title:title, message:message, value:value});
    return Promise.resolve(PROMPT);
  }
  function toast(m){ TOASTS.push(m); }
  const ALERTS = [];
  function alertMsg(m){ ALERTS.push(m); }
  /* renderAll rebuilds the roster on its way through, which is what puts an
     undone photo back into the open dialog. Same standing as the two calls
     below: that the APP'S renderAll does it is test/dom.js's assertion. */
  const STEPS = {n:0};
  function renderAll(){ renderRoster(); }
  /* The two the real renderRoster makes at this point, and the reason a commit
     from inside the dialog is a whole path here rather than a call followed by
     a hand-run sync. That the APP'S renderRoster still makes them is
     test/dom.js's assertion; what this reproduces is the ordering they happen
     in, so the behaviour under test is driven the way a click drives it. */
  function renderRoster(){ syncPersonMenu(); syncEditModal(); }
  function drawChart(){}
  function updateHistoryButtons(){}
  function Blob(parts, opts){ this.parts = parts; this.type = opts && opts.type; }
  /* WRITTEN keeps the bytes as well as the name, so a test can read back what a
     roster file actually contains rather than only that one was produced. */
  const WRITTEN = [];
  function download(blob, name){
    DOWNLOADS.push(name);
    WRITTEN.push({name:name, text:(blob && blob.parts || []).join("")});
  }

  /* Decoding is where the document can change underneath an import, so the
     stub hands the test the resolver instead of resolving on its own. Nothing
     completes until the test says so, which is what makes "New was pressed
     halfway through the batch" an ordinary, deterministic assertion. */
  const DECODES = [];
  function processImage(file){
    return new Promise((res, rej) => DECODES.push({name:file.name, res:res, rej:rej}));
  }
  let swapId = null;                  // the row whose photo is being replaced

  /* The import dialog. addFiles asks before it imports now, so a suite that
     never answers would hang on the first drop — IMPORT_ANSWER is what the
     dialog will be answered with, and it defaults to null, which is Cancel.
     A test that wants an import says so with answerImportWith().
     The dialog function itself is the REAL one: what is stubbed is the DOM it
     writes to and modalOpen, so the count wording and the no-grades state are
     asserted against the shipped logic rather than a copy of it. */
  const IMPORT = {count:"", countShown:true, noGradesShown:false,
                  confirmDisabled:false, tier:"", group:""};
  let IMPORT_ANSWER = null;
  const MODALS = [];
  function modalOpen(id, focusEl){
    MODALS.push({id:id, action:"open"});
    if(id === "#importModal"){
      /* answered on a later turn, the way a user would: addFiles must be parked
         on the promise before anything resolves it */
      const answer = IMPORT_ANSWER;
      Promise.resolve().then(()=> importClose(answer));
    }
  }
  function modalClose(id){ MODALS.push({id:id, action:"close"}); }

  /* The Add people dialog's fields, as state rather than as DOM. A test drives
     them with setAdd() and reads them back after an Add, which is how "Grade
     alone persists while Photo, Name, Role and Group clear" becomes an
     assertion rather than a screenshot. tierFieldShown/firstGradeFieldShown/templateHintShown
     are what syncAddAvailability writes now that zero grades is a door, not a
     wall: it toggles which half of the Grade row is on screen instead of
     disabling anything. wellShown is what setAddPhoto's own hidden-toggle
     writes; what the well actually shows with a photo in it — the decoded
     bytes, and the frame a drag or a zoom left behind — is addPending itself
     now that both dialogs share framePanel, exactly as Edit's own preview is
     read off the person rather than off a DOM node. */
  const ADD = {tier:"", group:"", name:"", role:"", rolePlaceholder:"", files:[],
               firstGrade:"",
               tierFieldShown:true, firstGradeFieldShown:false, templateHintShown:false,
               wellShown:false, pickText:""};
  /* The Group field's shared suggestion list, filled by the real fillGroupOptions
     through the real clear()/el() — one persistent element for the whole run,
     same reason #pasteTableBody is, so a refill is observably a replacement
     rather than a write into a throwaway. */
  let GROUP_OPTIONS = null;
  /* The Group modal's own list, filled by the real syncGroupModal through the
     real fill()/el() — one persistent element for the whole run, same reason
     #pasteTableBody and #groupOptions above are, so a rebuild is observably a
     replacement rather than a write into a throwaway. GROUP_EMPTY is the
     empty-state paragraph's hidden flag, backed the same way #pastePreview's is. */
  let GROUP_LIST = null;
  const GROUP_EMPTY = {hidden: false};
  const FOCUSED = [];
  /* The placeholder section's one focusable control, reached by the Add
     framing editor's own remove handler exactly as Edit's reaches into its
     rebuilt #editPhoto — a persistent object, not a fresh one per lookup, so
     a focus() call on it is observable afterwards. */
  const ADD_EMPTY_PICK = {focus(){ FOCUSED.push("#addPhotoPick"); }};
  /* The real one builds <option> elements; what addOnePerson depends on is only
     that the select ends up holding the id it asked to keep. test/fixtures.js
     owns the option-building against a DOM stub. */
  function fillTierOptions(select, want){ select.value = want || ""; return select; }

  /* ---- the paste dialog -------------------------------------------------

     el(), fill() and clear() are the REAL ones, so the preview table is built by
     the app's own constructors; what is stubbed is the element they build. Only
     what showPastePreview actually writes is backed: a tag, a class, a title,
     textContent, and children. firstChild/removeChild are here because clear()
     walks them, and a stub without them would make fill() throw rather than
     empty the body — a throw abandons the section and looks like coverage. */
  function stubEl(tag){
    const n = {tag:tag, className:"", title:"", textContent:"", kids:[]};
    Object.defineProperty(n, "firstChild", {get(){ return n.kids[0] || null; }});
    n.appendChild = k => { n.kids.push(k); return k; };
    n.removeChild = k => { const i = n.kids.indexOf(k); if(i >= 0) n.kids.splice(i,1); return k; };
    n.setAttribute = (a, v) => { n[a] = v; };
    /* Enough of a query for the one thing the app asks a built subtree: which
       control to put focus on after a rebuild. Tag and the :not([disabled])
       filter only — a selector shape it does not implement throws, where
       shrugging would be indistinguishable from "the app did not look". */
    n.querySelector = sel => {
      const live = sel.indexOf(":not([disabled])") > 0;
      const tag  = live ? sel.slice(0, sel.indexOf(":")) : sel;
      if(!/^[a-z]+$/.test(tag))
        throw new Error("stubEl querySelector: unsupported selector " + sel);
      const hit = k => (k.tag === tag && (!live || !k.disabled)) ? k
                     : (k.querySelector ? k.querySelector(sel) : null);
      for(const k of n.kids){ const found = hit(k); if(found) return found; }
      return null;
    };
    n.focus = () => { FOCUSED.push(n.tag + ":" + (n.dataset.act || n.dataset.fact || "")); };
    n.dataset = {};
    return n;
  }
  /* selectTab is chrome — dom.js owns the tab/pane machinery, not this
     suite — so it is a recording no-op rather than the real function.
     tourLiveSteps() calls it once per TOUR row, before measuring that row's
     own anchor, and showTourStep() calls it once more for the step landed
     on; recording every call is what keeps that measure-behind-the-scenes
     behaviour observable without this suite growing any tab/pane state of
     its own to keep in sync. */
  const TABS_SELECTED = [];
  function selectTab(name, focusTab){ TABS_SELECTED.push(name); }
  /* body.tour-on is the ONE truth the CSS reads for tour visibility — the
     same standing body.roster-hidden has for the panel — and this suite's
     whole interest in it is behavioural: that startTour/endTour write it on
     the line immediately beside each write of tourSaved, never on their own.
     CLASSES is the second source that answers that: every add/remove the
     app's document.body.classList sees, in order, so "the class truth sits
     adjacent to tourSaved" is read off a log rather than off the source text
     of the function being tested. */
  const CLASSES = [];
  /* Chrome test/dom.js owns — it measures a real anchor's getBoundingClientRect
     and places the ring and the card, none of which this suite has geometry
     for. Stubbed here to record which step it was asked to show, which is
     what proves tourGoto's own replay loop calls it once per step, in order,
     without embedding any of that geometry. Declared here rather than pulled
     from FNS, so this stub — not the real one — is what tourGoto calls.
     showTourStep's own signature is (step, pos, count) now that a skipped
     step can shift both — SHOWN records all three, plus the row's own
     anchor, so "the run fired at the step whose anchor is #layoutBtn, not
     at a fixed index" is an assertion about what was actually shown rather
     than a recomputation of the same skip logic the app performs. */
  const SHOWN = [];
  function showTourStep(step, pos, count){
    SHOWN.push({pos:pos, count:count, anchor:step.anchor});
  }
  /* Every TOUR anchor's rect, keyed by its own literal selector — a small
     non-zero box by default, so tourLiveSteps() keeps every step live
     unless a test narrows one on purpose through setRect(). Anchors are the
     app's own TOUR rows' literals; a row this map has no entry for throws
     below rather than silently answering null, which is what makes a ninth
     anchor nobody added here fail loudly instead of vanishing from the tour. */
  const RECTS = {
    '[data-cmd="addPeople"]': {width:100, height:24},
    "#exportMenuBtn":         {width:100, height:24},
    "#saveSplit":             {width:100, height:24},
    "#qat":                   {width:100, height:24},
    "#tiers":                 {width:100, height:24},
    '[data-cmd="groups"]':    {width:100, height:24},
    "#roster":                {width:100, height:24},
    "#sheet":                 {width:100, height:24},
    "#layoutBtn":             {width:100, height:24},
    "#pageBtn":               {width:100, height:24},
    "#nameLabelsBtn":         {width:100, height:24},
    "#accentBtn":             {width:100, height:24},
    '[data-cmd="tour"]':      {width:100, height:24}
  };
  function setRect(sel, wh){ RECTS[sel] = wh; }
  /* Every extracted function that touches the DOM has it stubbed at $()
     instead, with one exception: startTour reads document.querySelector
     directly to ask whether a modal is open, which is why this object now
     answers that question for real, as well as building el() and the
     preview's text nodes. (No backticks in PREAMBLE: it is one template
     literal, and a quoted identifier in a comment ends it.) */
  const document = {createElement:stubEl,
                    /* icon() builds its <svg><use> in the SVG namespace, and
                       createElement would give it an inert HTML element of the
                       same name — so the stub answers both, and records which. */
                    createElementNS(ns, tag){ const n = stubEl(tag); n.ns = ns; return n; },
                    contains(){ return false; },
                    createTextNode(t){ const n = stubEl("#text"); n.textContent = String(t); return n; },
                    activeElement: null,
                    body: {classList: {
                      add(c){ CLASSES.push({op:"add", cls:c}); },
                      remove(c){ CLASSES.push({op:"remove", cls:c}); }
                    }},
                    /* startTour's own modal-open check answers for real. Giving
                       document a querySelector at all also makes syncRowIdentity's
                       OWN guard (its early "if there is no document.querySelector,
                       give up" line) start calling through it — that guard was
                       never reachable before this, because there was nothing here
                       to call. Every one of its queries is one of a handful of
                       fixed prefixes suffixed with the row's own data-id
                       attribute selector, asking "does this roster row exist on
                       screen" — which it never does in this suite, so answering
                       null for all of them is the same "nothing built here" this
                       stub already answers everywhere else, not a new leniency.
                       tourLiveSteps() queries every TOUR anchor in turn — RECTS
                       above answers those, and a selector matching none of the
                       three known shapes is a query this module never saw
                       coming, where shrugging would be indistinguishable from
                       "the app did not look" (the same stance stubEl's own
                       querySelector takes). */
                    querySelector(sel){
                      if(sel === ".modal-backdrop:not([hidden])") return MODAL_OPEN ? {} : null;
                      if(sel.indexOf('[data-id="') >= 0) return null;
                      if(Object.prototype.hasOwnProperty.call(RECTS, sel))
                        return {getBoundingClientRect(){ return RECTS[sel]; }};
                      throw new Error("document.querySelector: unsupported selector " + sel);
                    }};
  /* Everything the built table says, flattened the way a browser's own
     textContent would read it. This is what makes "the Grade column names NEW"
     an assertion about the emitted cell rather than about a variable. */
  function cellText(n){
    if(!n) return "";
    return (n.textContent || "") + n.kids.map(cellText).join("");
  }
  /* The dialog as state. PASTE.body is filled by the real fill() through the
     #pasteTableBody stub, so it holds whatever the real preview emitted. */
  const PASTE = {area:"", entryShown:false, previewShown:false, summary:"",
                 body:null, addDisabled:false, addTitle:"",
                 replaceDisabled:false, replaceTitle:""};
  function pasteCells(){
    return (PASTE.body ? PASTE.body.kids : []).map(tr => tr.kids.map(cellText));
  }

  /* Opening is asynchronous twice over — a read, then one image decode per
     photo — so the same trick as the decode stub: openRoster hands the test its
     resolver and finishes only when the test says so. That is what makes "two
     Opens finishing in the wrong order" a deterministic assertion instead of a
     race nobody can reproduce. */
  const OPENS = [];
  function openRoster(raw, options){
    return new Promise((res, rej) => OPENS.push({raw:raw, options:options, res:res, rej:rej}));
  }
  const OPENING = [];                 // every status message the open path set
  function openingStatus(m){ OPENING.push(m || ""); }
  let READ_FAILS = false;             // make the next FileReader fail instead
  let READ_HOLD  = false;             // …or neither, until the test says which
  /* A read that finishes immediately cannot be superseded, because nothing can
     happen between readAsText and onerror. READ_HOLD parks the reader instead
     and hands the test its two endings, which is what makes "the file failed to
     read AFTER a newer Open started" an ordinary assertion. */
  const READS = [];
  function FileReader(){
    const self = this;
    this.readAsText = function(f){
      READS.push({
        name: f.name,
        fail(){ self.onerror && self.onerror(); },
        deliver(){ self.result = f.text; self.onload && self.onload(); }
      });
      if(READ_HOLD) return;
      if(READ_FAILS){ self.onerror && self.onerror(); return; }
      self.result = f.text;
      self.onload && self.onload();
    };
  }

  /* The status strip is stateful across calls, so these have to be the SAME
     objects every time — a fresh stub per lookup would make every assertion
     about what updateDocLabel produced read back its own default. */
  /* ICON_WRITES traps any attempt to drive the icons from script. That is the
     bug this whole area exists for: setting .hidden on an <svg> writes a
     property the browser never reads, so the only safe rule is that
     updateDocLabel does not touch these two elements at all. A write recorded
     here is a failure, not a state. */
  const ICON_WRITES = [];
  function iconStub(id){
    const o = {id:id};
    ["hidden","style","className"].forEach(prop => {
      Object.defineProperty(o, prop, {
        get(){ return undefined; },
        set(v){ ICON_WRITES.push(id + "." + prop + " = " + v); }
      });
    });
    return o;
  }
  /* TITLE_WRITES traps any attempt to write a tooltip from updateDocLabel —
     there is no tooltip at all, since the status text beside the icon is
     visible on its own. A write recorded here is
     a regression, not a state; nothing legitimately reads DOC.name.title any
     more, so there is no getter returning a real value to trip up. */
  const TITLE_WRITES = [];
  const DOC = {
    name:    {classes:{}, classList:{toggle(c,on){ DOC.name.classes[c] = !!on; }},
              get title(){ return undefined; },
              set title(v){ TITLE_WRITES.push(v); }},
    text:    {textContent:""},
    saved:   iconStub("docIconSaved"),
    unsaved: iconStub("docIconUnsaved"),
    status:  {textContent:""}
  };
  const NEVER_SAVED = {hidden:true, text:""};
  /* The Accent control: the OS picker's value, the hex field's text, and what
     the contrast warning is showing. SUMMARIES counts the ribbon refresh, which
     is what keeps the swatch in step with the value. */
  /* ink is the third control the swatches write: a curated accent sets the text
     colour that goes on it as well, and a stub that dropped that write would let
     "the ribbon still shows both" pass while the app showed one. */
  const EDIT = {name: stubEl("input"), group: stubEl("input"),
                role: stubEl("input"), tier: stubEl("select"),
                photo: stubEl("div"), menu: stubEl("div")};
  EDIT.menu.hidden = true;            // no row menu is showing unless a test opens one
  ["name","group","role","tier"].forEach(k => { EDIT[k].value = ""; });
  EDIT.role.placeholder = "";
  const COLOUR = {picker:"", hex:"", ink:""};
  const WARN = {shown:false, text:"", badge:false};
  /* The drop zone's own element: zoneDrop (grabbed below) reads it as a free
     closure variable, exactly as the shipped listener does — it is bound to
     one zone shared by both drop targets through a forEach, not built fresh
     per $(selector) call, so it needs a standing stub rather than one riding
     along inside $(). Only .classList.remove is ever called on it. */
  let zone = {classList:{add(){}, remove(){}}};
  let SUMMARIES = 0;
  function syncStyleSummaries(){ SUMMARIES++; }
  function $(sel){
    if(sel === "#jsonPick") return {click(){ PICKED++; }};
    /* a roster host that contains nothing: syncRowIdentity runs end to end and finds
       no control to write to, which is exactly the shape this suite watches —
       whether it touched the DOCUMENT. test/fixtures.js owns the labels. */
    if(sel === "#roster") return {querySelector(){ return null; }};
    /* No row menu is open unless a test opens one, and this is the state
       closePersonMenu returns on. */
    if(sel === "#personMenu") return EDIT.menu;
    /* The Edit dialog. Its four fields are static markup in the app, so they are
       backed values here — a catch-all stub returns a fresh object per lookup,
       and "the dialog shows this person's group" would then be asserted against
       a throwaway. #editPhoto is ONE element for the whole run for the same
       reason: what a rebuild put in it has to be readable afterwards — and it
       needs real children, because the Remove photo branch looks inside the
       rebuilt section for something to put focus on. */
    if(sel === "#editName")   return EDIT.name;
    if(sel === "#editGroup")  return EDIT.group;
    if(sel === "#editRole")   return EDIT.role;
    if(sel === "#editTier")   return EDIT.tier;
    if(sel === "#editPhoto")  return EDIT.photo;
    if(sel === "#importCount")   return {get textContent(){ return IMPORT.count; },
                                         set textContent(v){ IMPORT.count = v; },
                                         get hidden(){ return !IMPORT.countShown; },
                                         set hidden(v){ IMPORT.countShown = !v; }};
    if(sel === "#importNoGrades")return {get hidden(){ return !IMPORT.noGradesShown; },
                                         set hidden(v){ IMPORT.noGradesShown = !v; }};
    if(sel === "#importConfirmBtn") return {get disabled(){ return IMPORT.confirmDisabled; },
                                            set disabled(v){ IMPORT.confirmDisabled = v; }};
    if(sel === "#importTier")   return {get value(){ return IMPORT.tier; },
                                        set value(v){ IMPORT.tier = v; }};
    if(sel === "#importGroup")  return {get value(){ return IMPORT.group; },
                                        set value(v){ IMPORT.group = v; }};
    if(sel === "#addTier")    return {get value(){ return ADD.tier; },
                                      set value(v){ ADD.tier = v; }};
    if(sel === "#addGroup")   return {get value(){ return ADD.group; },
                                      set value(v){ ADD.group = v; }};
    if(sel === "#addName")    return {get value(){ return ADD.name; },
                                      set value(v){ ADD.name = v; },
                                      focus(){ FOCUSED.push("#addName"); }};
    if(sel === "#addRole")    return {get value(){ return ADD.role; },
                                      set value(v){ ADD.role = v; },
                                      get placeholder(){ return ADD.rolePlaceholder; },
                                      set placeholder(v){ ADD.rolePlaceholder = v; }};
    /* The placeholder circle's live initials, backed by a real value rather
       than a fresh throwaway — otherwise "the picker's own fill syncs the
       initials too" could only be checked by reading setAddPhotoInitials'
       own source text, which is the claim and its evidence from one place. */
    if(sel === "#addPhotoPick")
                              return {get textContent(){ return ADD.pickText; },
                                      set textContent(v){ ADD.pickText = v; }};
    /* setting .value on a file input is how a browser clears it; the only
       reading it supports is .files */
    if(sel === "#addPhoto")   return {get files(){ return ADD.files; },
                                      set value(v){ ADD.files = []; },
                                      focus(){ FOCUSED.push("#addPhoto"); },
                                      /* Replace photo (Add's own framing editor)
                                         opens this same picker, exactly as
                                         #addPhotoPick and #addPhotoBtn already
                                         do — counted the same way #jsonPick's
                                         click is. */
                                      click(){ PICKED++; }};
    /* Filled from script now, exactly like #editPhoto: setAddPhoto fills it
       with framePanel's own tree through the real fill()/clear(), so this
       stub only has to support that traffic without throwing — what the
       panel actually contains is addPending's own business, asserted
       directly rather than by reading a DOM node back. */
    if(sel === "#addPhotoWell")
                              return {get hidden(){ return !ADD.wellShown; },
                                      set hidden(v){ ADD.wellShown = !v; },
                                      firstChild:null,
                                      appendChild(k){ return k; },
                                      removeChild(k){ return k; }};
    /* The placeholder section a Remove reaches back into for a focus target —
       persistent, so a focus() the handler calls on it is observable. */
    if(sel === "#addPhotoEmpty")
                              return {querySelector(q){
                                        return q === "button:not([disabled])" ? ADD_EMPTY_PICK : null; }};
    /* The Grade row's two halves — syncAddAvailability shows exactly one of
       them depending on whether the document has a grade yet. Own backing
       values, not aliases of one another, for the same reason the three
       Structure availability targets below are: a stub that coupled them
       could not tell "the row genuinely swapped" from "one write reached two
       properties". */
    if(sel === "#addTierField")
                              return {get hidden(){ return !ADD.tierFieldShown; },
                                      set hidden(v){ ADD.tierFieldShown = !v; }};
    if(sel === "#addFirstGradeField")
                              return {get hidden(){ return !ADD.firstGradeFieldShown; },
                                      set hidden(v){ ADD.firstGradeFieldShown = !v; }};
    if(sel === "#addFirstGrade")
                              return {get value(){ return ADD.firstGrade; },
                                      set value(v){ ADD.firstGrade = v; }};
    if(sel === "#addTemplateHint")
                              return {get hidden(){ return !ADD.templateHintShown; },
                                      set hidden(v){ ADD.templateHintShown = !v; }};
    /* The two halves of the Accent control, backed by real values so the sync
       between them is observable. A catch-all stub returns a fresh object per
       lookup, so "the picker updated the field" would write into a throwaway
       and every assertion about it would pass. */
    if(sel === "#accent")     return {get value(){ return COLOUR.picker; },
                                      set value(v){ COLOUR.picker = v; }};
    if(sel === "#accentHex")  return {get value(){ return COLOUR.hex; },
                                      set value(v){ COLOUR.hex = v; }};
    if(sel === "#inkOnColour")return {get value(){ return COLOUR.ink; },
                                      set value(v){ COLOUR.ink = v; }};
    /* checkContrast is the REAL one here, so the warning is asserted against
       the shipped WCAG arithmetic rather than a copy of the threshold. */
    if(sel === "#contrastWarn")  return {get hidden(){ return !WARN.shown; },
                                         set hidden(v){ WARN.shown = !v; },
                                         get textContent(){ return WARN.text; },
                                         set textContent(v){ WARN.text = v; }};
    if(sel === "#textWarnBadge") return {get hidden(){ return !WARN.badge; },
                                         set hidden(v){ WARN.badge = !v; }};
    /* The paste dialog. #pasteTableBody is one element for the whole run, so a
       table filled and then re-filled is observably replaced rather than written
       into a throwaway — which is what lets a second preview be asserted at all. */
    if(sel === "#pasteArea")     return {get value(){ return PASTE.area; },
                                         set value(v){ PASTE.area = v; },
                                         focus(){ FOCUSED.push("#pasteArea"); }};
    if(sel === "#pasteEntry")    return {get hidden(){ return !PASTE.entryShown; },
                                         set hidden(v){ PASTE.entryShown = !v; }};
    if(sel === "#pastePreview")  return {get hidden(){ return !PASTE.previewShown; },
                                         set hidden(v){ PASTE.previewShown = !v; }};
    if(sel === "#pastePreviewSummary")
                                 return {get textContent(){ return PASTE.summary; },
                                         set textContent(v){ PASTE.summary = v; }};
    if(sel === "#pasteTableBody"){
      if(!PASTE.body) PASTE.body = stubEl("tbody");
      return PASTE.body;
    }
    if(sel === "#pasteAddBtn")   return {get disabled(){ return PASTE.addDisabled; },
                                         set disabled(v){ PASTE.addDisabled = v; },
                                         get title(){ return PASTE.addTitle; },
                                         set title(v){ PASTE.addTitle = v; }};
    /* Its own backing values, not a second view of the Add button's: a stub that
       aliased them could not tell "the grade limit disables both actions" from
       "one write reached one element twice". */
    if(sel === "#pasteReplaceBtn")
                                 return {get disabled(){ return PASTE.replaceDisabled; },
                                         set disabled(v){ PASTE.replaceDisabled = v; },
                                         get title(){ return PASTE.replaceTitle; },
                                         set title(v){ PASTE.replaceTitle = v; }};
    if(sel === "#docName")       return DOC.name;
    if(sel === "#docText")       return DOC.text;
    if(sel === "#docIconSaved")  return DOC.saved;
    if(sel === "#docIconUnsaved")return DOC.unsaved;
    if(sel === "#docStatus")     return DOC.status;
    if(sel === "#neverSaved")    return {get hidden(){ return NEVER_SAVED.hidden; },
                                         set hidden(v){ NEVER_SAVED.hidden = !!v; },
                                         get textContent(){ return NEVER_SAVED.text; },
                                         set textContent(v){ NEVER_SAVED.text = v; }};
    if(sel === "#groupOptions"){
      if(!GROUP_OPTIONS) GROUP_OPTIONS = stubEl("datalist");
      return GROUP_OPTIONS;
    }
    if(sel === "#groupList"){
      if(!GROUP_LIST) GROUP_LIST = stubEl("div");
      return GROUP_LIST;
    }
    if(sel === "#groupEmpty") return {get hidden(){ return GROUP_EMPTY.hidden; },
                                      set hidden(v){ GROUP_EMPTY.hidden = !!v; }};
    /* The keydown Escape chain asks each of these eight, one after another,
       whether it is open before it ever reaches the plain Ctrl+Z branch —
       and every one of them falls into the generic throwaway below, which
       carries no "hidden" property at all, so !$("#askModal").hidden reads
       !undefined, i.e. true, and the FIRST of the eight fires its closer
       unconditionally. Mid-tour the true answer is always "closed": startTour
       refuses to start while any of the seven modals is open, and #gradePanel
       is chrome nothing in this suite ever opens — so this answers what the
       app would actually find there, rather than the accidental "yes" above.
       This closes only the ASK, not the ACT: askClose, closeGradePanel,
       importClose, closeAddModal, closeEditModal, closePasteModal,
       closeInfoModal and closeGroupModal are still not stubbed anywhere in
       this file, so a handler that reaches one of them because it misjudged
       one of these eight as open still throws loudly, exactly as before. */
    if(["#askModal", "#gradePanel", "#importModal", "#addModal", "#editModal",
        "#pasteModal", "#infoModal", "#groupModal"].indexOf(sel) >= 0)
      return {hidden:true};
    /* Anything that is not an id is not on screen in this suite: there is no
       document to query, and the throwaway below would answer "yes there is" to
       every one of them. syncFramePreview asks for the framing circle by class
       and must find nothing here — test/fixtures.js is where that tree exists. */
    if(sel.charAt(0) !== "#") return null;
    /* modalOpen and modalClose reach for #shell and the dialog's own backdrop,
       and neither is what this suite watches — but a stub that threw on them
       would abandon the section instead of failing it. */
    return {textContent:"", classList:{toggle(){}}, click(){ PICKED++; },
            files:[], value:""};
  }
`;

function makeModule(){
  const src = PREAMBLE
    + DECLS.map(grabDecl).join("\n") + "\n"
    + FNS.map(n => { try{ return grabFn(n); }catch(e){ return grabDecl(n); } }).join("\n") + "\n"
    + "async function swapChange(e)" + grabListener("#fileSwap", "change") + "\n"

    + "function pickChange(e)" + grabListener("#jsonPick", "change") + "\n"

    + "function accentPick(v){ COLOUR.picker = v; accentPickInput({target:$('#accent')}); }\n"
    + "function accentPickInput(e)" + grabListener("#accent", "input") + "\n"
    + "function typeHex(v){ COLOUR.hex = v; hexInput({target:$('#accentHex')}); }\n"
    + "function hexInput(e)" + grabListener("#accentHex", "input") + "\n"
    + "function hexBlur()"   + grabListener("#accentHex", "blur") + "\n"

    + "function rosterFact(e)" + grabListener("#editModal", "click", 2) + "\n"

    + "async function pickPhoto(e)" + grabListener("#addPhoto", "change") + "\n"

    + "function zoneDrop(e)" + grabRawListener('zone.addEventListener("drop", e=>{', "zone drop") + "\n"

    + "function addFrameClick(e)" + grabListener("#addModal", "click") + "\n"
    + "function addFrameZoom(e)"  + grabListener("#addModal", "input") + "\n"
    + "function addFramePan(e)"   + grabListener("#addModal", "keydown", 2) + "\n"

    + "function typeName(e)"   + grabListener("#editName", "input") + "\n"
    + "function typeGroup(e)" + grabListener("#editGroup", "input") + "\n"
    + "function typeRole(e)"   + grabListener("#editRole", "input") + "\n"
    + "function pickGrade(e)"  + grabListener("#editTier", "change") + "\n"
    + "function clickRemovePerson()" + grabListener("#editRemoveBtn", "click") + "\n"
    + "function menuClick(e)"  + grabListener("#personMenu", "click") + "\n"

    + "function beforeUnload(e)" + grabRawListener(
        'window.addEventListener("beforeunload", e=>{', "beforeunload") + "\n"
    + "function keydownHandler(e)" + grabRawListener(
        'document.addEventListener("keydown", e=>{', "keydown") + "\n"

    + "function clickTourBack()" + grabListener("#tourBack", "click") + "\n"
    + "function clickTourNext()" + grabListener("#tourNext", "click") + "\n"
    + "function clickTourX()"    + grabListener("#tourX",    "click") + "\n"
    + `return {
        addFiles, swapChange, newGeneration, staleWrite, applyPhoto,
        /* the click, not the function it happens to call */
        clickFact(verb, id){
          rosterFact({target:{closest(sel){
            return sel === "[data-fact]" ? {dataset:{fact:verb, id:id}} : null;
          }}});
        },
        pick(name, text){ pickChange({target:{files:[{name:name, text:text}], value:"x"}}); },
        get opens(){ return OPENS; },
        get opening(){ return OPENING; },
        setReadFails(v){ READ_FAILS = v; },
        setReadHold(v){ READ_HOLD = v; },
        get reads(){ return READS; },
        get docGen(){ return docGen; },
        get decodes(){ return DECODES; },
        get alerts(){ return ALERTS; },
        askImport, importClose,
        /* what the import dialog will be answered with. null is Cancel, which
           is also the default, so a test that never answers imports nobody
           rather than hanging. */
        answerImportWith(tierId, group){ IMPORT_ANSWER = {tierId:tierId, groupText:group || ""}; },
        cancelImport(){ IMPORT_ANSWER = null; },
        get import(){ return IMPORT; },
        get modals(){ return MODALS; },
        setSwapId(v){ swapId = v; },
        addOnePerson, syncAddAvailability, openAddModal, closeAddModal,
        syncAddRolePlaceholder,
        setAdd(o){ Object.assign(ADD, o); },
        get add(){ return ADD; },
        /* The Group field's suggestion list, read back as the plain array of
           option values fillGroupOptions actually wrote — not the element
           itself, so a test compares against a literal rather than the stub's
           own shape. */
        get groupOptions(){ return GROUP_OPTIONS ? GROUP_OPTIONS.kids.map(k => k.value) : null; },
        fillGroupOptions,
        /* The paste dialog, driven the way a user drives it: text into the
           textarea, then Preview, then one of the two actions. The functions are
           the real ones — nothing here decides where a row goes. */
        openPasteModal, closePasteModal,
        preview(text){
          if(text != null) PASTE.area = text;
          showPastePreview();
        },
        pasteAdd(){ confirmPaste(false); },
        pasteReplace(){ confirmPaste(true); },
        get paste(){ return PASTE; },
        /* every cell of the built table, as [name, grade, group] strings */
        pasteCells,
        /* what the preview left behind for the commit to read */
        get pasteRows(){ return pasteRows; },
        PASTE_NEW, PASTE_NEW_CODE, PASTE_NEW_LABEL, pasteNewTier, parsePasteText,
        /* The choice, as the user makes it: the file goes into the input and
           the listener reads it back off e.target, exactly as a browser hands
           it over. A synthetic {files:…} target instead would leave the real
           stub untouched, and "a refused file left the input empty" would be
           asserting about an input nothing had ever written to. */
        choosePhoto(f){
          ADD.files = f ? [f] : [];
          return pickPhoto({target:$("#addPhoto")});
        },
        /* A drop, driven the way the real listener receives one: a synthetic
           event carrying dataTransfer.files, exactly what e.dataTransfer.files
           is in a browser. zoneDrop is not async — it calls out to async work
           without awaiting it, same as the shipped listener — so callers that
           care about the outcome still need tick()/settle() same as addFiles. */
        dropOn(files){
          return zoneDrop({preventDefault(){}, dataTransfer:{files: files}});
        },
        photolessMatch,
        /* The Add dialog's own framing editor, driven the way a user drives
           it — a click on one of the three [data-fact] buttons, a value typed
           into the zoom slider, an arrow key on the circle — through the real
           delegated listeners rather than by touching addPending.frame by
           hand, which is exactly what would hide a handler that forgot to go
           through clampFrame or started calling edit()/commit() itself. */
        addClickFact(verb){
          addFrameClick({target:{closest(sel){
            return sel === "[data-fact]" ? {dataset:{fact:verb}} : null;
          }}});
        },
        addZoom(v){
          addFrameZoom({target:{dataset:{fact:"zoom"}, value:String(v)}});
        },
        addPanKey(key, shift){
          addFramePan({target:{closest(sel){
            return sel === '[data-fact="pan"]' ? {} : null;
          }}, key:key, shiftKey:!!shift, preventDefault(){}});
        },
        setAddPhoto, frameRect, encodedPhotoBytes, photoBudgetExceeded, LIMITS, PREVIEW_R,
        /* The Edit dialog, driven the way a user drives it: open it on somebody,
           put text in a field, let the field's own handler read it back. A
           synthetic {value:…} target would leave the real field untouched, and
           "the dialog still shows what was typed" would assert about a
           throwaway. */
        openEditModal, closeEditModal, removePerson,
        get editId(){ return editId; },
        /* Not named "edit": that is the app's own edit() a few lines down, and
           an object literal keeps the last of two identical keys.
           (No backticks here — this whole block is one template literal.) */
        get editFields(){ return EDIT; },
        typeInto(which, v){
          const map = {name:["#editName", typeName], group:["#editGroup", typeGroup],
                       role:["#editRole", typeRole]};
          const [sel, fn] = map[which];
          $(sel).value = v;
          fn({target:$(sel)});
        },
        chooseGrade(id){ EDIT.tier.value = id; pickGrade({target:EDIT.tier}); },
        clickRemovePerson,
        /* Everything the roster row's caret opens. personOpen is set the way
           openPersonMenu sets it — that function measures and places the popup,
           which this suite has no geometry for — and the click is then the real
           delegated handler. */
        openMenuOn(id){ personOpen = id; },
        get personOpen(){ return personOpen; },
        clickMenu(verb, id){
          menuClick({target:{closest(sel){
            return sel === "[data-act]"
              ? {dataset:{act:verb, id:id}, disabled:false} : null;
          }}});
        },
        /* what the photo section currently holds, flattened far enough to tell
           its two states apart */
        photoSection(){
          const verbs = [];
          (function walk(n){
            if(!n) return;
            if(n.dataset && n.dataset.fact) verbs.push("fact:" + n.dataset.fact);
            if(n.dataset && n.dataset.act)  verbs.push("act:" + n.dataset.act);
            (n.kids || []).forEach(walk);
          })(EDIT.photo);
          return {verbs: verbs, text: cellText(EDIT.photo)};
        },
        get pending(){ return addPending; },
        /* by hand, the way a careless edit would — what the one-owner rule
           forbids, so a test can prove the rule is what catches it */
        setPendingDirectly(v){ addPending = v; },
        get focused(){ return FOCUSED; },
        newDoc, saveDoc, openDoc, markDirty, updateDocLabel, resetPerRoster, confirmDiscard,
        TEMPLATES, applyTemplate, newTier, defaults, normalizeGradeLinks, reorderGrade, stateLimitProblem,
        /* The guided tour: demoDoc builds the throwaway document, startTour/
           endTour are the swap, and tourSaved is read back to prove what a
           refusal did or did not touch. setModalOpen scripts the one DOM
           question startTour asks for real. importBusy already exists as a
           DECL; it needs a setter here so a test can make the tour refuse the
           way a mid-flight import would. */
        demoDoc, startTour, endTour,
        get tourSaved(){ return tourSaved; },
        setModalOpen(v){ MODAL_OPEN = v; },
        get importBusy(){ return importBusy; },
        set importBusy(v){ importBusy = v; },
        /* The tour's chrome-facing half. tourGoto is the ONE navigation path;
           tourStep and TOUR are read back to prove where it left the tour;
           classes is document.body.classList's own log, so "the class truth
           sits adjacent to tourSaved" is read off a second source rather than
           off the function's text; tourShown is showTourStep's own call log
           (named apart from the existing "shown" getter above, which is the
           document-status strip's). The three buttons are driven the way a
           click drives them, through the real delegated bodies grabbed above.
           tourLiveSteps and tourCount are the skip rule's own reads; setRect
           is how a test narrows one TOUR anchor's rect to zero to drop its
           step out, and tourCurrent is the row placeTour (dom.js's ground)
           would re-measure. */
        tourGoto, tourLiveSteps,
        get tourStep(){ return tourStep; },
        get tourCount(){ return tourCount; },
        get tourCurrent(){ return tourCurrent; },
        setRect,
        TOUR,
        get classes(){ return CLASSES; },
        get tourShown(){ return SHOWN; },
        clickTourBack, clickTourNext, clickTourX,
        /* The tour's two guards, taken whole above — driven with a synthetic
           event exactly as the two listeners are driven for real. */
        beforeUnload, keydownHandler,
        gradeName, moveTarget, moveLabel, moveLabelTo, movePerson, syncRowIdentity,
        /* The drop entry point, plus a way to make its step refuse. The bound
           and the restore are only reachable through a movePerson that stops
           making progress, and there is no roster shape that produces one — so
           the step is broken deliberately, and the SHIPPED guard, restore and
           report are what run. */
        reorderPerson,
        /* STEPS counts the calls the walk actually makes. Without it the
           progress check is invisible: the fuel bound catches a step that never
           moves anyone too, just N spins later, so "it stops when a step changes
           nothing" and "it stops eventually" are the same assertion until the
           number of steps is readable. */
        get steps(){ return STEPS.n; },
        resetSteps(){ STEPS.n = 0; },
        /* n real steps, then a step that achieves nothing. breakTheStep() alone
           stalls on the FIRST call, so nobody is ever half-moved and the array
           restore is never the thing that puts the roster back — it passed with
           the restore deleted. This leaves a person genuinely mid-walk. */
        breakTheStepAfter(n){
          let left = n;
          const real = movePerson;
          movePerson = (id, dir) => { STEPS.n++; if(left-- > 0) real(id, dir); };
        },
        breakTheStep(){ movePerson = ()=>{ STEPS.n++; }; },
        commands: COMMANDS,
        snapshot, undo, redo, canUndo, canRedo, fileStem, toCSV,
        /* the second-dimension entity: groupLabel is the one reader every
           assertion below uses to turn a person's groupId back into the text
           it was resolved from — the same function subline() and toCSV()
           themselves call, never a second hand-rolled lookup living only in
           this suite. */
        groupLabel, resolveGroupId, pruneGroups,
        /* Groups' management surface, driven the way a click drives it: the
           real moveGroup/renameGroup/reorderGroupRow, and syncGroupModal to
           read back what they left in the list. openGroupModal is here too,
           for the one assertion that it fills the list before opening. */
        moveGroup, renameGroup, reorderGroupRow, syncGroupModal, openGroupModal,
        closeGroupModal,
        /* The list as built, flattened far enough to assert against: one entry
           per row, in order, with the two pieces of text a person actually
           reads plus which of the three actions are disabled — not the raw
           stub nodes, which would make every assertion here retrace fill()'s
           own shape instead of what syncGroupModal put in it. */
        groupRows(){
          return (GROUP_LIST ? GROUP_LIST.kids : []).map(row => {
            const nameEl  = row.kids.find(k => k.className === "grp-name");
            const countEl = row.kids.find(k => k.className === "grp-count");
            const byAct = act => row.kids.find(k => k.dataset && k.dataset.act === act);
            return {
              label: nameEl ? nameEl.textContent : "",
              count: countEl ? countEl.textContent : "",
              upDisabled: !!(byAct("up") && byAct("up").disabled),
              downDisabled: !!(byAct("down") && byAct("down").disabled)
            };
          });
        },
        get groupEmptyHidden(){ return GROUP_EMPTY.hidden; },
        commit, edit, endEdit, packState, unpackState, photoPut, photoGet, photoSweep,
        get photoStore(){ return photoStore; },
        get session(){ return session; },
        get hIndex(){ return hIndex; },
        get historyPending(){ return historyPending; },
        get state(){ return state; },        set state(v){ state = v; },
        /* what the ribbon's status strip is actually showing */
        /* saved/unsaved are what a browser would PAINT for the classes the app
           has put on the wrapper — resolved from the real stylesheet by
           iconsShown, not read back off the property the app just wrote. The
           old getter did the latter and stayed green through the whole bug. */
        get shown(){
          const cls = ["rb-doc"].concat(Object.keys(DOC.name.classes).filter(k => DOC.name.classes[k]));
          const rendered = iconsShown(cls, []);
          const hovered  = iconsShown(cls, [":hover"]);
          return {name: DOC.text.textContent,
                  status: DOC.status.textContent,
                  dirtyClass: !!DOC.name.classes.dirty,
                  freshClass: !!DOC.name.classes.fresh,
                  classes: cls,
                  saved: rendered.saved, unsaved: rendered.unsaved,
                  savedOnHover: hovered.saved, unsavedOnHover: hovered.unsaved,
                  iconWrites: ICON_WRITES.slice(),
                  /* no tooltip is ever written */
                  titleWrites: TITLE_WRITES.slice()};
        },
        /* The red bar above the canvas, read the way the DOM would show it —
           not the mutable NEVER_SAVED object the stub writes into directly,
           which would let a test read state nobody set through updateDocLabel. */
        get neverSavedBar(){ return {hidden: NEVER_SAVED.hidden, text: NEVER_SAVED.text}; },
        get docName(){ return docName; },    set docName(v){ docName = v; },
        get dirtyDoc(){ return dirtyDoc; },  set dirtyDoc(v){ dirtyDoc = v; },
        get history(){ return history; },
        get downloads(){ return DOWNLOADS; },
        get written(){ return WRITTEN; },
        get toasts(){ return TOASTS; },
        get picked(){ return PICKED; },
        /* the Accent control, driven the way a user drives it: type into the
           field, drag the picker, leave the field */
        typeHex, hexBlur, accentPick, hexFieldValue, validColour,
        contrastRatio, CONTRAST_MIN,
        /* A swatch, driven as the click dispatcher drives it: closeMenu() ends
           any open session, then COMMANDS.accentSwatch gets the button. The
           element is the real shape — a dataset and its text — because the
           command reads the pair off the markup rather than off a list. */
        clickSwatch(hex, ink, name){
          endEdit();
          COMMANDS.accentSwatch({dataset:{accent:hex, ink:ink}, textContent:name || ""});
        },
        get colour(){ return {picker: COLOUR.picker, hex: COLOUR.hex, ink: COLOUR.ink}; },
        setColourFields(picker, hex, ink){
          COLOUR.picker = picker; COLOUR.hex = hex; COLOUR.ink = ink === undefined ? "" : ink;
        },
        get warn(){ return {shown: WARN.shown, text: WARN.text, badge: WARN.badge}; },
        get summaries(){ return SUMMARIES; },
        setConfirm(v){ CONFIRM = v; },
        setPrompt(v){ PROMPT = v; },
        get asked(){ return ASKED; }
      };`;

  return new Function("iconsShown", src)(iconsShown);
}

let passed = 0;
const failures = [];
const check = (c, m) => { if(c) passed++; else failures.push(m); };
const eq = (a, b, m) => check(a === b, m + " — got " + JSON.stringify(a) + ", want " + JSON.stringify(b));
const countOf = M => ((M.state && M.state.people) || []).length;

const callCommand = async (M, name) => {
  const fn = M.commands[name];
  check(typeof fn === "function", "COMMANDS." + name + " exists and is callable");
  if(typeof fn === "function") await fn();
};

const guarded = async (label, fn) => {
  try{ await fn(); }
  catch(e){ check(false, label + " — got: " + ((e && e.message) || e)); }
};

{
  const VOIDS = ["input","br","img","hr","meta","link"];

  const blank = s => s.replace(/[^\n]/g, " ");
  const SCAN = HTML.replace(/<!--[\s\S]*?-->/g, blank)
                   .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/, (_, a, b, c) => a + blank(b) + c)
                   .replace(/(<script>)([\s\S]*?)(<\/script>)/,    (_, a, b, c) => a + blank(b) + c);
  const elOf = (tag, text) => {
    const attrs = {};
    const re = /([\w-]+)(?:="([^"]*)")?/g;
    let a;
    while((a = re.exec(text))) attrs[a[1]] = a[2] === undefined ? "" : a[2];
    return {tag:tag, id:attrs.id || null,
            cls:(attrs["class"] || "").split(/\s+/).filter(Boolean), attrs:attrs};
  };

  const chainTo = cls => {
    const at = SCAN.search(new RegExp('<[a-z]+[^>]*\\sclass="[^"]*\\b' + cls + '\\b'));
    if(at < 0) return null;
    const stack = [], re = /<(\/?)([a-z]+)([^>]*?)(\/?)>/g;
    let m;
    while((m = re.exec(SCAN)) && m.index < at){
      if(VOIDS.indexOf(m[2]) >= 0 || m[4] === "/") continue;
      if(m[1] === "/") stack.pop(); else stack.push(elOf(m[2], m[3]));
    }
    const open = new RegExp('<([a-z]+)((?:[^>]*\\sclass="[^"]*\\b' + cls + '\\b[^"]*")[^>]*?)/?>')
      .exec(SCAN.slice(at));
    return open ? stack.concat([elOf(open[1], open[2])]) : null;
  };

  const inkOf = chain => {
    if(!chain) return "no such element in the markup";
    const fill = resolveProp(chain, "fill");
    if(fill === null) return "nothing sets fill — the path keeps SVG's initial black";
    if(fill.toLowerCase() !== "currentcolor") return fill;
    for(let i = chain.length - 1; i >= 0; i--){
      const c = resolveProp(chain.slice(0, i + 1), "color");
      if(c !== null) return c;
    }
    return "fill follows currentColor but nothing up the chain sets color";
  };

  const aboutChain = chainTo("about-mark");

  if(aboutChain){
    const box = aboutChain.filter(e => e.cls.indexOf("modal-info") >= 0)[0];
    if(box) box.cls.push("about-open");
  }

  eq(inkOf(chainTo("tb-mark")), "#fff",
     "the title-bar mark is painted in the bar's own ink — the inherited color only "
     + "reaches the path because the mark's own rule says fill:currentColor");
  eq(inkOf(aboutChain), "var(--brand-mark)",
     "and the About mark is painted in --brand-mark, from the color its own rule states — "
     + "same reason, and it is the only thing that makes one symbol serve both homes");
}

async function tick(){ for(let i = 0; i < 6; i++) await Promise.resolve(); }

const IMG  = {data:"data:image/jpeg;base64,AAAA", w:120, h:120};
const file = n => ({name:n, type:"image/jpeg"});

async function settle(M, result){
  for(let guard = 0; guard < 50; guard++){
    await tick();
    if(!M.decodes.length) break;
    const d = M.decodes.shift();
    if(result === "fail") d.rej(new Error("could not be read"));
    else d.res(result || IMG);
  }
  await tick();
}

function who(M, i){ return ((M.state && M.state.people) || [])[i] || {}; }

function personIn(M, name){

  return {id: "x" + Math.random().toString(36).slice(2,7), name: name,
          tierId: M.state.tiers[0].id, groupId: M.resolveGroupId(M.state, "FRA"),
          role: "", photo: null,
          pw: 0, ph: 0, frame: null};
}

let sixGradesSeq = 0;
function sixGrades(){
  sixGradesSeq++;
  const g = (code, label, o) => Object.assign(
    {id: "sg" + sixGradesSeq + "-" + code, code: code, label: label,
     fill: "green", attach: false, merge: false, align: "center"}, o || {});
  return [
    g("P", "Partner"),
    g("A", "Assistant", {fill: "white", attach: true}),
    g("D", "Director"),
    g("M", "Manager"),
    g("SC", "Senior Consultant"),
    g("C", "Consultant", {attach: true, merge: true})
  ];
}

async function runSuite(){

  {
    const M = makeModule();
    M.state = M.defaults();

    M.state.tiers = [{id:"g1", code:"G", label:"Grade", fill:"green",
                       attach:false, merge:false, align:"center"}];
    M.docName = ""; M.dirtyDoc = false;

    eq(M.defaults().title, "Team name", "a new document's title is the neutral placeholder");
    eq(M.defaults().groupsLabel, "", "a new document's group-axis label is empty — nothing is drawn until one is set");
    eq(M.defaults().showGradeCode, true, "new charts show grade codes");
    eq(M.defaults().showGradeName, false, "new charts do not show grade names");
    eq(M.defaults().nameLabelPosition, "below", "new Swimlanes put name labels below photos");
    eq(M.defaults().nameBold, "given", "new charts bold the given names, not the family name");
    eq(M.defaults().font, "open-sans", "new charts draw with the Open Sans stack");
    eq(M.defaults().showPersonName, true, "new charts show person names");
    eq(M.defaults().showPersonGrade, true, "new charts show person grades");
    eq(M.defaults().showPersonGroup, true, "new charts show person groups");

    eq(M.stateLimitProblem(M.defaults()), "the roster has no grades",
      "and a fresh document is not yet saveable — it has no grades to save");
    {

      const bad = M.defaults();
      bad.tiers = [{id:"g1", code:"G", label:"Grade", fill:"green",
                    attach:false, merge:false, align:"center"}];
      bad.showGradeCode = "yes";
      check(/grade-code/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a non-boolean grade-code setting");
      bad.showGradeCode = true; bad.showGradeName = 1;
      check(/grade-name/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a non-boolean grade-name setting");
      bad.showGradeName = false; bad.nameLabelPosition = "above";
      check(/name-label position/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a name-label position the renderer does not know");
      bad.nameLabelPosition = "below"; bad.nameBold = "bold";
      check(/name-bolding/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a name-bolding setting the renderer does not know");
      bad.nameBold = "given"; bad.font = "comic-sans";
      check(/font/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a font this version cannot draw");
      bad.font = "open-sans"; bad.showPersonName = "yes";
      check(/person-label/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a non-boolean person-name display setting");
      bad.showPersonName = true; bad.showPersonGrade = 1;
      check(/person-label/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a non-boolean person-grade display setting");
      bad.showPersonGrade = true; bad.showPersonGroup = null;
      check(/person-label/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a non-boolean person-group display setting");
      bad.showPersonGroup = true; bad.groupsLabel = "x".repeat(500);
      check(/document label/.test(M.stateLimitProblem(bad) || ""),
        "Save refuses a group-axis label longer than the document-label limit");
    }

    eq(M.dirtyDoc, false, "a fresh document starts clean");

    M.updateDocLabel();

    const STATUS_TEXT = {fresh:"Not saved yet", unsaved:"Unsaved changes", saved:"Saved"};
    const exactlyOne = (want, where) => {
      const s = M.shown;
      const iconState = want === "saved" ? "saved" : "unsaved";
      eq(s.saved === (iconState === "saved") && s.unsaved === (iconState === "unsaved"), true,
         where + ": exactly the " + iconState + " icon renders — got saved=" + s.saved
         + " unsaved=" + s.unsaved);

      eq(s.savedOnHover, s.saved,   where + ": hover does not change the saved icon");
      eq(s.unsavedOnHover, s.unsaved, where + ": hover does not change the unsaved icon");

      eq(s.status, STATUS_TEXT[want],
         where + ": the visible status reads " + STATUS_TEXT[want] + " — got " + s.status);

      eq(s.titleWrites.length, 0,
         where + ": updateDocLabel writes no tooltip — got " + JSON.stringify(s.titleWrites));
      eq(s.iconWrites.length, 0,
         where + ": nothing wrote to the icon elements — got " + JSON.stringify(s.iconWrites));

      eq(s.freshClass, want === "fresh", where + ": .fresh class matches the fresh state");
      eq(s.dirtyClass, want === "unsaved", where + ": .dirty class matches the unsaved state");
      check(!(s.freshClass && s.dirtyClass),
        where + ": .fresh and .dirty are never both set");
    };
    exactlyOne("fresh", "a clean, never-saved document");

    eq(M.shown.name, "Untitled roster", "a fresh document is named Untitled roster");
    eq(M.shown.saved, false, "the never-saved state does not show the saved icon");
    eq(M.shown.unsaved, true, "it shows the same unsaved-shaped icon as a dirty save");
    eq(M.shown.status, "Not saved yet", "with the visible status Not saved yet");
    eq(M.shown.freshClass, true, "and the .fresh emphasis");
    eq(M.shown.dirtyClass, false, "but not .dirty — the document itself is clean");
    check(M.neverSavedBar.hidden,
      "the never-saved bar stays hidden on a clean canvas — nothing to lose yet");

    M.markDirty();
    eq(M.dirtyDoc, true, "an edit marks the document dirty");
    eq(M.shown.status, "Not saved yet",
      "an edit to an untitled document still reads Not saved yet — never-saved outranks dirty");
    eq(M.shown.freshClass, true, "and stays .fresh");
    eq(M.shown.dirtyClass, false, "never .dirty while the document has no name at all");
    check(!M.neverSavedBar.hidden,
      "now the never-saved bar appears — there is unsaved work with nowhere to go");
    check(/Save copy/.test(M.neverSavedBar.text),
      "and it names Save copy — got " + JSON.stringify(M.neverSavedBar.text));
    check(!/•/.test(M.shown.name), "and no bullet appended to the name — got " + M.shown.name);
    exactlyOne("fresh", "after an edit to an untitled document");

    M.setPrompt("my-team");
    eq(await M.saveDoc(false), true, "save completes");
    eq(M.dirtyDoc, false, "saving clears the dirty flag");
    eq(M.docName, "my-team", "saving records the document name");
    eq(M.shown.name, "my-team", "a successful Save shows the document's name");
    eq(M.shown.saved, true, "and goes back to the saved icon");
    eq(M.shown.unsaved, false, "with the unsaved one hidden");
    eq(M.shown.status, "Saved", "and the status reads Saved again");
    check(M.neverSavedBar.hidden,
      "and the never-saved bar hides — the document now has somewhere to be saved to");
    exactlyOne("saved", "after saving");
    eq(M.downloads.length, 1, "saving produced a download");
    eq(M.downloads[0], "my-team.json", "saved under the chosen name");

    eq(JSON.parse((M.written[0] || {}).text || "{}").layout, "pyramid",
       "the saved roster file states its layout");

    {
      const written = JSON.parse((M.written[0] || {}).text || "{}");
      eq(written.app, "tierform", "the saved file names the app that wrote it");
      eq(written.format, 1, "and states the roster format version");
      check(M.state.app === undefined && M.state.format === undefined,
        "and neither key lives on state itself — only the written file carries them");
    }

    M.setPrompt(null);
    M.markDirty();
    eq(M.shown.status, "Unsaved changes",
      "an edit after saving reads Unsaved changes, not Not saved yet");
    check(M.neverSavedBar.hidden,
      "the never-saved bar stays hidden — this document already has a name");
    exactlyOne("unsaved", "an edit after a save");
    eq(await M.saveDoc(false), true, "a second Save does not re-prompt");
    eq(M.downloads[1], "my-team.json", "Save reuses the established name");
    eq(M.dirtyDoc, false, "the second save cleared the flag too");

    M.markDirty();
    M.setPrompt(null);
    eq(await M.saveDoc(true), false, "Save As returns false when cancelled");
    eq(M.downloads.length, 2, "a cancelled Save As writes no file");
    eq(M.dirtyDoc, true, "a cancelled Save As leaves the document dirty");
    eq(M.docName, "my-team", "a cancelled Save As leaves the name alone");
    eq(M.shown.unsaved, true, "and the status still shows unsaved — nothing was written");
    eq(M.shown.status, "Unsaved changes", "with the status name to match");
    eq(M.shown.name, "my-team", "and the old name, since the rename did not happen");
    exactlyOne("unsaved", "after a cancelled Save As");

    M.setPrompt("other-team");
    eq(await M.saveDoc(true), true, "Save As with a name succeeds");
    eq(M.docName, "other-team", "Save As renames the document");
    eq(M.downloads[2], "other-team.json", "Save As wrote the new name");

    M.setPrompt("with-ext.json");
    await M.saveDoc(true);
    eq(M.downloads[3], "with-ext.json", "a typed .json extension is not doubled");

    M.setPrompt("   ");
    await M.saveDoc(true);
    eq(M.downloads[4], "with-ext.json", "a blank name falls back to the current one");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    M.dirtyDoc = false;
    eq(await M.confirmDiscard("do a thing"), true, "a clean document never prompts");

    M.dirtyDoc = true;
    M.setConfirm(false);
    eq(await M.confirmDiscard("do a thing"), false, "a dirty document prompts, and No means No");
    M.setConfirm(true);
    eq(await M.confirmDiscard("do a thing"), true, "a dirty document proceeds when confirmed");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, "Someone Here"));
    M.state.accent = "#123456";
    M.docName = "old-doc";
    M.dirtyDoc = true;

    M.setConfirm(false);
    await M.newDoc();
    eq(countOf(M), 1, "New cancelled: the roster is untouched");
    eq(M.docName, "old-doc", "New cancelled: the document name is untouched");
    eq(M.dirtyDoc, true, "New cancelled: still dirty");

    M.setConfirm(true);
    await M.newDoc();
    eq(countOf(M), 0, "New: the roster is empty");
    eq(M.state.accent, "#003153", "New: chart design is back to defaults");
    eq(M.docName, "", "New: the document is untitled again");
    eq(M.dirtyDoc, false, "New: starts clean, so closing straight away is silent");
    eq(M.state.tiers.length, 0,
      "New: genuinely empty — no grades ship by default, Templates is the way in");

    M.updateDocLabel();
    eq(M.shown.name, "Untitled roster", "New: the status shows Untitled roster again");
    eq(M.shown.saved, false, "New: the never-saved state, not the saved icon");
    eq(M.shown.unsaved, true, "New: showing the same glyph as an unsaved edit");
    eq(M.shown.status, "Not saved yet", "New: and the Not saved yet status name");
    eq(M.shown.freshClass, true, "New: with .fresh, since New starts clean but untitled");
    eq(M.shown.dirtyClass, false, "New: not .dirty — the document itself is clean");
    check(M.neverSavedBar.hidden,
      "New: the never-saved bar stays hidden — the fresh document is clean");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.title = "Keep this title";
    M.state.accent = "#123456";
    M.state.inkOnColour = "#000000";
    M.state.layout = "swimlanes";
    M.state.page = "a4-portrait";

    M.state.nameLabelPosition = "below";
    M.state.tiers = [{id:"custom-grade", code:"X", label:"Custom", role:"",
                      fill:"green", attach:false, merge:false, align:"center"}];
    M.docName = "current-file";
    M.dirtyDoc = false;
    const before = JSON.stringify(M.state);
    const gen = M.docGen;

    M.setConfirm(false);
    await M.applyTemplate("big4-green");
    eq(JSON.stringify(M.state), before,
      "cancelled: the custom structure, layout, colours and name label position are all untouched");
    eq(M.dirtyDoc, false, "cancelled: no dirty flag");
    eq(M.history.length, 0, "cancelled: no undo step");
    eq(M.docGen, gen, "cancelled: outstanding work is not invalidated");

    M.setConfirm(true);
    await M.applyTemplate("big4-green");
    eq(M.state.tiers.map(t => t.code).join(","), "P,AS,D,SM,M,SC,C,A,JS",
      "Big 4 green installs its nine grades in template order");
    eq(M.state.layout, "pyramid", "…and its layout");
    eq(M.state.accent, "#004225", "…and its accent");
    eq(M.state.inkOnColour, "#FFFFFF", "…and the ink that goes on that accent");
    eq(M.state.nameLabelPosition, "next", "…and its name label position");
    eq(M.state.title, "Keep this title", "the title is untouched — a template is not a New");
    eq(M.state.page, "a4-portrait", "…and neither is the page");
    eq(M.docName, "current-file", "applying a template stays inside the current file");
    eq(M.dirtyDoc, true, "applying a template marks the file unsaved");
    check(M.docGen !== gen, "applying a template invalidates work aimed at the replaced structure");
    check(M.state.tiers.every(t => t.id !== "custom-grade"),
      "applying a template creates fresh grade ids rather than reusing the replaced structure");

    M.undo();
    eq(JSON.stringify(M.state), before,
      "one Undo restores the complete custom structure, layout, colours and name label position together");
    eq(M.state.nameLabelPosition, "below",
      "…name label position back to below specifically, not just equal to \"before\" as a whole");
    M.redo();
    eq(M.state.tiers.map(t => t.code).join(","), "P,AS,D,SM,M,SC,C,A,JS",
      "one Redo re-applies the whole template again");
    eq(M.state.layout, "pyramid", "…layout included");
    eq(M.state.accent, "#004225", "…accent included");
    eq(M.state.nameLabelPosition, "next", "…name label position included");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = [];
    M.docName = "current-file";
    M.dirtyDoc = false;
    const asked = M.asked.length;

    M.setConfirm(true);
    await M.applyTemplate("mbb-blue");
    eq(M.asked.length, asked, "zero grades: applying a template opens no confirmation");
    eq(M.state.tiers.map(t => t.code).join(","), "SP,AP,EM,A,F,JF",
      "…and still applies immediately");
    eq(M.state.layout, "hive", "…including the layout");
    eq(M.state.accent, "#003153", "…and the accent");
    eq(M.state.nameLabelPosition, "below", "…and its name label position");
    eq(M.dirtyDoc, true, "…and marks the file unsaved");
    eq(M.history.length, 1, "…as one undo step");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const before = JSON.stringify(M.state);
    const asked = M.asked.length, alerted = M.alerts.length;

    await M.applyTemplate("not-a-real-template");
    eq(JSON.stringify(M.state), before, "an unknown template id changes nothing");
    eq(M.asked.length, asked, "…and asks nothing");
    eq(M.alerts.length, alerted, "…and alerts nothing — there was no request to refuse");
    eq(M.history.length, 0, "…and creates no undo step");
    eq(M.dirtyDoc, false, "…and marks nothing unsaved");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.title = "Keep this title";
    M.state.layout = "swimlanes";
    M.docName = "current-file";
    const before = JSON.stringify(M.state);

    M.setConfirm(false);
    await callCommand(M, "clearGrades");
    eq(JSON.stringify(M.state), before, "Delete all cancelled: every grade remains");
    eq(M.history.length, 0, "Delete all cancelled: no undo step");

    M.setConfirm(true);
    await callCommand(M, "clearGrades");
    eq(M.state.tiers.length, 0, "Delete all leaves a deliberately empty structure");
    eq(M.state.title, "Keep this title", "Delete all preserves the title");
    eq(M.state.layout, "swimlanes", "Delete all preserves the layout");
    eq(M.docName, "current-file", "Delete all stays inside the current file");
    eq(M.stateLimitProblem(M.state), "the roster has no grades",
      "an empty structure cannot be saved until a grade is added or a template is applied");
    M.undo();
    eq(JSON.stringify(M.state), before, "one Undo restores every deleted grade");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, "Assigned Person"));
    const before = JSON.stringify(M.state);
    const asked = M.asked.length;

    await M.applyTemplate("big4-green");
    await callCommand(M, "clearGrades");
    eq(JSON.stringify(M.state), before,
      "people present: neither whole-structure action changes their grades");
    eq(M.asked.length, asked,
      "people present: neither action even opens a destructive confirmation");
    eq(M.history.length, 0, "people present: neither action creates an undo step");
    check(M.alerts.length === 2 && M.alerts.every(x => /Remove all people/.test(x)),
      "people present: both actions explain how to make them available");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.title  = "Keep this title";
    M.state.accent = "#123456";
    M.state.layout = "swimlanes";
    M.state.people.push(personIn(M, "Ada Lovelace"), personIn(M, "Grace Hopper"));
    M.docName = "current-file";
    M.dirtyDoc = false;
    const before = JSON.stringify(M.state);

    const grades = JSON.stringify(M.state.tiers);
    const gen = M.docGen;

    M.setConfirm(false);
    await M.commands.clearRoster();
    eq(JSON.stringify(M.state), before, "Clear cancelled: everyone is still on the roster");
    eq(M.dirtyDoc, false, "Clear cancelled: no dirty flag");
    eq(M.history.length, 0, "Clear cancelled: no undo step");
    eq(M.docGen, gen, "Clear cancelled: outstanding work is not invalidated");

    M.setConfirm(true);
    await M.commands.clearRoster();
    eq(countOf(M), 0, "Clear roster removes every person");
    eq(JSON.stringify(M.state.tiers), grades, "Clear roster changes no grade");
    eq(M.state.title, "Keep this title", "Clear roster preserves the title");
    eq(M.state.accent, "#123456", "Clear roster preserves the style");
    eq(M.state.layout, "swimlanes", "Clear roster preserves the layout");
    eq(M.docName, "current-file", "Clear roster stays inside the current file");
    eq(M.dirtyDoc, true, "Clear roster marks that file unsaved");
    check(M.docGen !== gen, "Clear roster invalidates work aimed at the roster it emptied");
    eq(M.stateLimitProblem(M.state), null,
      "an empty roster is still a saveable document — it is the grades that are required");

    M.undo();
    eq(JSON.stringify(M.state), before, "one Undo brings the whole roster back");
    M.redo();
    eq(countOf(M), 0, "one Redo empties it again");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const asked = M.asked.length;

    M.setConfirm(true);
    await M.commands.clearRoster();
    eq(M.asked.length, asked, "nobody on the roster: Clear roster opens no confirmation");
    eq(M.history.length, 0, "nobody on the roster: and creates no undo step");
    eq(M.dirtyDoc, false, "nobody on the roster: and marks nothing unsaved");
  }

  {

    const M = makeModule();
    const WANT = [
      {id:"big4-green",  name:"Big 4 green",  layout:"pyramid",
       accent:"#004225", ink:"#FFFFFF", nameLabelPosition:"next",
       codes:"P,AS,D,SM,M,SC,C,A,JS"},

      {id:"big4-orange", name:"Big 4 orange", layout:"swimlanes",
       accent:"#FF4F00", ink:"#000000", nameLabelPosition:"below",
       codes:"P,D,SM,M,SA,A"},
      {id:"mbb-blue",    name:"MBB blue",     layout:"hive",
       accent:"#003153", ink:"#FFFFFF", nameLabelPosition:"below",
       codes:"SP,AP,EM,A,F,JF"}
    ];
    eq(M.TEMPLATES.length, WANT.length, "there are exactly three templates");
    for(let i = 0; i < WANT.length; i++){
      const t = M.TEMPLATES[i] || {};
      const w = WANT[i];
      eq(t.id, w.id, "template " + (i + 1) + "'s id");
      eq(t.name, w.name, "template " + (i + 1) + "'s name");
      eq(t.layout, w.layout, "template " + (i + 1) + "'s layout");
      eq(t.accent, w.accent, "template " + (i + 1) + "'s accent");
      eq(t.ink, w.ink, "template " + (i + 1) + "'s ink — the accent's own on-colour text");
      eq(t.nameLabelPosition, w.nameLabelPosition,
        "template " + (i + 1) + "'s name label position");
      check(typeof t.grades === "function",
        "template " + (i + 1) + "'s grades is a function, not a shared array");
      const a = (t.grades && t.grades()) || [], b = (t.grades && t.grades()) || [];
      eq(a.map(x => x.code).join(","), w.codes,
        "template " + (i + 1) + "'s grades, in order — got " + a.map(x => x.code).join(","));
      check(a.length > 0 && a.every((x, j) => x.id !== (b[j] || {}).id),
        "template " + (i + 1) + ": each call builds fresh ids, not one shared array");
    }

    for(const t of M.TEMPLATES){
      const r = M.contrastRatio(t.accent, t.ink);
      check(r >= M.CONTRAST_MIN,
        t.name + " writes on its own accent at " + r.toFixed(2) + ":1, at or "
        + "above the threshold the app's own warning enforces");
    }

    const green = (M.TEMPLATES.find(t => t.id === "big4-green") || {}).grades() || [];
    check((green[1] || {}).attach === true && (green[1] || {}).fill === "white"
       && (green[1] || {}).align === "right",
      "Big 4 green's second grade (Assistant) attaches, in white, aligned right");
    const mbb = (M.TEMPLATES.find(t => t.id === "mbb-blue") || {}).grades() || [];
    check((mbb[1] || {}).merge === true && (mbb[1] || {}).attach === true,
      "MBB blue's second grade (Associate Partner) shares the first grade's band "
      + "— merge implies attach, the same rule as everywhere else");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = [];
    M.dirtyDoc = false;

    M.syncAddAvailability();
    eq(M.add.tierFieldShown, false, "no grades: the grade select gives way to the First-grade field");
    eq(M.add.firstGradeFieldShown, true, "no grades: …which is shown in its place");
    eq(M.add.templateHintShown, true, "no grades: …alongside the escape hatch to Templates");

    M.setAdd({firstGrade:"", name:"Ada"});
    eq(await M.addOnePerson(), false,
      "no grades, no typed grade: addOnePerson reports that it added nobody");
    check(M.alerts.length > 0
       && /name the first grade, or apply a template under Structure/.test(M.alerts[M.alerts.length - 1]),
      "…and the alert names the escape hatch — got "
      + JSON.stringify(M.alerts[M.alerts.length - 1]));
    eq(M.state.tiers.length, 0, "…no grade is created on a refused add");
    eq(countOf(M), 0, "…and no person either");
    eq(M.history.length, 0, "…no history entry");
    eq(M.dirtyDoc, false, "…and the document is not marked dirty");

    M.setAdd({firstGrade:"Leftover Grade"});
    M.openAddModal();
    eq(M.add.firstGrade, "",
      "no grades, reopened: the First-grade field is cleared, not left over from the last dialog");
    eq(M.add.rolePlaceholder, "",
      "…and the role placeholder does not echo the stale grade name either");

    M.setAdd({firstGrade:"Director"});
    M.syncAddRolePlaceholder();
    eq(M.add.rolePlaceholder, "Director",
      "no grades: the role placeholder mirrors the typed first grade");
    M.setAdd({firstGrade:"Senior Director"});
    M.syncAddRolePlaceholder();
    eq(M.add.rolePlaceholder, "Senior Director",
      "…and stays live as the field is retyped");

    M.setAdd({firstGrade:"Director", name:"Ada"});
    eq(await M.addOnePerson(), true,
      "no grades, a typed first grade: addOnePerson reports success");
    eq(M.state.tiers.length, 1, "…exactly one grade now exists");

    const created = M.state.tiers[0] || {};
    eq(created.code, "D",
      "…whose code is the typed grade's first letter, uppercased — got " + created.code);
    eq(created.label, "Director",
      "…and whose label is the full typed value, unlike the code");
    eq(countOf(M), 1, "…and one person");
    eq(who(M, 0).tierId, created.id,
      "…filed under the grade that was just created, not left unassigned");
    eq(M.history.length, 1, "…the grade and the person are ONE commit, one undo step");

    const M2 = makeModule();
    M2.state = M2.defaults();
    M2.state.tiers = [];
    M2.setAdd({firstGrade:"partner", name:"Cai"});
    eq(await M2.addOnePerson(), true, "…and a lowercase-first typed grade also succeeds");
    const created2 = M2.state.tiers[0] || {};
    eq(created2.code, "P",
      "…with the code uppercased even though the typed grade was not — got "
      + JSON.stringify(created2.code));
    eq(created2.label, "partner",
      "…while the label keeps the typed casing verbatim — got " + JSON.stringify(created2.label));

    M.syncAddAvailability();
    eq(M.add.tierFieldShown, true, "after the add: the grade select is shown again");
    eq(M.add.firstGradeFieldShown, false, "…and the First-grade field is hidden");
    eq(M.add.firstGrade, "", "…and its own value was cleared, not left for the next person");

    if(M.state.tiers[0]) M.state.tiers[0].label = "Managing Director";
    M.syncAddRolePlaceholder();
    eq(M.add.rolePlaceholder, "Managing Director",
      "…the role placeholder now follows the grade's own label, not the "
      + "cleared First-grade field");

    M.undo();
    eq(countOf(M), 0, "undo: the person is gone");
    eq(M.state.tiers.length, 0,
      "undo: …and so is the grade created with it — no orphan left on the strip");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = [];
    M.setPendingDirectly({result:{data:"data:image/jpeg;base64,EEEE", w:50, h:50},
                          gen: M.docGen});
    M.newGeneration();
    M.setAdd({firstGrade:"Partner", name:"Ada"});
    eq(await M.addOnePerson(), false,
      "no grades, a stale pending-photo generation: addOnePerson reports no add");
    eq(M.state.tiers.length, 0, "…no grade is created for a refused add");
    eq(countOf(M), 0, "…nor a person");

    const M2 = makeModule();
    M2.state = M2.defaults();
    M2.state.tiers = [];
    M2.setPendingDirectly({result:{data:"data:image/jpeg;base64,FFFF", w:60, h:60},
                           gen: M2.docGen});
    M2.setAdd({firstGrade:"Partner", name:"Ada"});
    eq(await M2.addOnePerson(), true,
      "no grades, a fresh pending-photo generation: the grade, the person and the photo land together");
    eq(M2.state.tiers.length, 1, "…the grade lands");
    eq(who(M2, 0).tierId, (M2.state.tiers[0] || {}).id, "…the person is filed under it");
    eq(who(M2, 0).photo, "data:image/jpeg;base64,FFFF", "…and the photo lands too");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = [];
    M.dirtyDoc = false;

    const alertsBeforePaste = M.alerts.length;

    M.commands.pasteList();
    eq(M.alerts.length, alertsBeforePaste,
      "no grades: pasteList raises no alert of its own");
    eq(M.paste.entryShown, true, "no grades: …it opens the paste dialog instead");
    M.closePasteModal();

    M.answerImportWith(M.state.tiers[0] && M.state.tiers[0].id);
    const dropped = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();

    eq(M.import.noGradesShown, true, "no grades: the import dialog says so in its own body");
    eq(M.import.confirmDisabled, true, "no grades: and its Import button is disabled");
    eq(M.import.countShown, false, "no grades: the count gives way to the reason");
    eq(M.decodes.length, 0, "no grades: a dropped photo never reaches the decoder");

    await settle(M);
    await dropped;
    eq(countOf(M), 0, "no grades: the photo-import route creates no unassigned person");
    eq(M.history.length, 0, "no grades: no history entry from the refused import");
    eq(M.dirtyDoc, false, "no grades: and no dirty flag");

    check(M.alerts.length === alertsBeforePaste + 1
       && /under Structure/.test(M.alerts[M.alerts.length - 1]),
      "no grades: the one remaining refusing route names the one action that unblocks it");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.dirtyDoc = false;
    const historyBefore = M.history.length;

    const drop = M.dropOn([file("Grace_Hopper.jpg")]);
    await tick();
    check(M.decodes.length === 1,
      "the dropped photo reaches the real decoder — got " + M.decodes.length);

    if(M.decodes[0]) M.decodes[0].res({data:"data:image/jpeg;base64,GGGG", w:90, h:90});
    await settle(M);
    await drop;

    check(M.modals.some(m => m.id === "#addModal" && m.action === "open"),
      "a single unmatched drop opens the Add dialog — the same one the click opens");
    check(!M.modals.some(m => m.id === "#importModal"),
      "…and the batch import dialog is never asked at all — got " + JSON.stringify(M.modals));
    eq(M.add.name, "Grace Hopper",
      "…prefilled from the file name, the same courtesy the picker gives");
    check(!!M.pending && M.pending.result.data === "data:image/jpeg;base64,GGGG",
      "…with the decoded photo waiting in the well");
    eq(countOf(M), 0, "nothing is committed yet — Add still has to happen");
    eq(M.history.length, historyBefore, "…no history entry either");
    eq(M.dirtyDoc, false, "…and the document is not yet dirty");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.dirtyDoc = false;
    const grace = personIn(M, "Grace Hopper");
    M.state.people.push(grace);

    const drop = M.dropOn([file("Grace_Hopper.jpg")]);
    await settle(M);
    await drop;

    check(!M.modals.some(m => m.action === "open"),
      "a matched single drop opens no dialog at all — got " + JSON.stringify(M.modals));
    eq(grace.photo, IMG.data, "…the photo lands on the matched person");
    eq(countOf(M), 1, "…and nobody new was added");
    eq(M.history.length, 1, "…in one undo step");

    eq((M.history[0] || {}).label, "1 photo attached", "…labelled as an attach, not an add");
    eq(M.dirtyDoc, true, "…and the document is now dirty");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;
    M.answerImportWith(tier, "FRA");

    const drop = M.dropOn([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg")]);
    await tick();
    check(M.modals.some(m => m.id === "#importModal" && m.action === "open"),
      "a batch with an addition still asks the import dialog");
    await settle(M);
    await drop;
    eq(countOf(M), 2, "…and both land, exactly as a direct addFiles batch would");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada  = personIn(M, "Ada Lovelace");
    const alan = personIn(M, "Alan Turing");
    M.state.people.push(ada, alan);

    const drop = M.dropOn([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg")]);
    await settle(M);
    await drop;

    check(!M.modals.some(m => m.action === "open"),
      "a pure-attachment batch asks nothing — got " + JSON.stringify(M.modals));
    eq(ada.photo, IMG.data, "…the first photo attaches");
    eq(alan.photo, IMG.data, "…and the second one too");
    eq(M.history.length, 1, "…both in the same one commit");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const grace = personIn(M, "Grace Hopper");
    grace.photo = "data:image/jpeg;base64,OLD";
    M.state.people.push(grace);

    const drop = M.dropOn([file("Grace_Hopper.jpg")]);
    await tick();

    if(M.decodes[0]) M.decodes[0].res({data:"data:image/jpeg;base64,NEW", w:90, h:90});
    await settle(M);
    await drop;

    check(M.modals.some(m => m.id === "#addModal" && m.action === "open"),
      "a name match who already has a photo is not a match at all — the drop "
      + "opens the Add dialog instead");
    eq(grace.photo, "data:image/jpeg;base64,OLD",
      "…and their existing photo is left untouched");
    eq(countOf(M), 1, "…nobody new was added either — Add still has to happen");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[3].id;
    M.answerImportWith(tier, "FRA");

    const run = M.addFiles([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg"),
                            file("Grace_Hopper.jpg")]);
    await tick();
    eq(M.import.count, "3 photos to import. They will all be added to:",
      "the dialog states how many photos it is about to import");
    await settle(M);
    await run;

    eq(countOf(M), 3, "confirming imports all three");
    check(M.state.people.every(x => x.tierId === tier),
      "…every one of them in the grade the dialog asked for");
    check(M.state.people.every(x => M.groupLabel(M.state, x) === "FRA"),
      "…and every one with the group it asked for");
    eq(M.history.length, 1, "the batch is one undo step, as it has always been");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[1].id;
    M.answerImportWith(tier, "BER");

    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();
    eq(M.import.count, "1 photo to import. It will be added to:",
      "a single-file drop goes through the same dialog, counted in the singular");
    eq(M.modals.filter(m => m.id === "#importModal" && m.action === "open").length, 1,
      "…exactly one dialog, not a special case that skips it");
    await settle(M);
    await run;
    eq(countOf(M), 1, "and it imports the one photo");
    eq((M.state.people[0] || {}).tierId, tier, "into the grade the dialog asked for");
    eq(M.groupLabel(M.state, M.state.people[0] || {}), "BER", "with the group it asked for");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, "Already Here"));
    const before = JSON.stringify(M.state);
    M.dirtyDoc = false;
    M.cancelImport();

    const run = M.addFiles([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg")]);
    await settle(M);
    await run;

    eq(countOf(M), 1, "cancelling imports nobody");
    eq(JSON.stringify(M.state), before, "…and leaves the roster byte-for-byte as it was");
    eq(M.history.length, 0, "…with no undo step");
    eq(M.dirtyDoc, false, "…and no dirty flag");
    eq(M.decodes.length, 0, "…and nothing ever reached the decoder");
    eq(M.alerts.length, 0, "…and nothing is reported: cancelling is not a failure");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[4].id, "LON");
    const first = M.addFiles([file("Ada_Lovelace.jpg")]);
    await settle(M); await first;

    M.import.group = "LON";
    M.import.tier = M.state.tiers[4].id;

    M.answerImportWith(M.state.tiers[0].id, "");
    const second = M.addFiles([file("Alan_Turing.jpg")]);
    await tick();
    eq(M.import.group, "", "the group field opens empty, not holding the last answer");
    eq(M.import.tier, M.state.tiers[0].id,
      "and the grade opens on the first grade, not on the last import's answer");
    await settle(M); await second;
    eq(M.groupLabel(M.state, who(M, 1)), "", "so the second import takes its own answer");
  }

  const tierOf = (M, i) => (M.state.people[i] || {}).tierId;
  const cell = (rows, r, c) => ((rows[r] || [])[c] != null ? rows[r][c] : "<no cell>");
  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tiers0 = M.state.tiers.length;
    M.openPasteModal();
    M.preview("Ada Lovelace\tP\tFRA\tCountry Head\nAlan Turing\tSC\tHAM");
    eq(M.paste.previewShown, true, "a preview of matched rows reaches the table step");
    eq(M.pasteRows.filter(r => r.tierId === M.PASTE_NEW).length, 0,
      "every row matched a grade, so none carries the sentinel");
    eq(M.paste.summary, "2 people",
      "…and the summary says nothing about a new grade — got " + JSON.stringify(M.paste.summary));
    M.pasteAdd();
    eq(M.state.tiers.length, tiers0,
      "a paste whose every row names a known grade creates no NEW grade");
    check(!M.pasteNewTier(), "…and there is no grade called NEW to find");
    eq(countOf(M), 2, "both people were added");
    eq(M.history.length, 1, "in one undo step");

    eq((M.state.people[0] || {}).role, "Country Head",
      "a pasted row's fourth column lands on the person's role");
    eq((M.state.people[1] || {}).role, "",
      "…and a row with no fourth column gets no role at all");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tiers0 = M.state.tiers.length;
    M.openPasteModal();
    M.preview("Ada Lovelace\tP\tFRA\nNo Grade Column\nNamed Nonsense\tZaphod\tHAM");

    const rows = M.pasteRows;
    eq(rows.length, 3, "all three rows are parsed");
    eq(rows.filter(r => r.tierId === M.PASTE_NEW).length, 2,
      "the row with no grade column and the row naming an unknown grade both carry the sentinel");
    eq(rows.filter(r => r.unmatched).length, 1,
      "…but only one of them is `unmatched` — which is why the summary cannot use it");
    check(/2 rows name no grade this document has/.test(M.paste.summary),
      "the summary counts the sentinel rows, not the unmatched ones — got "
      + JSON.stringify(M.paste.summary));
    check(/a new grade called NEW/.test(M.paste.summary),
      "…and says where they are going");

    const cells = M.pasteCells();
    eq(cells.length, 3, "the table has a row per parsed row");
    eq(cell(cells, 0, 1), "Partner", "a matched row's Grade column names its grade");
    eq(cell(cells, 1, 1), "NEW", "a row with no grade column is shown going to NEW");
    check(cell(cells, 2, 1).indexOf("NEW") >= 0,
      "…and so is a row naming a grade the document does not have — got "
      + JSON.stringify(cell(cells, 2, 1)));

    M.pasteAdd();
    eq(M.state.tiers.length, tiers0 + 1,
      "ONE grade is created for both rows that needed it, not one each");

    const made = M.pasteNewTier() || {};
    check(!!M.pasteNewTier(), "and it is findable as the NEW grade");

    eq(made.code, cell(cells, 1, 1),
      "…carrying the code the preview's Grade column promised");

    eq(Object.keys(made).sort().join(","),
       Object.keys(M.newTier("Z", "Z")).sort().join(","),
      "…and exactly the fields newTier() writes — no more, no fewer");
    check(!("role" in made), "…and no grade-wide role, which no grade has");

    eq(countOf(M), 3, "all three people were added");
    check(tierOf(M, 1) === made.id && tierOf(M, 2) === made.id,
      "both sentinel rows landed in that one grade");
    eq(tierOf(M, 0), (M.state.tiers[0] || {}).id,
      "and the matched row still went where it matched");

    check(M.state.people.every(p => p.tierId !== M.PASTE_NEW),
      "no person carries the sentinel into state");
    eq(M.pasteRows.length, 0, "and it does not outlive confirmPaste");

    eq(M.history.length, 1, "the people and the grade are ONE undo step");
    M.undo();
    eq(countOf(M), 0, "undo takes the people back");
    eq(M.state.tiers.length, tiers0,
      "…and the grade with them — a paste undone leaves no orphan grade");
    check(!M.pasteNewTier(), "…so there is no NEW grade left in the strip");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tiers0 = M.state.tiers.length;
    M.openPasteModal();
    M.preview("First Person");
    M.pasteAdd();
    const first = M.pasteNewTier() || {};
    check(!!M.pasteNewTier(), "the first paste created the NEW grade");
    eq(M.state.tiers.length, tiers0 + 1, "…one grade");

    M.openPasteModal();
    M.preview("Second Person");
    check(/the existing NEW grade/.test(M.paste.summary),
      "the second preview says the grade already exists rather than promising a new one — got "
      + JSON.stringify(M.paste.summary));
    eq(cell(M.pasteCells(), 0, 1), first.label,
      "…and the Grade column names that grade by its own name");
    M.pasteAdd();
    eq(M.state.tiers.length, tiers0 + 1,
      "a second paste reuses the first NEW grade rather than adding a second");
    eq(tierOf(M, 1), first.id, "…and puts its row in it");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.openPasteModal();
    M.preview("First Person");
    M.pasteAdd();
    const made = M.pasteNewTier() || {};
    const tiers1 = M.state.tiers.length;
    made.code = "TBD";
    made.label = "new";
    M.openPasteModal();
    M.preview("Second Person");
    M.pasteAdd();
    eq(M.state.tiers.length, tiers1,
      "a NEW grade found by its name rather than its code is still reused");
    eq(tierOf(M, 1), made.id, "…and the row goes into it");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, "Already Here"));
    const tiers0 = M.state.tiers.length;
    M.openPasteModal();
    M.preview("Replacement Person");
    M.pasteReplace();
    eq(countOf(M), 1, "replace leaves only the pasted person");
    eq((M.state.people[0] || {}).name, "Replacement Person", "…and it is the pasted one");
    eq(M.state.tiers.length, tiers0 + 1,
      "replace added the NEW grade its row needed and removed no grade");
    eq(M.history.length, 1, "one undo step for the replacement and the grade");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = [];
    for(let i = 0; i < M.LIMITS.tiers; i++){
      M.state.tiers.push({id:"t" + i, code:"G" + i, label:"Grade " + i,
                          fill:"green", attach:false, merge:false, align:"center"});
    }
    M.dirtyDoc = false;
    M.openPasteModal();
    M.preview("Nobody Fits");

    eq(M.state.tiers.length, M.LIMITS.tiers,
      "previewing creates no grade — the refusal is decided without making one");
    eq(M.history.length, 0, "…and snapshots nothing");
    eq(M.paste.addDisabled, true, "at the grade limit: Add these is disabled");
    check(/at most \d+ grades/.test(M.paste.addTitle),
      "…and says why — got " + JSON.stringify(M.paste.addTitle));

    eq(M.paste.replaceDisabled, true,
      "at the grade limit: Replace roster is disabled as well — replacing frees no grade slot");
    check(M.paste.addTitle === M.paste.replaceTitle,
      "…for the same stated reason");

    const before = JSON.stringify(M.state);
    M.pasteAdd();

    check(JSON.stringify(M.state) === before,
      "and confirmPaste refuses anyway, leaving the document byte-for-byte as it was");
    eq(countOf(M), 0, "nobody was added");
    eq(M.history.length, 0, "nothing was snapshotted for a paste that cannot go through");
    eq(M.dirtyDoc, false, "…and the document is not dirty");
    check(M.alerts.length === 1 && /at most \d+ grades/.test(M.alerts[0]),
      "…and the refusal is reported once, in the grade-limit wording — got "
      + JSON.stringify(M.alerts));

    M.state.tiers[0].code = "NEW";
    M.preview("Nobody Fits");
    eq(M.paste.addDisabled, false,
      "with a NEW grade already present the same paste is allowed at the limit");
    M.pasteAdd();
    eq(countOf(M), 1, "…and goes through");
    eq(tierOf(M, 0), "t0", "into the existing NEW grade");
    eq(M.state.tiers.length, M.LIMITS.tiers, "creating nothing");
  }

  {

    const A = makeModule();
    A.state = A.defaults();
    A.state.tiers = sixGrades();
    await A.commands.addGrade();
    const byCommand = A.state.tiers[A.state.tiers.length - 1] || {};
    check(!!A.state.tiers.length, "the add-grade command, answered with its own defaults, creates a grade");

    const B = makeModule();
    B.state = B.defaults();
    B.state.tiers = sixGrades();
    B.openPasteModal();
    B.preview("Nobody Named A Grade");
    B.pasteAdd();
    const byPaste = B.pasteNewTier() || {};
    check(!!B.pasteNewTier(), "and so does a paste with a row naming no grade");

    eq(byPaste.code, byCommand.code,
      "the two writers give the grade the same code");
    eq(byPaste.label, byCommand.label,
      "…and the same name — the paste uses addGrade's default pair, not a pair of its own");
    eq(Object.keys(byPaste).sort().join(","), Object.keys(byCommand).sort().join(","),
      "…and the same fields");
    eq(JSON.stringify(Object.assign({}, byPaste, {id:0})),
       JSON.stringify(Object.assign({}, byCommand, {id:0})),
      "…and the same value for every one of them but the id");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = [];
    for(let i = 0; i < M.LIMITS.tiers; i++){
      M.state.tiers.push({id:"t" + i, code:"G" + i, label:"Grade " + i,
                          fill:"green", attach:false, merge:false, align:"center"});
    }
    await M.commands.addGrade();
    const fromAdd = M.alerts.slice();
    eq(fromAdd.length, 1, "the add-grade command refuses at the limit");
    M.openPasteModal();
    M.preview("Nobody Fits");
    M.pasteAdd();
    eq(M.alerts.length, 2, "and so does the paste");
    eq(M.alerts[1], fromAdd[0],
      "…in the identical sentence, not a fourth phrasing of the same limit");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    eq(M.state.tiers.length, 0, "a fresh document ships with no grades — the premise this block tests");
    M.openPasteModal();
    M.preview("Ada Lovelace\tPartner\nBob\tpartner\nCyd\tAssociate\nDee");
    check(/creates 2 grades/.test(M.paste.summary),
      "the preview names the creation — two distinct values in the Grade column — got "
      + JSON.stringify(M.paste.summary));
    check(/1 row names no grade, and goes to a new grade called NEW/.test(M.paste.summary),
      "…and counts only the one row with an empty cell, not the two that matched "
      + "each other — got " + JSON.stringify(M.paste.summary));

    const cells = M.pasteCells();
    eq(cell(cells, 0, 1), "Partner", "Ada's row shows the grade it will create");
    eq(cell(cells, 1, 1), "Partner",
      "Bob's differently-cased row shows the SAME grade — Partner's first-seen casing, not his own");
    eq(cell(cells, 2, 1), "Associate", "Cyd's row shows her own, second, grade");
    eq(cell(cells, 3, 1), "NEW", "Dee's empty-cell row shows where it is actually going");

    M.pasteAdd();
    eq(M.state.tiers.map(t => t.code).join(","), "Partner,Associate,NEW",
      "exactly three grades, in the order the list produced them — Partner and Associate "
      + "from first appearance in the Grade column, NEW appended after them for the empty cell");

    ["Partner", "Associate"].forEach(code => {
      const t = M.state.tiers.find(x => x.code === code) || {};
      eq(t.code, t.label, "a grade the list's own Grade column creates carries the pasted "
        + "value as BOTH code and label — " + JSON.stringify(t));
    });
    const byCode = code => (M.state.tiers.find(t => t.code === code) || {}).id;
    eq(tierOf(M, 0), byCode("Partner"), "Ada resolved to the Partner grade");
    eq(tierOf(M, 1), byCode("Partner"), "…and so did Bob, despite the different casing");
    eq(tierOf(M, 2), byCode("Associate"), "Cyd resolved to her own grade");
    eq(tierOf(M, 3), byCode("NEW"), "Dee's empty cell resolved to NEW");

    eq(M.history.length, 1, "the three grades and the four people are ONE undo step");
    M.undo();
    eq(countOf(M), 0, "undo takes every pasted person back");
    eq(M.state.tiers.length, 0, "…and every grade it created with them — no orphans left in the strip");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tiers0 = M.state.tiers.length;
    M.openPasteModal();
    M.preview("Zora Zaphod\tZaphod");
    M.pasteAdd();
    eq(M.state.tiers.length, tiers0 + 1, "one grade added — the shared NEW, not a grade called Zaphod");
    check(!M.state.tiers.some(t => t.code === "Zaphod" || t.label === "Zaphod"),
      "no grade named after the unmatched value was created");
    const made = M.pasteNewTier() || {};
    check(!!M.pasteNewTier(), "the existing NEW-resolution path still found (or made) the grade");
    eq(tierOf(M, 0), made.id, "…and the row landed in it, exactly as it does with grades present today");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.dirtyDoc = false;
    let text = "";
    for(let i = 0; i < 60; i++) text += "Person" + i + "\tGrade" + i + "\n";
    text += "Nobody's Grade\n";
    M.openPasteModal();
    M.preview(text);
    eq(M.paste.addDisabled, true,
      "60 distinct values in the list plus an empty-cell row need 61 grades — over the 60-grade limit");
    eq(M.paste.replaceDisabled, true, "…Replace too — replacing frees no grade slot");
    check(/at most \d+ grades/.test(M.paste.addTitle), "…for the grade-limit reason");
    M.pasteAdd();
    eq(M.state.tiers.length, 0, "confirmPaste refuses before creating a single grade");
    eq(countOf(M), 0, "…and adds nobody");
    eq(M.history.length, 0, "…snapshotting nothing for a paste that cannot go through");
    eq(M.dirtyDoc, false, "…and the document stays clean");
    check(M.alerts.length === 1 && /at most \d+ grades/.test(M.alerts[0]),
      "the refusal is reported once, in the grade-limit wording");
  }
  {

    const M = makeModule();
    M.state = M.defaults();
    let text = "";
    for(let i = 0; i < 59; i++) text += "Person" + i + "\tGrade" + i + "\n";
    text += "Nobody's Grade\n";
    M.openPasteModal();
    M.preview(text);
    eq(M.paste.addDisabled, false, "59 distinct values plus one empty-cell row need exactly 60 grades — allowed at the limit");
    M.pasteAdd();
    eq(M.state.tiers.length, 60, "59 created from the list, plus one NEW for the empty-cell row");
    eq(countOf(M), 60, "all 60 people were added");
  }
  {

    const M = makeModule();
    M.state = M.defaults();
    let text = "";
    for(let i = 0; i < 59; i++) text += "Person" + i + "\tGrade" + i + "\n";
    text += "Files Own New Grade\tNEW\n";
    text += "Nobody's Grade\n";
    M.openPasteModal();
    M.preview(text);
    eq(M.paste.addDisabled, false,
      "60 distinct values where one IS \"NEW\" need no extra grade for the empty-cell row — still allowed at the limit");
    M.pasteAdd();
    eq(M.state.tiers.length, 60, "no 61st grade created — the empty-cell row reused the file's own NEW");
    eq(countOf(M), 61, "all 61 people were added — 59 named grades, the file's own NEW, and the empty-cell row");
    const madeNew = M.state.tiers.find(t => t.code === "NEW") || {};
    check(!!madeNew.id, "the file's own NEW-normalizing grade exists");
    eq(tierOf(M, 60), madeNew.id, "…and the empty-cell row (the last one pasted) landed in it");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    const fromDefaults = (M.TEMPLATES.find(t => t.id === "big4-green") || {}).grades()[0];

    await M.commands.addGrade();
    const fromCommand = M.state.tiers[M.state.tiers.length - 1] || {};

    const P = makeModule();
    P.state = P.defaults();
    P.state.tiers = sixGrades();
    P.openPasteModal();
    P.preview("Nobody Named A Grade");
    P.pasteAdd();
    const fromPaste = P.pasteNewTier() || {};

    const writers = [["a template",  fromDefaults],
                     ["Add grade",     fromCommand],
                     ["a paste",       fromPaste]];
    const shape = o => Object.keys(o).sort().join(",");
    for(const [name, o] of writers){
      check(!!o && !!o.id, name + " produced a grade with an id");
      eq(shape(o), shape(fromDefaults),
        name + " writes the same field set as the others — got " + shape(o));
      check(!("role" in o), name + " writes no role");
    }

    const DEFAULTS = {fill:"green", attach:false, merge:false, align:"center"};
    for(const [name, o] of writers){
      for(const k of Object.keys(DEFAULTS)){
        eq(o[k], DEFAULTS[k],
          name + "'s default " + k + " is " + JSON.stringify(DEFAULTS[k]));
      }
    }

    for(const [name, o] of writers){
      eq(JSON.stringify(Object.assign({}, o, {id:0, code:0, label:0})),
         JSON.stringify(Object.assign({}, fromDefaults, {id:0, code:0, label:0})),
        name + " agrees with the others on every field but the code and name");
    }

    const ids = writers.map(w => w[1].id);
    eq(new Set(ids).size, 3, "each call produces a fresh id");

    const a = (M.TEMPLATES.find(t => t.id === "big4-green") || {}).grades()[1] || {};
    eq(a.fill, "white", "an option the caller passes is honoured (fill)");
    eq(a.attach, true, "…and attach");
    eq(a.align, "right", "…and align");

    const c = (M.TEMPLATES.find(t => t.id === "mbb-blue") || {}).grades()[1] || {};
    check(c.merge === true && c.attach === true,
      "normalizeGradeLinks still runs over a template's grades");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    const at = i => (M.state.tiers[i] || {}).id;
    const third = at(3);

    M.setAdd({tier:at(0)});
    M.openAddModal(third);
    eq(M.add.tier, third, "openAddModal(id) opens on the grade it was given");

    M.openAddModal();
    eq(M.add.tier, third, "openAddModal() keeps whatever was chosen last");

    const gone = at(3);
    const stays = at(1);
    M.state.tiers = M.state.tiers.filter(t => t.id !== gone);
    check(M.state.tiers.length > 0 && !M.state.tiers.some(t => t.id === gone),
      "…after removing exactly that grade and leaving the others — got "
      + M.state.tiers.length + " grade(s)");

    M.setAdd({tier:stays});
    M.openAddModal(gone);
    eq(M.add.tier, stays,
      "a deleted grade's id leaves the previous choice standing — it replaces the "
      + "choice only when it names a grade that exists");

    M.setAdd({tier:gone});
    M.openAddModal(gone);
    eq(M.add.tier, at(0),
      "…and with no usable previous choice either, the first grade");
    check(M.add.tier !== "" && M.add.tier != null,
      "…so the dialog never opens with no grade selected");

    M.setAdd({tier:at(2)});
    M.openAddModal({type:"click", clientX:10});
    eq(M.add.tier, at(2),
      "an argument that is not a grade id changes nothing — it cannot select a grade");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.groups = [{id:"g1", label:"Berlin"}, {id:"g2", label:"Frankfurt"},
                       {id:"g3", label:"London"}];
    M.openAddModal();
    eq(JSON.stringify(M.groupOptions), JSON.stringify(["Berlin","Frankfurt","London"]),
      "opening Add fills the group suggestion list from state.groups, in order — "
      + "got " + JSON.stringify(M.groupOptions));

    M.state.groups = [{id:"g4", label:"Munich"}];
    M.openAddModal();
    eq(JSON.stringify(M.groupOptions), JSON.stringify(["Munich"]),
      "…and reopening it rebuilds the list fresh from whatever state.groups holds now");

    M.state.groups = [{id:"g5", label:"Zurich"}, {id:"g6", label:"Vienna"}];
    const jane = {id:"jane", name:"Jane", tierId:M.state.tiers[0].id, groupId:null};
    M.state.people = [jane];
    M.openEditModal(jane.id);
    eq(JSON.stringify(M.groupOptions), JSON.stringify(["Zurich","Vienna"]),
      "openEditModal fills the same suggestion list on open");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[1].id;

    M.setAdd({tier:tier, group:"Berlin"});
    M.openAddModal();
    eq(M.add.group, "",
      "a stale typed group must not survive a close/reopen — it describes "
      + "the last person, not the next one");
    eq(M.add.tier, tier,
      "…while the grade choice, unlike group, is the one field openAddModal keeps on reopen");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.dirtyDoc = false;
    const tier = M.state.tiers[2].id;

    M.setAdd({tier:tier, group:"FRA", name:"Ada Lovelace", files:[]});

    eq(await M.addOnePerson(), true, "a successful Add reports that it added somebody");

    eq(countOf(M), 1, "Add creates exactly one person");
    const p = M.state.people[0];
    eq(p.name, "Ada Lovelace", "…carrying the name the dialog held");
    eq(p.tierId, tier, "…in the grade the dialog was set to");
    eq(M.groupLabel(M.state, p), "FRA", "…and the group it was set to");
    eq(p.photo, null, "…and no photo, because none was chosen — Name stays optional too");
    eq(M.history.length, 1, "one added person is exactly one history entry");
    eq(M.dirtyDoc, true, "…and the document is dirty");

    eq(M.add.name, "", "after Add the name is cleared");
    eq(M.add.files.length, 0, "after Add the photo is cleared");
    eq(M.add.tier, tier, "after Add the grade is KEPT for the next person");
    eq(M.add.group, "", "after Add the group is cleared too — it described "
      + "the person just added, not the next one");
    eq(M.focused[M.focused.length - 1], "#addName", "and focus goes back to the name");
    check(M.toasts.some(t => /1 person added/.test(t)), "the existing toast confirms it");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const g0 = M.state.tiers[0], g1 = M.state.tiers[1];

    M.setAdd({tier:g0.id, group:"FRA", name:"Ada Lovelace", role:"Chief Cartographer"});
    eq(await M.addOnePerson(), true, "the add succeeds");
    eq(countOf(M), 1, "…creating one person");
    eq(M.state.people[0].role, "Chief Cartographer",
      "…carrying exactly the role literal the dialog held — got "
      + JSON.stringify(M.state.people[0] && M.state.people[0].role));

    eq(M.add.role, "", "after Add the role is cleared, the same as name and photo");
    eq(M.add.group, "", "…and group clears too — the test's own literal "
      + "does not survive to the next person");
    eq(M.add.tier, g0.id, "…while the grade selection is kept");

    M.setAdd({tier:g0.id});
    M.syncAddRolePlaceholder();
    eq(M.add.rolePlaceholder, g0.label,
      "the placeholder reads grade 0's own label ("+JSON.stringify(g0.label)+")");

    M.setAdd({tier:g1.id});
    M.syncAddRolePlaceholder();
    eq(M.add.rolePlaceholder, g1.label,
      "…and switching the selection to a different grade flips it to THAT "
      + "grade's label ("+JSON.stringify(g1.label)+") — not the first grade's");

    M.setAdd({tier:""});
    M.syncAddRolePlaceholder();
    eq(M.add.rolePlaceholder, "",
      "…and with no grade selected at all, the placeholder is empty — got "
      + JSON.stringify(M.add.rolePlaceholder));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;
    for(let i = 0; i < 5; i++){
      M.setAdd({tier:tier, group:"FRA", name:"Person " + i});
      await M.addOnePerson();
    }
    eq(countOf(M), 5, "five Adds create five people");
    eq(M.history.length, 5, "…and five separate history entries");
    check(M.state.people.every(x => x.tierId === tier && M.groupLabel(M.state, x) === "FRA"),
      "…every one of them in the grade and group the dialog held throughout");
    check(M.state.people.map(x => x.name).join(",") === "Person 0,Person 1,Person 2,Person 3,Person 4",
      "…and each with its own name, so no field leaked into the next person");
    M.undo();
    eq(countOf(M), 4, "undo takes back exactly one of them");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.dirtyDoc = false;
    const choice = M.choosePhoto(file("notes.txt"));
    await tick();
    eq(M.decodes.length, 1, "a chosen photo reaches the shared decoder — at the "
      + "choice, not at Add");
    M.decodes[0].rej(new Error("only JPEG and PNG photos are supported"));
    await choice;
    check(M.alerts.some(x => /only JPEG and PNG/.test(x)),
      "a refused file is reported where the choice was made, in the decoder's "
      + "own words rather than a second phrasing of them");
    check(M.alerts.some(x => /^That photo was not used/.test(x)),
      "…saying the PHOTO was not used: nobody was being added yet, so it must "
      + "not borrow addOnePerson's 'Nobody was added'");
    check(!M.alerts.some(x => /Nobody was added/.test(x)),
      "…and nothing here claims nobody was added, which is a different outcome");

    eq(M.pending, null, "a refused file leaves nothing in the well");
    eq(M.add.files.length, 0,
      "…and clears the input, which must not go on naming a file the dialog refused");
    eq(M.add.wellShown, false, "…and shows no preview");
    eq(M.history.length, 0, "choosing a photo writes no history entry");
    eq(M.dirtyDoc, false, "…and no dirty flag — nothing in the document changed");
    eq(countOf(M), 0, "…and adds nobody");

    M.setAdd({tier:M.state.tiers[0].id, group:"", name:"Nope"});
    eq(await M.addOnePerson(), true,
      "the person can still be added afterwards, because the refusal was about "
      + "the photo and not about them");
    eq(who(M, 0).photo, null, "…with no photo");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file("Grace_Hopper.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:100});
    await choice;
    eq(M.add.name, "Grace Hopper",
      "a blank Name is filled from the file name — got " + JSON.stringify(M.add.name));
    eq(M.add.pickText, "GH",
      "…and the placeholder circle's initials are synced in the same breath, "
      + "not one render behind it — got " + JSON.stringify(M.add.pickText));
    eq(JSON.stringify(M.pending.frame), JSON.stringify({zoom:1, ox:0, oy:0}),
      "…and the frame is still the default one — filling the name changes "
      + "nothing about the photo itself");
  }

  for(const [filename, want, why] of [
    ["müller.jpg", "Müller",
      "a leading letter followed by a non-ASCII letter is title-cased once, "
      + "not letter-by-letter — the ü must not be pulled uppercase by \\b"],
    ["anna_müller.jpg", "Anna Müller",
      "each word gets exactly one capital, umlaut included, after the "
      + "underscore-to-space separator collapse"],
    ["ölberg, anna.png", "Anna Ölberg",
      "the comma swap moves the surname first, and the umlaut starting "
      + "that surname is still title-cased"],
    ["ßler.jpg", "ßler",
      "the ß guard: \"ß\".toUpperCase() is the two-character \"SS\", so it "
      + "must be left alone rather than turning \"ßler\" into \"SSler\""],
    ["grace_hopper.jpg", "Grace Hopper",
      "plain ASCII filenames are title-cased exactly as before"],

    ["m" + "u\u0308" + "ller.jpg", "M\u00fcller",
      "a macOS NFD filename (u + U+0308 combining diaeresis, not the "
      + "precomposed \u00fc) must normalize to NFC before title-casing, or "
      + "the combining mark reads as a word start and uppercases the "
      + "letter after it instead"],
    ["anna_m" + "u\u0308" + "ller.jpg", "Anna M\u00fcller",
      "the same NFD normalization (u + U+0308) applies after the "
      + "separator collapse, across a two-word filename"],
    ["o\u0308" + "lberg.jpg", "\u00d6lberg",
      "a decomposed umlaut (o + U+0308) at the very start of the string "
      + "still earns exactly one capital, on the base letter, not on the "
      + "letter after the combining mark"],

    ["n" + "\u0304" + "andor.jpg", "N" + "\u0304" + "andor",
      "n + U+0304 combining macron has no precomposed NFC form, so "
      + "normalization cannot fold this case \u2014 the boundary class must "
      + "itself treat a combining mark as riding on its base letter, or "
      + "the letter after the macron gets pulled uppercase too"],
  ]){
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file(filename));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:100});
    await choice;
    eq(M.add.name, want, why + " — file " + JSON.stringify(filename)
      + ", got " + JSON.stringify(M.add.name));
  }
  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setAdd({tier:M.state.tiers[0].id, group:"", name:"Ada Lovelace"});
    const choice = M.choosePhoto(file("Grace_Hopper.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:100});
    await choice;
    eq(M.add.name, "Ada Lovelace",
      "a typed Name is untouched by choosing a photo — got " + JSON.stringify(M.add.name));

    M.addClickFact("replace");
    const replace = M.choosePhoto(file("Alan_Turing.jpg"));
    await tick();
    M.decodes[M.decodes.length - 1].res({data:"data:image/jpeg;base64,CCCC", w:100, h:100});
    await replace;
    eq(M.add.name, "Ada Lovelace",
      "…and Replace photo does not touch it either — got " + JSON.stringify(M.add.name));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[1].id;
    const wide = M.choosePhoto(file("Wide.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,WWWW", w:200, h:120});
    await wide;
    eq(M.add.wellShown, true, "an accepted photo shows the well");
    eq(M.pending.result.data, "data:image/jpeg;base64,WWWW",
      "…holding the DECODED image — the downscaled one that gets stored, not "
      + "the original the user picked");
    check(M.pending && M.pending.result.w === 200,
      "…and the well holds the decoder's own dimensions");
    eq(JSON.stringify(M.pending.frame), JSON.stringify({zoom:1, ox:0, oy:0}),
      "a freshly chosen photo starts at the default frame — nothing has "
      + "touched it yet");

    const tall = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[M.decodes.length - 1].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
    await tall;
    eq(M.pending.result.data, "data:image/jpeg;base64,BBBB",
      "choosing a second photo replaces the first in the well rather than "
      + "adding to it");
    eq(JSON.stringify(M.pending.frame), JSON.stringify({zoom:1, ox:0, oy:0}),
      "…and the second photo ALSO starts at the default frame, not whatever "
      + "the first one's would have become");

    M.setAdd({tier:tier, group:"BER", name:"Ada"});
    eq(await M.addOnePerson(), true, "an accepted photo reports success");
    eq(countOf(M), 1, "an accepted photo adds the person");
    eq(who(M, 0).photo, "data:image/jpeg;base64,BBBB", "…with the decoded photo");
    eq(who(M, 0).pw, 100, "…and the decoder's width, not the file's claim");
    eq(who(M, 0).ph, 120, "…and its height");
    eq(M.history.length, 1, "…as one history entry");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;

    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
    await choice;
    M.setAdd({tier:tier, group:"FRA", name:"Ada"});
    await M.addOnePerson();

    eq(M.pending, null, "after an Add the well is empty");
    eq(M.add.files.length, 0, "…the input is cleared with it");
    eq(M.add.wellShown, false, "…and the preview is gone");

    M.setAdd({tier:tier, group:"FRA", name:"Grace"});
    eq(await M.addOnePerson(), true, "a second Add with no photo chosen succeeds");
    eq(countOf(M), 2, "…and adds a second person");
    const two = who(M, 1);
    eq(two.name, "Grace", "…who is the second person");
    eq(two.photo, null, "the second person gets NO photo — not the first person's");
    eq(two.pw, 0, "…and no stored width left over from it");
    eq(two.ph, 0, "…and no height");
    eq(two.frame, null, "…and no framing pointing at a picture that is not theirs");
    eq(who(M, 0).photo, "data:image/jpeg;base64,BBBB",
      "…while the first person keeps the photo that was actually chosen for them");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
    await choice;
    check(M.pending !== null, "a chosen photo is in the well before the close");

    M.closeAddModal();
    eq(M.pending, null, "closing the dialog empties the well");
    eq(M.add.files.length, 0, "…and the input with it");
    eq(M.add.wellShown, false, "…and hides the preview");

    M.openAddModal();
    eq(M.pending, null, "and reopening finds it still empty");
    eq(M.add.wellShown, false, "…with no preview showing");

    {
      const again = M.choosePhoto(file("Ada.jpg"));
      await tick();

      M.decodes[M.decodes.length - 1].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
      await again;
      check(M.pending !== null, "…a photo chosen with the dialog open is in the well");
      M.openAddModal();
      eq(M.pending, null, "…and Open empties it itself, not only because Close did");
      eq(M.add.wellShown, false, "…hiding the preview with it");
      eq(M.add.files.length, 0, "…and clearing the input");
    }
    M.setAdd({tier:M.state.tiers[0].id, name:"Grace", group:""});
    await M.addOnePerson();
    eq(who(M, 0).photo, null,
      "…so the person added after a close-and-reopen has no photo");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
    await choice;
    M.dirtyDoc = false;
    const entries = M.history.length;

    M.addClickFact("remove");
    eq(M.pending, null, "Remove photo empties the well");
    eq(M.add.files.length, 0, "…and clears the input, so the same file can be chosen again");
    eq(M.add.wellShown, false, "…and hides the preview");
    eq(M.history.length, entries, "…writing no history entry");
    eq(M.dirtyDoc, false, "…and no dirty flag, because no document state changed");
    eq(M.focused[M.focused.length - 1], "#addPhotoPick",
      "…and moves focus into the placeholder section that replaced the framing "
      + "editor — the same rule Edit's own Remove photo follows for its "
      + "rebuilt section, applied here");

    M.setAdd({tier:M.state.tiers[0].id, name:"Ada", group:""});
    await M.addOnePerson();
    eq(who(M, 0).photo, null, "and the person is added with no photo");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:200, h:100});
    await choice;
    M.dirtyDoc = false;
    const entries = M.history.length;

    M.addZoom(1.6);
    eq(M.pending.frame.zoom, 1.6, "zooming in the Add dialog writes addPending.frame.zoom");
    eq(M.history.length, entries, "…without writing a history entry — the person does not exist yet");
    eq(M.dirtyDoc, false, "…or setting the dirty flag");

    M.addPanKey("ArrowRight", false);
    check(M.pending.frame.ox > 0,
      "an arrow-key pan step moves addPending.frame.ox — got " + M.pending.frame.ox);
    eq(M.history.length, entries, "…a pan step ALSO writes no history entry");
    eq(M.dirtyDoc, false, "…nor a dirty flag");

    M.addClickFact("reset");
    eq(JSON.stringify(M.pending.frame), JSON.stringify({zoom:1, ox:0, oy:0}),
      "Reset photo puts the frame back to default — got " + JSON.stringify(M.pending.frame));
    eq(M.history.length, entries, "…and reset writes no history entry either");
    eq(M.dirtyDoc, false, "…nor a dirty flag");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:200, h:100});
    await choice;

    M.addZoom(1.5);
    M.addPanKey("ArrowRight", false);
    M.addPanKey("ArrowDown", false);
    eq(M.pending.frame.zoom, 1.5, "the well holds the zoomed frame before the Add");
    eq(M.pending.frame.ox, 0.05, "…the panned horizontal offset");
    eq(M.pending.frame.oy, 0.05, "…and the vertical one");

    M.setAdd({tier:tier, group:"", name:"Ada"});
    eq(await M.addOnePerson(), true, "the add succeeds");
    eq(who(M, 0).frame.zoom, 1.5,
      "the new person's frame carries the zoom that was set in the well — "
      + "not photoFields' own default of 1");
    eq(who(M, 0).frame.ox, 0.05, "…the horizontal pan");
    eq(who(M, 0).frame.oy, 0.05, "…and the vertical pan");

    const again = M.choosePhoto(file("Grace.jpg"));
    await tick();
    M.decodes[M.decodes.length - 1].res({data:"data:image/jpeg;base64,CCCC", w:100, h:100});
    await again;
    eq(JSON.stringify(M.pending.frame), JSON.stringify({zoom:1, ox:0, oy:0}),
      "the next pending photo starts at the default frame, not the previous "
      + "one's edited values");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;
    M.setPendingDirectly({result:{data:"data:image/jpeg;base64,DDDD", w:100, h:100},
                          gen:M.docGen, frame:{zoom:1.5, ox:5, oy:5}});
    M.setAdd({tier:tier, group:"", name:"Out Of Range"});
    eq(await M.addOnePerson(), true, "the add succeeds even with an out-of-range frame");
    eq(who(M, 0).frame.ox, 0.5,
      "the committed frame is clamped, not carried through raw — got "
      + who(M, 0).frame.ox);
    eq(who(M, 0).frame.oy, 0.5, "…in both directions — got " + who(M, 0).frame.oy);
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
    await choice;

    await M.newDoc();
    M.dirtyDoc = false;

    M.state.tiers = sixGrades();
    M.setAdd({tier:M.state.tiers[0].id, group:"", name:"Ada"});
    eq(await M.addOnePerson(), false,
      "a photo decoded for a document that has gone reports no add");
    eq(countOf(M), 0, "a photo decoded for a document that has gone adds nobody");
    eq(M.history.length, 0, "…and leaves no history entry behind");
    eq(M.dirtyDoc, false, "…and no dirty flag");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    await M.newDoc();
    M.decodes[0].res({data:"data:image/jpeg;base64,BBBB", w:100, h:120});
    await choice;
    M.dirtyDoc = false;

    M.state.tiers = sixGrades();
    M.setAdd({tier:M.state.tiers[0].id, group:"", name:"Ada"});
    eq(await M.addOnePerson(), false,
      "a photo whose decode STARTED in a document that has since gone is "
      + "refused — the generation is captured before the await, not after");
    eq(countOf(M), 0, "…adding nobody");
    eq(M.dirtyDoc, false, "…and leaving no dirty flag");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id, "");
    const batch = M.addFiles([file("Grace_Hopper.jpg")]);
    await tick();
    const before = M.decodes.length;

    const blocked = M.choosePhoto(file("Ada.jpg"));
    await tick();
    check(M.toasts.some(t => /Still importing the last batch/.test(t)),
      "choosing a photo mid-import says so, in the same words the drop path and "
      + "Add already use for the same condition");
    eq(M.decodes.length, before,
      "…and does not start a second decode alongside the batch's");
    eq(M.pending, null, "…leaving nothing in the well");
    eq(M.add.files.length, 0, "…and nothing in the input either");
    eq(M.add.wellShown, false, "…and no preview");

    await settle(M); await batch; await blocked;
    M.setAdd({tier:M.state.tiers[0].id, group:"", name:"Ada"});
    await M.addOnePerson();
    eq(who(M, countOf(M) - 1).photo, null,
      "and the person added afterwards has no photo, because none was taken");

    const held = countOf(M);
    const slow = M.choosePhoto(file("Ada.jpg"));
    await tick();
    const seen = M.toasts.length;
    M.answerImportWith(M.state.tiers[0].id, "");
    const late = M.addFiles([file("Alan_Turing.jpg")]);
    await tick();
    check(M.toasts.slice(seen).some(t => /Still importing the last batch/.test(t)),
      "a drop arriving while the picker is decoding is turned away too — the "
      + "picker holds importBusy across its decode, not just across the check");

    await settle(M); await late; await slow;
    eq(countOf(M), held, "…so the drop imports nobody while the dialog is decoding");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;
    const big = "data:image/jpeg;base64," + "A".repeat(M.LIMITS.photoBytes - 100);

    while(M.encodedPhotoBytes(M.state) + big.length <= M.LIMITS.totalPhotoBytes){
      const p = personIn(M, "Filler");
      p.photo = big; p.pw = 10; p.ph = 10; p.frame = {zoom:1, ox:0, oy:0};
      M.state.people.push(p);
    }
    const filled = countOf(M);
    const choice = M.choosePhoto(file("Ada.jpg"));
    await tick();
    M.decodes[0].res({data:big, w:100, h:120});
    await choice;
    M.dirtyDoc = false;
    M.setAdd({tier:tier, group:"", name:"Ada"});

    eq(await M.addOnePerson(), false, "the aggregate budget still refuses at Add");
    eq(countOf(M), filled, "…adding nobody");
    eq(M.dirtyDoc, false, "…and leaving no dirty flag");
    check(M.alerts.some(x => /Nobody was added/.test(x) && /MB limit/.test(x)),
      "…saying nobody was added, which is what happened");
    check(M.pending !== null,
      "and the photo is STILL in the well, so the refusal can be answered");
    eq(M.add.wellShown, true, "…and still on screen, so there is something to remove");

    M.addClickFact("remove");
    eq(await M.addOnePerson(), true,
      "removing it and adding again works — the way out of a budget refusal");
    eq(countOf(M), filled + 1, "…and the person is added, without a picture");
    eq(who(M, filled).photo, null, "…with no photo");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada = personIn(M, "Ada Lovelace");
    ada.photo = "A".repeat(1000000);
    const filler = personIn(M, "Filler");
    filler.photo = "A".repeat(48000000);
    M.state.people.push(ada, filler);

    eq(M.LIMITS.totalPhotoBytes, 50331648,
      "the boundary above is worked out against the shipped limit — got " + M.LIMITS.totalPhotoBytes);
    eq(M.photoBudgetExceeded(M.state, 2000000, 1000000), false,
      "a replacement fits when the old photo's bytes are subtracted first — "
      + "49,000,000 - 1,000,000 + 2,000,000 = 50,000,000, under the limit");
    eq(M.photoBudgetExceeded(M.state, 2000000, 0), true,
      "…and the identical addition refuses if removedBytes is withheld — "
      + "49,000,000 + 2,000,000 = 51,000,000, over the limit: the subtraction actually "
      + "moves the answer, it is not a no-op either call path could drop");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setPendingDirectly({result:{data:"data:image/jpeg;base64,BBBB", w:10, h:10},
                          gen:M.docGen});
    eq(M.add.wellShown, false,
      "a hand-written addPending leaves the preview hidden — the well and the "
      + "screen disagree, which is exactly what setAddPhoto exists to prevent");
    M.setAddPhoto(null);
    eq(M.pending, null, "…and the owner is what puts them back in agreement");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[1].id;

    const before = personIn(M, "Before");
    const ada    = personIn(M, "Ada Lovelace");
    const after  = personIn(M, "After");
    Object.assign(ada, {tierId:tier, groupId: M.resolveGroupId(M.state, "BER"), role:"Head of Thing",
                        photo:"data:image/jpeg;base64,AAAA", pw:400, ph:300,
                        frame:{zoom:1.6, ox:12, oy:-4}});
    M.state.people.push(before, ada, after);
    M.dirtyDoc = false;

    M.clickFact("remove", ada.id);

    eq(ada.photo, null, "Remove photo clears the photo");
    eq(ada.pw, 0, "…and the stored pixel width with it");
    eq(ada.ph, 0, "…and the height");
    eq(ada.frame, null, "…and the framing, which would otherwise be left pointing "
      + "at a picture that is gone");

    eq(ada.name, "Ada Lovelace", "the person keeps their name");
    eq(ada.tierId, tier, "…their grade");
    eq(M.groupLabel(M.state, ada), "BER", "…their group");
    eq(ada.role, "Head of Thing", "…and their role");

    const name = i => (M.state.people[i] || {}).name || "(nobody there)";
    eq(countOf(M), 3, "the person is still in the roster — this is not a delete");
    eq(M.state.people.indexOf(ada), 1, "…in the position they were in");
    eq(name(0), "Before", "…with the people around them undisturbed");
    eq(name(2), "After", "…on both sides");

    eq(M.history.length, 1, "removing a photo is exactly one history entry");
    eq(M.dirtyDoc, true, "…and marks the document dirty");

    const label = (M.history[0] || {}).label;
    check(/photo/.test(label || ""),
      "…labelled as a photo removal, so the undo entry reads — got "
        + JSON.stringify(label));

    M.undo();
    const back = M.state.people[1] || {};
    eq(back.photo, "data:image/jpeg;base64,AAAA", "undo restores the photo");
    eq(back.pw, 400, "…its width");
    eq(back.ph, 300, "…its height");
    eq(JSON.stringify(back.frame), JSON.stringify({zoom:1.6, ox:12, oy:-4}),
      "…and the framing exactly as it was, not a reset one");
    eq(countOf(M), 3, "…and takes nobody away doing it");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const bare = personIn(M, "No Picture");
    M.state.people.push(bare);
    M.dirtyDoc = false;
    M.clickFact("remove", bare.id);
    eq(bare.photo, null, "removing the photo of someone who has none leaves them without one");
    eq(bare.name, "No Picture", "…and does not touch anything else about them");
    eq(countOf(M), 1, "…and certainly does not remove the person");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const jane = personIn(M, "Jane");
    jane.tierId = M.state.tiers[0].id;
    M.state.people.push(jane);
    M.dirtyDoc = false;
    M.openEditModal(jane.id);
    eq(M.editId, jane.id, "the dialog is open on that person");
    eq(M.editFields.name.value, "Jane", "and shows the name they already have");

    const who = () => M.state.people[0] || {};

    for(const v of ["J", "Ja", "Jan", "Jane Q"]) M.typeInto("name", v);
    eq(who().name, "Jane Q", "the last keystroke is on the person immediately");
    eq(M.history.length, 1, "…and the whole burst is one history entry");
    eq(M.dirtyDoc, true, "…which marks the document dirty");

    eq(M.groupLabel(M.state, who()), "FRA", "this person starts with an group");
    for(const v of ["B", "BE", "BER"]) M.typeInto("group", v);
    eq(M.groupLabel(M.state, who()), "BER", "the group field writes to the person too");
    eq(M.history.length, 2, "…as its own entry, because a new field ends the old session");

    eq(M.state.groups.length, 1, "typing B, BE, BER leaves exactly one group — the transients were pruned");
    eq((M.state.groups[0] || {}).label, "BER",
      "…and it is labelled BER, not one of the letters typed on the way there");
    for(const v of ["H", "Head"]) M.typeInto("role", v);
    eq(who().role, "Head", "and so does the role field");
    eq(M.history.length, 3, "…again as one entry of its own");

    const second = M.state.tiers[1].id;
    M.chooseGrade(second);
    eq(who().tierId, second, "choosing a grade moves the person into it");
    eq(M.history.length, 4, "…in one more history entry — four fields, four entries");

    const labels = M.history.map(h => h.label);
    check(/renamed/.test(labels[0]) && /group/.test(labels[1])
       && /role/.test(labels[2]) && /grade/.test(labels[3]),
      "and each entry names the field it came from — got " + JSON.stringify(labels));

    let guard = 20;
    while(M.canUndo() && guard--) M.undo();
    eq(who().name, "Jane", "undoing every entry restores the name");
    eq(M.groupLabel(M.state, who()), "FRA", "…the group they had");
    eq(who().role || "", "", "…the empty role");
    eq(who().tierId, M.state.tiers[0].id, "…and the grade they started in");
    eq(M.editId, jane.id, "and none of it closed the dialog");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const p = personIn(M, "Jane");
    M.state.people.push(p);
    M.openEditModal(p.id);
    for(const v of ["J", "Ja", "Jan", "Jane Q"]) M.typeInto("name", v);
    eq((M.state.people[0] || {}).name, "Jane Q", "four keystrokes, all applied");
    M.undo();
    eq((M.state.people[0] || {}).name, "Jane",
      "one undo puts the whole burst back, not one letter of it");
    eq(M.canUndo(), false, "…and there was only ever one step to undo");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const jane = personIn(M, "Jane");
    const bob  = personIn(M, "Bob");
    M.state.people.push(jane, bob);

    M.openEditModal(jane.id);
    for(const v of ["B", "BE", "BER"]) M.typeInto("group", v);
    M.endEdit();
    const janeGroupId = M.state.people[0].groupId;
    eq(M.groupLabel(M.state, M.state.people[0]), "BER", "Jane's group is BER");

    M.openEditModal(bob.id);
    for(const v of ["b", "be", "ber"]) M.typeInto("group", v);
    M.endEdit();
    const bobGroupId = M.state.people[1].groupId;

    eq(M.groupLabel(M.state, M.state.people[1]), "BER",
      "Bob's lowercase \"ber\" reads back as the same label Jane's typing produced");
    eq(bobGroupId, janeGroupId,
      "…because it is literally the same group, matched case-insensitively — not a second one");
    eq(M.state.groups.length, 1,
      "one group total, not two — got " + JSON.stringify(M.state.groups));
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const solo = personIn(M, "Solo");
    M.state.people.push(solo);
    eq(M.state.groups.length, 1, "personIn's FRA group exists, held by its one member");
    eq(M.groupLabel(M.state, solo), "FRA", "…and reads back as FRA");

    M.commit("removed the only member", () => {
      M.state.people = M.state.people.filter(p => p.id !== solo.id);
    });
    eq(M.state.people.length, 0, "the person is gone");
    eq(M.state.groups.length, 0,
      "…and the group they were the only member of is pruned with them — got "
      + JSON.stringify(M.state.groups));

    M.undo();
    eq(M.state.people.length, 1, "undo restores the person");
    eq(M.state.groups.length, 1, "…and the group they belonged to comes back with them");
    eq(M.groupLabel(M.state, M.state.people[0]), "FRA",
      "…still reading back as FRA, the same label it had before the commit");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada = personIn(M, "Ada Lovelace");
    Object.assign(ada, {tierId:M.state.tiers[1].id, groupId: M.resolveGroupId(M.state, "BER"),
                        role:"Head of Thing",
                        photo:"data:image/jpeg;base64,AAAA", pw:400, ph:300,
                        frame:{zoom:1.6, ox:12, oy:-4}});
    M.state.people.push(ada);
    M.openEditModal(ada.id);

    const withPhoto = M.photoSection();
    check(withPhoto.verbs.indexOf("fact:pan") >= 0
       && withPhoto.verbs.indexOf("fact:remove") >= 0,
      "the section opens as the framing editor — got " + JSON.stringify(withPhoto.verbs));
    check(withPhoto.verbs.indexOf("act:photo") < 0,
      "…with no Add photo in it, because there is already one to work on");

    M.clickFact("remove", ada.id);

    eq(M.editId, ada.id, "removing the photo does not close the dialog");
    eq(ada.name, "Ada Lovelace", "the person keeps their name");
    eq(ada.tierId, M.state.tiers[1].id, "…their grade");
    eq(M.groupLabel(M.state, ada), "BER", "…their group");
    eq(ada.role, "Head of Thing", "…and their role");
    eq(countOf(M), 1, "and they are still in the roster — this is not a delete");

    const without = M.photoSection();
    eq(without.verbs.filter(v => v.indexOf("fact:") === 0).length, 0,
      "the framing editor is gone — got " + JSON.stringify(without.verbs));
    eq(without.verbs.filter(v => v === "act:photo").length, 2,
      "…replaced by the two ways to add a photo back — the placeholder circle "
      + "itself and the button beneath it, the same verb on both");
    check(/AL/.test(without.text),
      "…beside the initials, which is what the chart draws for them now — got "
        + JSON.stringify(without.text));

    eq(M.editFields.name.value, "Ada Lovelace", "the name field is untouched by the swap");
    eq(M.editFields.group.value, "BER", "…and so is the group field");

    M.undo();
    const back = M.state.people[0] || {};
    eq(back.photo, "data:image/jpeg;base64,AAAA", "undo restores the photo");
    const again = M.photoSection();
    check(again.verbs.indexOf("fact:pan") >= 0,
      "…and the section is the framing editor again — got " + JSON.stringify(again.verbs));
  }

  {
    function afterRemoval(via){
      const M = makeModule();
      M.state = M.defaults();
      M.state.tiers = sixGrades();
      const t = M.state.tiers[0].id;
      const before = personIn(M, "Before"); before.tierId = t;
      const jane   = personIn(M, "Jane Doe"); jane.tierId = t;
      const after  = personIn(M, "After");  after.tierId = t;
      M.state.people.push(before, jane, after);
      M.dirtyDoc = false;
      if(via === "menu"){
        M.openMenuOn(jane.id);
        M.clickMenu("del", jane.id);
      }else{
        M.openEditModal(jane.id);
        M.clickRemovePerson();
      }
      return {M: M,
              names: M.state.people.map(p => p.name),
              label: (M.history[0] || {}).label,
              entries: M.history.length,
              toast: M.toasts[M.toasts.length - 1],
              dirty: M.dirtyDoc,
              editId: M.editId};
    }
    const viaMenu   = afterRemoval("menu");
    const viaDialog = afterRemoval("dialog");

    eq(JSON.stringify(viaMenu.names), JSON.stringify(["Before", "After"]),
      "the menu's Remove takes that person out and leaves the others in order");
    eq(JSON.stringify(viaDialog.names), JSON.stringify(viaMenu.names),
      "…and the dialog's Remove person leaves exactly the same roster");
    eq(viaDialog.label, viaMenu.label,
      "…the same history entry — menu says " + JSON.stringify(viaMenu.label)
        + ", dialog says " + JSON.stringify(viaDialog.label));
    check(/^removed Jane/.test(viaMenu.label || ""),
      "…and that entry names the person — got " + JSON.stringify(viaMenu.label));
    eq(viaDialog.entries, 1, "one entry, not two");
    eq(viaMenu.entries, 1, "from either route");
    eq(viaDialog.toast, viaMenu.toast,
      "…and the same toast — got " + JSON.stringify([viaMenu.toast, viaDialog.toast]));
    eq(viaDialog.dirty, true, "either route marks the document dirty");

    eq(viaDialog.editId, null, "removing from the dialog closes it — it was editing nobody");
    viaMenu.M.undo();
    eq(viaMenu.M.state.people.length, 3, "and one undo brings the person back");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const T = M.state.tiers.map(t => t.id);
    const mk = (name, tier) => { const p = personIn(M, name); p.tierId = tier; return p; };
    const ana = mk("Ana", T[0]), bo = mk("Bo", T[0]), cy = mk("Cy", T[1]);
    M.state.people.push(ana, bo, cy);
    const order = () => M.state.people.map(p => p.name + "@" + T.indexOf(p.tierId));

    M.openMenuOn(ana.id);
    M.clickMenu("down", ana.id);
    eq(JSON.stringify(order()), JSON.stringify(["Bo@0", "Ana@0", "Cy@1"]),
      "Move down swaps two people inside their grade");
    eq((M.history[0] || {}).label, "moved Ana",
      "…and says only that, because nothing else about them changed");

    M.clickMenu("down", ana.id);
    eq(JSON.stringify(order()), JSON.stringify(["Bo@0", "Ana@1", "Cy@1"]),
      "Move down off the end of a grade moves the person into the next grade");
    eq((M.history[1] || {}).label, "moved Ana to " + M.gradeName(M.state.tiers[1]),
      "…and the entry names the grade they left for, resolved before the move");

    M.clickMenu("up", ana.id);
    eq(JSON.stringify(order()), JSON.stringify(["Bo@0", "Ana@0", "Cy@1"]),
      "Move up carries them back across the boundary");
    eq((M.history[2] || {}).label, "moved Ana to " + M.gradeName(M.state.tiers[0]),
      "…naming the grade on the other side");

    const entries = M.history.length;
    M.clickMenu("up", M.state.people[0].id);
    eq(JSON.stringify(order()), JSON.stringify(["Bo@0", "Ana@0", "Cy@1"]),
      "Move up on the first person in the first grade changes nothing");
    eq(M.history.length, entries + 1,
      "…though the press still records one, exactly as the row's disabled "
      + "button never let it get that far — the guard is on the control, not here");

    M.undo(); M.undo(); M.undo(); M.undo();
    eq(JSON.stringify(order()), JSON.stringify(["Ana@0", "Bo@0", "Cy@1"]),
      "and undo walks every one of those moves back");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, "Original Person"));

    M.snapshot("removed someone");
    M.state.people = [];
    eq(M.canUndo(), true, "there is something to undo before opening another file");

    M.dirtyDoc = false;
    M.setConfirm(true);
    await M.newDoc();
    eq(M.history.length, 0, "New clears the undo history");
    eq(M.canUndo(), false, "nothing to undo in a brand-new document");
    M.undo();
    eq(countOf(M), 0, "an undo in the new document cannot pull in the old one's people");

    M.snapshot("x");
    M.resetPerRoster();
    eq(M.history.length, 0, "resetPerRoster clears history");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.dirtyDoc = true;

    M.setConfirm(false);
    await M.openDoc();
    eq(M.picked, 0, "Open cancelled: the file picker never opens");

    M.setConfirm(true);
    await M.openDoc();
    eq(M.picked, 1, "Open confirmed: the file picker opens");
  }

  {
    const M = makeModule();
    const d = M.defaults();
    eq(d.layout, "pyramid", "a new document is a pyramid");
    for(const k of ["title","brand","accent","inkOnColour","inkOnWhite","bg","ring",
                    "page","density","angle","layout","showGradeCode",
                    "showGradeName","nameLabelPosition","showPersonName",
                    "showPersonGrade","showPersonGroup","tiers","people","groups"]){
      check(Object.prototype.hasOwnProperty.call(d, k),
        "defaults() states " + k + " itself rather than leaving it to be filled in");
    }
    check(d.tiers.every(t => t.role === undefined),
      "and no default grade carries a title of its own");

    check(Array.isArray(d.groups) && d.groups.length === 0,
      "a new document starts with no groups either — got " + JSON.stringify(d.groups));
    check(typeof M.migrate === "undefined",
      "migrate() is not merely unused but gone — a dead upgrade path is a trap");
  }

  {
    const M = makeModule();

    {
      const F = makeModule();
      F.state = F.defaults();
      F.state.tiers = sixGrades();
      F.state.angle = 4;
      F.state.tiers[1].attach = true;
      F.state.tiers[2].merge = true; F.state.tiers[2].attach = true;
      const before = JSON.stringify({tiers:F.state.tiers, angle:F.state.angle});
      const steps = F.history.length;

      F.commit("changed the layout", () => { F.state.layout = "swimlanes"; }, {render:"chart"});
      eq(F.state.layout, "swimlanes", "the layout changed");
      eq(F.dirtyDoc, true, "and the document is dirty");
      eq(F.history.length, steps + 1, "one undo step, not two");
      eq(JSON.stringify({tiers:F.state.tiers, angle:F.state.angle}), before,
         "and nothing else about the document moved — angle, attach and share are untouched");

      F.undo();
      eq(F.state.layout, "pyramid", "undo goes back to the pyramid");
      eq(JSON.stringify({tiers:F.state.tiers, angle:F.state.angle}), before,
         "with the angle and the grade links exactly as they were");
      F.redo();
      eq(F.state.layout, "swimlanes", "redo returns to swimlanes");
      eq(F.state.angle, 4, "and the angle is still stored while lanes are drawn");
      F.undo();
      eq(F.state.angle, 4, "switching back finds the angle the user last chose");
    }

    {
      const F = makeModule();
      F.state = F.defaults();
      F.state.tiers = sixGrades();
      eq(F.state.nameBold, "given", "a new document bolds given names");
      const steps = F.history.length;

      F.commit("changed the name bolding", () => { F.state.nameBold = "family"; }, {render:"chart"});
      eq(F.state.nameBold, "family", "the setting changed");
      eq(F.dirtyDoc, true, "and the document is dirty");
      eq(F.history.length, steps + 1, "one undo step, not two");

      F.undo();
      eq(F.state.nameBold, "given", "undo restores the given-name-bold default");
      F.redo();
      eq(F.state.nameBold, "family", "redo returns to family-name-bold");
    }

    {
      const F = makeModule();
      F.state = F.defaults();
      F.state.tiers = sixGrades();
      F.commit("changed the layout", () => { F.state.layout = "swimlanes"; }, {render:"chart"});
      F.setPrompt("lanes");
      await F.saveDoc(false);
      const written = JSON.parse((F.written[F.written.length - 1] || {}).text || "{}");
      eq(written.layout, "swimlanes", "a swimlanes roster is saved as swimlanes");
    }

    const st = M.defaults();
    st.tiers = sixGrades();
    eq(M.stateLimitProblem(st), null, "a pyramid document is saveable");
    st.layout = "swimlanes";
    eq(M.stateLimitProblem(st), null, "and so is a swimlanes document");
    st.layout = "mind-map";
    check(/layout/.test(M.stateLimitProblem(st) || ""),
          "Save refuses a document whose layout this build cannot draw");
    delete st.layout;
    eq(M.stateLimitProblem(st), null,
       "but a document with no layout at all is not a limit violation — it is a pyramid");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    M.commit("added someone", () => { M.state.people.push(personIn(M, "One")); });
    eq(countOf(M), 1, "commit applies the mutation");
    eq(M.history.length, 1, "commit records exactly one history entry");
    eq(M.dirtyDoc, true, "commit marks the document dirty");
    check(M.canUndo(), "commit leaves something to undo");

    M.commit("added another", () => { M.state.people.push(personIn(M, "Two")); });
    eq(countOf(M), 2, "a second commit applies");
    eq(M.history.length, 2, "a second commit records a second entry");

    M.undo();
    eq(countOf(M), 1, "undo removes the second person");
    M.undo();
    eq(countOf(M), 0, "undo removes the first person");
    check(!M.canUndo(), "there is nothing left to undo");
    M.redo();
    eq(countOf(M), 1, "redo puts the first person back");
    M.redo();
    eq(countOf(M), 2, "redo puts the second person back");
    check(!M.canRedo(), "there is nothing left to redo");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, ""));
    const p = M.state.people[0];

    const before = M.history.length;
    for(const ch of ["J","Ja","Jan","Jane"]){
      M.edit("name:" + p.id, "renamed", () => { p.name = ch; });
    }
    eq(p.name, "Jane", "every keystroke in a session is applied");
    eq(M.history.length - before, 1, "four keystrokes make one history entry, not four");

    {
      const steps = M.history.length, idx = M.hIndex, open = M.session;
      const name = p.name;
      for(let i = 0; i < 4; i++) M.syncRowIdentity(p);
      eq(M.history.length, steps, "relabelling adds no history entry, however often it runs");
      eq(M.hIndex, idx, "and does not move the undo position");
      eq(p.name, name, "it changes nothing about the person");
      check(M.session === open, "nor does it disturb the typing session it runs inside");

      const F = makeModule();
      F.state = F.defaults();
      F.state.tiers = sixGrades();
      F.state.people.push(personIn(F, "Ada"));
      check(F.historyPending === false && F.dirtyDoc === false, "a fresh document starts clean");
      F.syncRowIdentity(F.state.people[0]);
      eq(F.historyPending, false, "relabelling does not open an uncommitted change");
      eq(F.dirtyDoc, false, "nor mark the document as having unsaved work");
      eq(F.history.length, 0, "and records nothing to undo");
    }

    eq(M.history.length - before, 1, "a rename is one history entry, not two");

    M.undo();
    eq(M.state.people[0].name, "", "undo restores the value from before the session, not one character");

    M.redo();
    M.edit("group:" + p.id, "group", () => { M.state.people[0].groupId = "HAM"; });
    eq(M.history.length, 2, "a different field opens its own session");

    M.endEdit();
    M.edit("group:" + p.id, "group again", () => { M.state.people[0].groupId = "BER"; });
    eq(M.history.length, 3, "editing the same field after a pause is a new step");
    M.undo();
    eq(M.state.people[0].groupId, "HAM", "the second group edit undoes on its own");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    const before = M.history.length;
    for(const ch of ["O","Of","Off","Office"]){
      M.edit("groupsLabel", "changed the group-axis label", () => { M.state.groupsLabel = ch; });
    }
    eq(M.state.groupsLabel, "Office", "every keystroke in the session is applied");
    eq(M.history.length - before, 1, "four keystrokes make one history entry, not four");

    M.undo();
    eq(M.state.groupsLabel, "", "undo restores the value from before the session, not one character");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, ""));
    const p = M.state.people[0];

    M.edit("name:" + p.id, "renamed", () => { p.name = "Jane"; });
    check(M.session !== null, "a session is open while typing");
    M.commit("added a grade", () => { M.state.tiers.push({id:"zz", code:"Z", label:"Zed",
      role:"Zed", fill:"green", attach:false, merge:false, align:"center"}); });
    check(M.session === null, "a commit closes the open typing session");

    eq(M.state.tiers.length, 7, "the grade was added");
    M.undo();
    eq(M.state.tiers.length, 6, "undo removes the grade");
    eq(M.state.people[0].name, "Jane", "and leaves the typed name alone");
    M.undo();
    eq(M.state.people[0].name, "", "the next undo reaches the name");
    M.redo();
    eq(M.state.people[0].name, "Jane", "redo restores the name");
    M.redo();
    eq(M.state.tiers.length, 7, "redo restores the grade");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.commit("one",   () => { M.state.people.push(personIn(M, "One")); });
    M.commit("two",   () => { M.state.people.push(personIn(M, "Two")); });
    M.undo();
    check(M.canRedo(), "there is a redo branch after undoing");
    M.commit("three", () => { M.state.people.push(personIn(M, "Three")); });
    check(!M.canRedo(), "a new change discards the redo branch");
    eq(countOf(M), 2, "the new change built on the undone state");
    eq(M.state.people[1].name, "Three", "and it is the new person, not the discarded one");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setPrompt("roster");
    await M.saveDoc(true);
    eq(M.dirtyDoc, false, "saving clears the dirty flag");
    M.commit("added someone", () => { M.state.people.push(personIn(M, "One")); });
    eq(M.dirtyDoc, true, "an edit after saving marks it dirty again");
    M.undo();
    eq(M.dirtyDoc, true, "undoing back to the saved content still reads as unsaved");

    M.updateDocLabel();
    eq(M.shown.unsaved, true, "and the status icon still shows unsaved, following the flag");
    eq(M.shown.status, "Unsaved changes", "with the status name to match");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const start = M.state.accent;
    M.setColourFields(start, start);

    const renders = M.history.length;
    M.typeHex("#123456");
    eq(M.state.accent, "#123456", "a valid hex typed into the field sets state.accent");
    eq(M.colour.picker, "#123456", "…and the picker moves to it, so the two halves agree");
    check(M.summaries > 0, "…and the ribbon summary refreshes, which is what repaints the swatch");
    eq(M.history.length - renders, 1, "…as one history entry");

    M.endEdit();
    M.typeHex("046a38");
    eq(M.state.accent, "#046A38",
      "a value typed without the leading # is accepted, and stored as upper-case #RRGGBB");
    eq(M.colour.picker, "#046A38", "…and the picker takes the normalised form too");

    eq(M.colour.hex, "046a38", "the field is NOT rewritten while it is being typed in");
    M.hexBlur();
    eq(M.colour.hex, "#046A38", "leaving the field shows the normalised value");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const start = M.state.accent;
    M.setColourFields(start, start);
    const steps = M.history.length;

    for(const bad of ["", "#", "#0", "#04", "#046", "#046A", "#046A3",
                      "046A3", "#046A3G", "green", "#0123456", "rgb(0,0,0)",
                      "#046A38;--brand:red"]){
      M.typeHex(bad);
      eq(M.state.accent, start, JSON.stringify(bad) + " does not reach state.accent");
    }
    eq(M.history.length, steps,
      "and none of them took a snapshot — an unusable value is not an undo step");
    eq(M.dirtyDoc, false, "nor marked the document dirty");
    eq(M.colour.picker, start, "nor moved the picker");

    eq(M.hexFieldValue("046a38"), "#046A38", "hexFieldValue normalises through validColour");
    eq(M.hexFieldValue("#046A3"), null, "…and answers null for anything validColour refuses");
    eq(M.hexFieldValue("  #046a38  "), "#046A38", "…trimming exactly as validColour does");
    eq(M.validColour("#046a38", null), "#046A38",
      "validColour itself is unchanged — the field adds the optional #, nothing else");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setColourFields(M.state.accent, M.state.accent);
    M.accentPick("#abcdef");
    eq(M.state.accent, "#abcdef", "the picker still writes state.accent");
    eq(M.colour.hex, "#abcdef", "…and the field follows it, so it never shows a stale colour");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const start = M.state.accent;
    M.setColourFields(start, start);
    const steps = M.history.length;

    for(const partial of ["#", "#1", "#12", "#123", "#1234", "#12345", "#123456"]){
      M.typeHex(partial);
    }
    eq(M.state.accent, "#123456", "typing a hex one character at a time arrives at the value");
    eq(M.history.length - steps, 1,
      "…and costs exactly one history entry, not one per keystroke");

    M.undo();
    eq(M.state.accent, start, "one undo restores the previous accent in a single step");
    M.redo();
    eq(M.state.accent, "#123456", "and redo puts the typed one back");

    const M2 = makeModule();
    M2.state = M2.defaults();
    M2.state.tiers = sixGrades();
    const was = M2.state.accent;
    M2.setColourFields(was, was);
    const s2 = M2.history.length;
    M2.typeHex("#123456");
    M2.accentPick("#654321");
    eq(M2.history.length - s2, 1,
      "typing then dragging is still one change — both halves edit under the same key");
    M2.undo();
    eq(M2.state.accent, was, "…and one undo restores what was there before either");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.inkOnColour = "#FFFFFF";
    M.setColourFields(M.state.accent, M.state.accent);

    M.typeHex("#FFFF00");
    check(M.warn.shown, "a low-contrast accent typed into the field raises the warning");
    check(/on the accent/.test(M.warn.text), "…naming the pair that is hard to read");
    check(/is below the recommended 4\.5:1 contrast/.test(M.warn.text),
      "…and states the shortfall in the redesigned wording, threshold spelled out as a literal here");
    check(M.warn.badge, "…and the badge on the Text command appears with it");
    check(M.contrastRatio("#FFFF00", "#FFFFFF") < M.CONTRAST_MIN,
      "…because the shipped ratio really is below the shipped threshold");

    M.endEdit();
    M.typeHex("#1A2129");
    check(!M.warn.shown, "and a readable one clears it again");
    check(!M.warn.badge, "…badge included");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setColourFields(M.state.accent, M.state.accent);
    const before = JSON.parse(JSON.stringify(M.state));

    M.typeHex("#FF00FF");
    const after = M.state;
    const changed = Object.keys(after).filter(k =>
      JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    eq(changed.join(","), "accent",
      "typing a hex changes state.accent and nothing else — got: " + changed.join(","));
    check(!("brand" in after) || after.brand === before.brand,
      "the header's brand text is untouched — a different field with a similar name");
  }

  const SWATCHES = (function(){
    const out = [];
    const re = /<button class="accent-swatch"[^>]*data-accent="(#[0-9A-Fa-f]{6})"[^>]*data-ink="(#[0-9A-Fa-f]{6})"[^>]*>[\s\S]*?<\/span>([^<]+)<\/button>/g;
    let m;
    while((m = re.exec(HTML))) out.push([m[1], m[2], m[3].trim()]);
    return out;
  })();
  eq(SWATCHES.length, 8, "the Accent menu ships eight swatches");

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const start = M.state.accent, startInk = M.state.inkOnColour;
    M.setColourFields(start, start, startInk);

    const steps = M.history.length;
    M.clickSwatch("#FF4F00", "#000000", "International Orange");
    eq(M.state.accent, "#FF4F00", "a swatch sets state.accent");
    eq(M.state.inkOnColour, "#000000", "…and the ink that has to go on it");
    eq(M.history.length - steps, 1,
      "…as ONE history entry covering both — two would leave a step showing one "
      + "colour wearing the other colour's ink");

    M.undo();
    eq(M.state.accent, start, "one undo restores the previous accent");
    eq(M.state.inkOnColour, startInk, "…and the previous ink, in the same step");
    M.redo();
    eq(M.state.accent, "#FF4F00", "redo puts the colour back");
    eq(M.state.inkOnColour, "#000000", "…and the ink with it");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setColourFields(M.state.accent, M.state.accent, M.state.inkOnColour);
    const before = M.summaries;
    M.clickSwatch("#602F6B", "#FFFFFF", "Imperial Purple");
    eq(M.colour.picker, "#602F6B", "the OS picker moves to the swatch's colour");
    eq(M.colour.hex, "#602F6B", "…the hex field shows it");
    eq(M.colour.ink, "#FFFFFF", "…and the Text editor's On accent well shows the ink");
    check(M.summaries > before,
      "…and the ribbon summary refreshes, which is what repaints the face's swatch");
  }

  {

    const M = makeModule();
    for(const s of SWATCHES){
      M.state = M.defaults();
      M.state.tiers = sixGrades();
      M.setColourFields(M.state.accent, M.state.accent, M.state.inkOnColour);
      M.clickSwatch(s[0], s[1], s[2]);
      eq(M.state.accent, s[0], s[2] + " applies " + s[0]);
      eq(M.state.inkOnColour, s[1], "…with " + s[1] + " on it");
      check(!M.warn.shown, s[2] + " raises no contrast warning");
      check(!M.warn.badge, "…nor the badge on the Text command");
      check(M.contrastRatio(s[0], s[1]) >= M.CONTRAST_MIN,
        "…because the shipped ratio really is at or above the shipped threshold — "
        + M.contrastRatio(s[0], s[1]).toFixed(2) + ":1");
    }

    const wrong = SWATCHES.filter(s =>
      M.contrastRatio(s[0], s[1] === "#000000" ? "#FFFFFF" : "#000000") < M.CONTRAST_MIN);
    eq(wrong.length, 8,
      "all eight would fail with the other ink, which is why a swatch writes both");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.inkOnColour = "#123456";
    M.setColourFields(M.state.accent, M.state.accent, M.state.inkOnColour);
    M.typeHex("#FF4F00");
    eq(M.state.accent, "#FF4F00", "typing a hex sets the accent");
    eq(M.state.inkOnColour, "#123456", "…and leaves state.inkOnColour exactly where it was");
    eq(M.colour.ink, "#123456", "…so the Text editor's well is untouched as well");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.setColourFields(M.state.accent, M.state.accent, M.state.inkOnColour);
    const steps = M.history.length;
    M.clickSwatch("#003153", "#FFFFFF", "Prussian Blue");
    M.clickSwatch("#801818", "#FFFFFF", "Falu Red");
    eq(M.history.length - steps, 2, "two swatches are two undo steps");
    M.undo();
    eq(M.state.accent, "#003153", "…so one undo goes back to the first, not past both");

    const M2 = makeModule();
    M2.state = M2.defaults();
    M2.state.tiers = sixGrades();
    M2.setColourFields(M2.state.accent, M2.state.accent, M2.state.inkOnColour);
    const s2 = M2.history.length;
    M2.typeHex("#123456");
    M2.clickSwatch("#FADA5E", "#000000", "Naples Yellow");
    eq(M2.history.length - s2, 2,
      "a swatch after a typed value is a second step — commit() closes the open "
      + "session rather than joining it");
    M2.undo();
    eq(M2.state.accent, "#123456", "…and one undo returns to what was typed");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const start = M.state.accent, startInk = M.state.inkOnColour;
    M.setColourFields(start, start, startInk);
    const steps = M.history.length;
    for(const pair of [["", "#FFFFFF"], ["#FF4F00", ""], ["red", "#FFFFFF"],
                       ["#FF4F0", "#FFFFFF"], ["#FF4F00", "black"]]){
      M.clickSwatch(pair[0], pair[1], "broken");
    }
    eq(M.state.accent, start, "an unusable pair reaches neither field");
    eq(M.state.inkOnColour, startInk, "…including the half of it that was fine");
    eq(M.history.length, steps, "…and takes no snapshot");
    eq(M.dirtyDoc, false, "…nor marks the document dirty");
  }

  {
    const M = makeModule();
    const links = () => M.state.tiers.map(t => (t.attach ? "A" : "-") + (t.merge ? "S" : "-"));
    const set = (i, act, on) => {
      const t = M.state.tiers[i];
      M.commit(act + " " + t.label, () => {
        if(act === "attach"){ t.attach = on; if(!on) t.merge = false; }
        else t.merge = on;
        M.normalizeGradeLinks(M.state.tiers);
      });
    };

    M.state = M.defaults();
    M.state.tiers = sixGrades();

    eq(M.state.tiers[0].attach, false, "the first grade never attaches");
    eq(M.state.tiers[0].merge,  false, "and never shares");
    const a = M.state.tiers.findIndex(t => t.code === "A");
    eq(M.state.tiers[a].merge,  false, "defaults: A keeps its own band below P");
    eq(M.state.tiers[a].attach, true,  "and defaults: A attaches that band to P");
    const c = M.state.tiers.findIndex(t => t.code === "C");
    eq(M.state.tiers[c].merge,  true,  "defaults: C shares SC's band");
    eq(M.state.tiers[c].attach, true,  "and the rule gives shared C attach to match");

    const i = M.state.tiers.findIndex(t => t.code === "D");
    M.state.tiers[i].attach = false; M.state.tiers[i].merge = false;

    set(i, "attach", true);
    eq(links()[i], "A-", "Attach on: attach only, share untouched");

    set(i, "merge", true);
    eq(links()[i], "AS", "Share on: sets share AND attach");
    const stepsAfterShare = M.hIndex;

    set(i, "merge", false);
    eq(links()[i], "A-", "Share off: clears share, LEAVES attach");

    set(i, "merge", true);
    set(i, "attach", false);
    eq(links()[i], "--", "Attach off: clears attach AND share");

    M.undo();
    eq(links()[i], "AS", "undo restores both flags in one step");
    M.redo();
    eq(links()[i], "--", "and redo takes both away again");

    {
      const F = makeModule();
      F.state = F.defaults();
      F.state.tiers = sixGrades();
      const j = 3;
      F.state.tiers[j].attach = false; F.state.tiers[j].merge = false;
      const before = F.hIndex;
      F.commit("share", () => {
        F.state.tiers[j].merge = true;
        F.normalizeGradeLinks(F.state.tiers);
      });
      eq(F.hIndex, before + 1, "sharing from a detached grade is a single history entry");
      eq(F.state.tiers[j].attach, true,  "and it lands attached");
      eq(F.state.tiers[j].merge,  true,  "and shared");
      F.undo();
      eq(F.state.tiers[j].attach, false, "one undo puts attach back");
      eq(F.state.tiers[j].merge,  false, "and share with it");
    }

    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const share = M.state.tiers.findIndex(t => t.merge);
    check(share > 1, "the shared grade starts below the top");

    for(let k = share; k > 0; k--){
      const j = k;
      M.commit("moved", () => {
        const t = M.state.tiers.splice(j, 1)[0];
        M.state.tiers.splice(j - 1, 0, t);
        M.normalizeGradeLinks(M.state.tiers);
      });
    }
    eq(links()[0], "--", "a grade moved to the top loses attach and share");

    check(M.state.tiers.length > 1, "there is still a grade below it");
    eq(typeof M.state.tiers[1].merge, "boolean", "the grade below keeps a well-formed share flag");

    {
      const F = makeModule();
      F.state = F.defaults();
      F.state.tiers = sixGrades();
      const original = F.state.tiers.map(t => t.id);
      const firstId = original[0], lastId = original[original.length - 1];
      const person = personIn(F, "Stays Assigned");
      person.tierId = lastId;
      F.state.people.push(person);
      const before = F.hIndex;
      eq(F.reorderGrade(lastId, firstId, false), true,
        "dropping the last grade before the first performs a move");
      eq(F.hIndex, before + 1, "the drag is exactly one history entry");
      eq(F.state.tiers[0].id, lastId, "the dropped grade lands in the requested slot");
      eq(F.state.tiers[0].attach, false, "a grade dragged to the top loses attach");
      eq(F.state.tiers[0].merge, false, "and loses share");
      eq(F.state.people[0].tierId, lastId,
        "people stay assigned by grade id while their grade moves");
      F.undo();
      eq(F.state.tiers.map(t => t.id).join(","), original.join(","),
        "one undo restores the complete original grade order");
      F.redo();
      eq(F.state.tiers[0].id, lastId, "and redo reapplies the drag");

      const secondId = F.state.tiers[1].id;
      const noOpHistory = F.hIndex;
      eq(F.reorderGrade(secondId, lastId, true), false,
        "dropping a grade back into its current slot is a no-op");
      eq(F.hIndex, noOpHistory, "a no-op drop creates no undo entry");
      eq(F.reorderGrade("missing", lastId, false), false,
        "a stale dragged id cannot reorder the document");
    }

    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.tiers[1].attach = true; M.state.tiers[1].merge = true;
    M.commit("removed", () => {
      M.state.tiers.splice(0, 1);
      M.normalizeGradeLinks(M.state.tiers);
    });
    eq(links()[0], "--", "deleting the top grade clears the promoted grade's flags");

    const twice = M.defaults();
    M.normalizeGradeLinks(twice.tiers);
    const once = JSON.stringify(twice.tiers);
    M.normalizeGradeLinks(twice.tiers);
    eq(JSON.stringify(twice.tiers), once, "normalizeGradeLinks is idempotent");
    check(stepsAfterShare >= 0, "the history advanced through these transitions");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    const A = "data:image/jpeg;base64,AAAA";
    const B = "data:image/jpeg;base64,BBBB";

    const p1 = personIn(M, "Shared One"); p1.photo = A; p1.pw = 400; p1.ph = 300;
    const p2 = personIn(M, "Shared Two"); p2.photo = A; p2.pw = 400; p2.ph = 300;
    const p3 = personIn(M, "Other");      p3.photo = B; p3.pw = 400; p3.ph = 300;
    M.state.people.push(p1, p2, p3);

    for(let i = 0; i < 20; i++){
      M.commit("edit " + i, () => { M.state.title = "Title " + i; });
    }

    eq(M.history.length, 15, "history is capped at HISTORY_MAX steps");
    eq(M.photoStore.size, 2,
       "twenty steps over three photos hold two entries — one per distinct image");

    eq(M.state.people[0].photo, A, "the live state keeps the actual data URL");
    check(M.state.people[0].photoId === undefined,
          "the live state carries no store id — that is a history-only concept");

    M.state.showGradeCode = false;
    M.state.showGradeName = true;
    M.state.nameLabelPosition = "next";
    M.state.showPersonName = false;
    M.state.showPersonGrade = false;
    M.state.showPersonGroup = true;
    const packed = M.packState(M.state);
    check(packed.people.every(p => p.photo === null), "a packed entry holds no photo bytes");
    check(packed.people.every(p => typeof p.photoId === "string"), "a packed entry holds ids");
    eq(packed.people[0].photoId, packed.people[1].photoId,
       "two people with the same picture share one id");
    check(packed.people[0].photoId !== packed.people[2].photoId,
       "a different picture gets a different id");

    const back = M.unpackState(packed);
    eq(back.people[0].photo, A, "unpacking restores the first photo");
    eq(back.people[1].photo, A, "unpacking restores the shared photo");
    eq(back.people[2].photo, B, "unpacking restores the other photo");
    check(back.people.every(p => p.photoId === undefined),
       "unpacking leaves no store id behind in live state");
    eq(JSON.stringify(back), JSON.stringify(M.state), "pack/unpack is a lossless round trip");

    M.commit("removed a photo", () => {
      M.state.people[2].photo = null; M.state.people[2].pw = 0;
      M.state.people[2].ph = 0; M.state.people[2].frame = null;
    });
    eq(M.state.people[2].photo, null, "the photo was removed");
    M.undo();
    eq(M.state.people[2].photo, B, "undo restores the actual photo bytes, not just an id");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const p = personIn(M, "Serial"); p.photo = "data:image/jpeg;base64,AAAA";
    p.pw = 10; p.ph = 10;
    M.state.people.push(p);

    for(let i = 0; i < 25; i++){
      M.commit("replaced " + i, () => { M.state.people[0].photo = "data:image/jpeg;base64,X" + i; });
    }
    check(M.photoStore.size <= 17,
      "evicted history steps release their photos — store holds " + M.photoStore.size
      + ", expected no more than the 15-step history plus a little slack");

    M.resetPerRoster();
    eq(M.photoStore.size, 0, "a new document starts with an empty photo store");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    M.dirtyDoc = false;
    const before = M.asked.length;
    eq(await M.confirmDiscard("do a thing"), true, "a clean document is not interrupted");
    eq(M.asked.length, before, "and raises no dialog at all");

    M.dirtyDoc = true;
    M.setConfirm(false);
    eq(await M.confirmDiscard("open another roster"), false, "a dirty document asks, and No means No");
    const q = M.asked[M.asked.length - 1] || {};
    eq(q.kind, "confirm", "it is a confirm dialog");
    check(/unsaved/i.test(q.title || ""), "the dialog says what it is about — got " + JSON.stringify(q.title));
    check((q.message || []).join(" ").indexOf("open another roster") >= 0,
      "the message names the action that would lose the work");
    check(q.label && q.label !== "OK",
      'the confirming button has a real verb, not "OK" — got ' + JSON.stringify(q.label));

    M.setConfirm(false);
    M.state.people.push(personIn(M, "Still Here"));
    const n = countOf(M);
    await M.newDoc();
    eq(countOf(M), n, "a refused New leaves the roster alone");
    const picked = M.picked;
    await M.openDoc();
    eq(M.picked, picked, "a refused Open never reaches the file picker");

    M.setConfirm(true);
    await M.openDoc();
    eq(M.picked, picked + 1, "a confirmed Open opens the picker");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.docName = "keep-me"; M.dirtyDoc = true;

    M.setPrompt(null);
    eq(await M.saveDoc(true), false, "a cancelled Save As reports that it did not save");
    eq(M.downloads.length, 0, "and writes no file");
    eq(M.docName, "keep-me", "and leaves the document name alone");
    eq(M.dirtyDoc, true, "and leaves the work marked unsaved");

    const q = M.asked[M.asked.length - 1] || {};
    eq(q.kind, "text", "Save As raises a text dialog");
    eq(q.value, "keep-me", "pre-filled with the current name");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id);

    const run = M.addFiles([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg")]);
    await settle(M);
    await run;

    eq(countOf(M), 2, "an undisturbed batch adds its people");
    eq(M.history.length, 1, "as one undo step");
    eq(M.history[0].label, "2 people added", "labelled with what happened");
    eq(M.dirtyDoc, true, "and the document is dirty, because it changed");
    eq(M.alerts.length, 0, "nothing was reported as a problem");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id);
    const gen = M.docGen;

    const run = M.addFiles([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg")]);
    await tick();
    eq(M.decodes.length, 1, "the batch is mid-decode");

    M.dirtyDoc = false;
    await M.newDoc();
    check(M.docGen !== gen, "New advances the document generation");

    await settle(M);
    await run;

    eq(countOf(M), 0, "the finished batch does not land in the new roster");
    eq(M.history.length, 0, "it leaves no undo step behind");
    eq(M.dirtyDoc, false, "and does not mark the untouched document dirty");
    eq(M.alerts.length, 1, "the user is told, rather than left wondering");
    check(/not imported/.test(M.alerts[0]) && /document changed/.test(M.alerts[0]),
      "and told why — got " + JSON.stringify(M.alerts[0]));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id);
    const gen = M.docGen;

    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();

    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.docName = "someone-elses"; M.dirtyDoc = false;
    M.resetPerRoster();
    check(M.docGen !== gen, "a successful Open advances the generation");

    await settle(M);
    await run;

    eq(countOf(M), 0, "the batch does not land in the roster that was opened");
    eq(M.history.length, 0, "and adds nothing to its fresh history");
    eq(M.dirtyDoc, false, "the newly opened document is still unmodified");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id);

    const tier = M.state.tiers[0].id;
    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();

    M.setConfirm(true);
    await M.applyTemplate("big4-green");

    M.undo();
    eq(M.state.tiers[0].id, tier,
      "undoing applyTemplate brings back the batch's destination id");
    const steps = M.history.length;
    M.dirtyDoc = false;

    await settle(M);
    await run;

    eq(countOf(M), 0, "a batch decoding across an applied template does not land");
    eq(M.history.length, steps, "and adds no undo step of its own");
    eq(M.dirtyDoc, false, "and does not mark the document dirty");
    check(/document changed/.test(M.alerts[0] || ""), "the reason names the document change");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.state.people.push(personIn(M, "Grace Hopper"));
    const tier = M.state.tiers[0].id;
    M.answerImportWith(tier);

    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();

    M.setConfirm(true);
    await M.commands.clearRoster();

    eq((M.state.tiers[0] || {}).id, tier,
      "clearing the roster leaves the batch's destination grade standing");
    const steps = M.history.length;
    M.dirtyDoc = false;

    await settle(M);
    await run;

    eq(countOf(M), 0, "a batch decoding across Clear roster does not land");
    eq(M.history.length, steps, "and adds no undo step of its own");
    eq(M.dirtyDoc, false, "and does not mark the document dirty");
    check(/document changed/.test(M.alerts[0] || ""), "the reason names the document change");
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const tier = M.state.tiers[0].id;
    M.answerImportWith(tier);
    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();

    M.setConfirm(true);
    await M.commands.clearGrades();
    M.undo();
    eq((M.state.tiers[0] || {}).id, tier, "Undo Clear grades restores the pending batch's destination");
    const before = JSON.stringify(M.state);
    const steps = M.history.length;
    M.dirtyDoc = false;

    await settle(M);
    await run;
    eq(JSON.stringify(M.state), before, "a batch spanning Clear grades and Undo changes no document data");
    eq(M.history.length, steps, "a batch spanning Clear grades and Undo adds no history");
    eq(M.dirtyDoc, false, "a batch spanning Clear grades and Undo marks nothing unsaved");
    check(/document changed/.test(M.alerts[0] || ""), "Clear grades invalidates a pending batch even after Undo");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const doomed = M.state.tiers[0].id;
    M.answerImportWith(doomed);

    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();

    M.commit("removed a grade", () => {
      M.state.tiers = M.state.tiers.filter(t => t.id !== doomed);
    });
    const steps = M.history.length;

    await settle(M);
    await run;

    eq(countOf(M), 0, "a new person is not filed under a grade that no longer exists");
    eq(M.history.length, steps, "and no undo step is invented for it");
    check(/grade it was going into no longer exists/.test(M.alerts[0] || ""),
      "the message names the missing grade as the reason — got " + JSON.stringify(M.alerts[0]));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const doomed = M.state.tiers[0].id;
    M.answerImportWith(doomed);
    const ada = personIn(M, "Ada Lovelace");
    M.state.people.push(ada);

    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();
    M.state.tiers = M.state.tiers.filter(t => t.id !== doomed);

    await settle(M);
    await run;

    eq(ada.photo, IMG.data, "a photo for an existing person still attaches");
    eq(M.history.length, 1, "as a normal undo step");
    eq(M.alerts.length, 0, "with nothing reported as discarded");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id);
    const ada  = personIn(M, "Ada Lovelace");
    const alan = personIn(M, "Alan Turing");
    M.state.people.push(ada, alan);

    const run = M.addFiles([file("Ada_Lovelace.jpg"), file("Alan_Turing.jpg")]);
    await tick();
    M.state.people = M.state.people.filter(p => p !== ada);

    await settle(M);
    await run;

    eq(ada.photo, null, "the departed person's photo is dropped");
    eq(alan.photo, IMG.data, "and the other one still lands");
    eq(M.history.length, 1, "one undo step, for the part that happened");
    eq(M.history[0].label, "1 photo attached",
      "labelled with what happened, not with what was attempted");
    check(/1 photo was discarded/.test(M.alerts.join(" ")),
      "the dropped photo is reported — got " + JSON.stringify(M.alerts));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada = personIn(M, "Ada Lovelace");
    M.state.people.push(ada);
    M.setSwapId(ada.id);

    const run = M.swapChange({target:{files:[file("new.jpg")], value:""}});
    await settle(M);
    await run;

    eq(ada.photo, IMG.data, "an undisturbed replacement replaces the photo");
    eq(M.history.length, 1, "as one undo step");
    eq(M.dirtyDoc, true, "and the document is dirty");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada = personIn(M, "Ada Lovelace");
    M.state.people.push(ada);
    M.setSwapId(ada.id);

    const run = M.swapChange({target:{files:[file("new.jpg")], value:""}});
    await tick();
    M.state.people = M.state.people.filter(p => p !== ada);
    M.dirtyDoc = false;

    await settle(M);
    await run;

    eq(ada.photo, null, "nothing is written onto the orphaned person");
    eq(M.history.length, 0, "no undo step for a change with no visible effect");
    eq(M.dirtyDoc, false, "and the document is not marked dirty");
    check(/no longer in the roster/.test(M.alerts[0] || ""),
      "the reason names the missing person — got " + JSON.stringify(M.alerts[0]));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada = personIn(M, "Ada Lovelace");
    M.state.people.push(ada);
    M.setSwapId(ada.id);

    const run = M.swapChange({target:{files:[file("new.jpg")], value:""}});
    await tick();
    M.dirtyDoc = false;
    await M.newDoc();

    await settle(M);
    await run;

    eq(ada.photo, null, "the photo does not follow the person into a new document");
    eq(M.history.length, 0, "and leaves the new document's history empty");
    eq(M.dirtyDoc, false, "and the new document clean");
    check(/document changed/.test(M.alerts[0] || ""),
      "reported as a document change — got " + JSON.stringify(M.alerts[0]));
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const ada = personIn(M, "Ada Lovelace");
    M.state.people.push(ada);
    M.setSwapId(ada.id);

    const run = M.swapChange({target:{files:[file("new.jpg")], value:""}});
    await tick();

    M.state = JSON.parse(JSON.stringify(M.state));
    const clone = M.state.people.find(p => p.id === ada.id);
    check(!!clone && clone !== ada, "the roster now holds a copy, not the captured object");
    M.dirtyDoc = false;

    await settle(M);
    await run;

    eq(clone.photo, null, "the replacement does not land on the restored person");
    eq(ada.photo, null, "nor on the object it captured");
    eq(M.history.length, 0, "and buys no undo step");
    eq(M.dirtyDoc, false, "and leaves the document clean");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.answerImportWith(M.state.tiers[0].id);
    const gen = M.docGen;

    const run = M.addFiles([file("Ada_Lovelace.jpg")]);
    await tick();
    M.commit("renamed the chart", () => { M.state.title = "Something else"; });
    eq(M.docGen, gen, "an ordinary edit does not advance the generation");

    await settle(M);
    await run;
    eq(countOf(M), 1, "so an import that spans an edit still lands");
  }

  {

    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const t = M.state.tiers[0].id;
    const ada = personIn(M, "Ada Lovelace");
    M.state.people.push(ada);

    eq(M.staleWrite(M.docGen, null), null, "same generation, nothing else asked: allowed");
    eq(M.staleWrite(M.docGen, {tierId:t, person:ada}), null, "targets that still exist: allowed");
    check(M.staleWrite(M.docGen - 1, null), "an older generation is refused");
    check(M.staleWrite(M.docGen, {tierId:"nope"}), "a missing grade is refused");
    check(M.staleWrite(M.docGen, {person: personIn(M, "Ghost")}),
      "a person who is not in the roster is refused");

    check(/document changed/.test(M.staleWrite(M.docGen - 1, {tierId:"nope"})),
      "the document check comes before the target checks");
  }

  {
    const M = makeModule();
    const opened = n => ({tiers:[{id:"t" + n, code:"P", label:"P", role:"P",
                                  fill:"green", attach:false, merge:false, align:"center"}],
                          people:[{id:"p" + n, name:"Person " + n, tierId:"t" + n,
                                   groupId:null, role:"", photo:null, pw:0, ph:0, frame:null}],
                          title:"Roster " + n});
    const done = (o, st) => o.res({ok:true, state:st, repaired:[]});

    {
      const before = M.docGen;
      const A = opened("A");
      M.pick("alpha.json", "{A}");
      eq(M.opens.length, 1, "picking a file starts one open");
      check(M.state !== A, "and adopts nothing before it has finished");
      check(M.opening[M.opening.length - 1].indexOf("alpha.json") >= 0,
        "the status bar names the file being opened — got "
        + JSON.stringify(M.opening[M.opening.length - 1]));

      done(M.opens.shift(), A);
      await tick();
      check(M.state === A, "when it finishes, the roster is adopted");
      eq(M.docName, "alpha", "and the document takes the file's name");
      eq(M.dirtyDoc, false, "a freshly opened document is not dirty");
      eq(M.docGen, before + 1, "opening a different roster advances the generation");
      eq(M.opening[M.opening.length - 1], "", "and the opening status is cleared");
      check(M.toasts.some(t => /Opened alpha\.json/.test(t)), "the open is reported");

      M.updateDocLabel();
      eq(M.shown.name, "alpha", "the status shows the opened file's name");
      eq(M.shown.saved, true, "and the saved icon");
      eq(M.shown.unsaved, false, "with the unsaved one hidden");
      eq(M.shown.status, "Saved", "and the Saved status name");
    }

    {
      const A = opened("A2"), B = opened("B2");
      M.pick("big.json", "{A}");
      M.pick("small.json", "{B}");
      eq(M.opens.length, 2, "both opens are in flight");
      const [slow, fast] = M.opens.splice(0, 2);

      done(fast, B);
      await tick();
      check(M.state === B, "the file picked last is adopted when it finishes first");
      eq(M.docName, "small", "and names the document");

      const gen = M.docGen, toasts = M.toasts.length, hist = M.history.length;
      done(slow, A);
      await tick();
      check(M.state === B, "the earlier open does NOT overwrite it when it finishes late");
      eq(M.docName, "small", "and does not rename the document");
      eq(M.docGen, gen, "a discarded open does not advance the generation");
      eq(M.history.length, hist, "and leaves no history entry");
      eq(M.dirtyDoc, false, "and does not mark the document dirty");
      eq(M.toasts.length, toasts, "and says nothing — the user has already moved on");
    }

    {
      const A = opened("A3"), B = opened("B3");
      const was = M.state;
      M.pick("first.json", "{A}");
      M.pick("second.json", "{B}");
      const [first, second] = M.opens.splice(0, 2);

      done(first, A);
      await tick();
      check(M.state === was, "an open superseded by a later pick is dropped even when it wins the race");
      eq(M.docName, "small", "the document is untouched by it");

      done(second, B);
      await tick();
      check(M.state === B, "and the file picked last is adopted whenever it arrives");
      eq(M.docName, "second", "with its name");
    }

    {
      const A = opened("A4"), B = opened("B4");
      M.pick("stale.json", "{A}");
      M.pick("current.json", "{B}");
      const [stale, current] = M.opens.splice(0, 2);

      done(stale, A);
      await tick();
      const shown = M.opening[M.opening.length - 1];
      check(shown.indexOf("current.json") >= 0,
        "the status bar still names the open that is actually running — got "
        + JSON.stringify(shown));

      const alerts = M.alerts.length;
      done(current, B);
      await tick();
      eq(M.alerts.length, alerts, "a superseded open raises no alert of its own");
      eq(M.opening[M.opening.length - 1], "", "and the running one clears the status when it lands");
    }

    {
      const was = M.state, name = M.docName;
      M.dirtyDoc = true;
      M.pick("junk.json", "{oh dear");
      M.opens.shift().res({ok:false, reason:"the file is not valid JSON"});
      await tick();
      check(M.state === was, "a refused roster does not replace the open one");
      eq(M.docName, name, "and does not rename it");
      eq(M.dirtyDoc, true, "and does not clear its unsaved-changes flag");
      check(M.alerts.some(a => /not valid JSON/.test(a)),
        "the refusal is reported, with the reason — got " + JSON.stringify(M.alerts.slice(-1)));
      eq(M.opening[M.opening.length - 1], "", "and the opening status is cleared");
      M.dirtyDoc = false;
    }

    {
      const was = M.state;
      M.pick("throws.json", "{A}");
      M.opens.shift().rej(new Error("decoder exploded"));
      await tick();
      check(M.state === was, "an open that throws leaves the document alone");
      check(M.alerts.some(a => /could not be checked/.test(a)),
        "and says so — got " + JSON.stringify(M.alerts.slice(-1)));
      eq(M.opening[M.opening.length - 1], "", "and clears the status");
    }

    {
      const was = M.state, opens = M.opens.length;
      M.setReadFails(true);
      M.pick("unreadable.json", "{A}");
      M.setReadFails(false);
      await tick();
      eq(M.opens.length, opens, "a file that cannot be read never reaches the validator");
      check(M.state === was, "and leaves the document alone");
      check(M.alerts.some(a => /could not be read from disk/.test(a)), "and is reported");
      eq(M.opening[M.opening.length - 1], "", "and clears the status");
    }

    {
      M.setReadHold(true);

      {
        const alerts = M.alerts.length, was = M.state;
        const base = M.reads.length;
        M.pick("gone.json", "{A}");
        eq(M.reads.length - base, 1, "the reader was started and is holding");
        M.reads.splice(base, 1)[0].fail();
        await tick();
        eq(M.alerts.length, alerts + 1, "a read that fails while it is current is reported");
        check(/could not be read from disk/.test(M.alerts[M.alerts.length - 1]),
          "with the reason — got " + JSON.stringify(M.alerts[M.alerts.length - 1]));
        eq(M.opening[M.opening.length - 1], "", "and clears its own status");
        check(M.state === was, "and touches nothing else");
      }

      {
        const alerts  = M.alerts.length;
        const opens   = M.opens.length;
        const hist    = M.history.length;
        const was     = M.state, name = M.docName;

        const base = M.reads.length;
        M.pick("slow.json", "{A}");
        M.pick("quick.json", "{B}");
        eq(M.reads.length - base, 2, "both reads are in flight");
        const [slow, quick] = M.reads.splice(base, 2);

        const status = M.opening[M.opening.length - 1];
        check(status.indexOf("quick.json") >= 0,
          "the status bar names the newer Open — got " + JSON.stringify(status));

        slow.fail();
        await tick();
        eq(M.alerts.length, alerts,
          "a read superseded before it failed says nothing — got "
          + JSON.stringify(M.alerts.slice(alerts)));
        eq(M.opening[M.opening.length - 1], status,
          "and leaves the status belonging to the newer Open exactly as it was");
        check(M.state === was, "and does not touch the document");
        eq(M.docName, name, "or its name");
        eq(M.history.length, hist, "or its history");
        eq(M.opens.length, opens, "and never reaches the validator");

        quick.deliver();
        await tick();
        eq(M.opens.length, opens + 1, "the newer read reaches the validator");
        const B = opened("B11");
        M.opens.pop().res({ok:true, state:B, repaired:[]});
        await tick();
        check(M.state === B, "and the newer Open lands normally");
        eq(M.docName, "quick", "with its own name");
        eq(M.opening[M.opening.length - 1], "", "and clears the status itself");
      }

      M.setReadHold(false);
    }

    {
      const A = opened("A12"), B = opened("B12");

      M.pick("thirty-photos.json", "{A}");
      const first = M.opens[M.opens.length - 1];
      check(first.options && typeof first.options.cancelled === "function",
        "an Open is given a cancellation predicate, not just a sequence number");
      eq(first.options.cancelled(), false,
        "which answers false while it is still the Open the user is waiting for");

      M.pick("one-photo.json", "{B}");
      const second = M.opens[M.opens.length - 1];
      eq(first.options.cancelled(), true,
        "and turns true the moment a newer Open supersedes it");
      eq(second.options.cancelled(), false, "while the newer one is not cancelled");

      const alerts = M.alerts.length, toasts = M.toasts.length;
      const hist   = M.history.length, gen = M.docGen;
      const was    = M.state, name = M.docName;
      M.dirtyDoc = true;

      M.opens.splice(M.opens.indexOf(first), 1);
      first.res({ok:false, cancelled:true});
      await tick();
      eq(M.alerts.length, alerts,
        "a cancelled Open raises no alert — got " + JSON.stringify(M.alerts.slice(alerts)));
      eq(M.toasts.length, toasts, "and no repair toast either");
      check(M.state === was, "it does not touch state");
      eq(M.docName, name, "or the document name");
      eq(M.history.length, hist, "or the history");
      eq(M.docGen, gen, "or the generation");
      eq(M.dirtyDoc, true, "and does not clear the dirty flag it never set");
      check(M.opening[M.opening.length - 1].indexOf("one-photo.json") >= 0,
        "and leaves the status belonging to the Open that is still running — got "
        + JSON.stringify(M.opening[M.opening.length - 1]));

      M.opens.splice(M.opens.indexOf(second), 1);
      second.res({ok:true, state:B, repaired:[]});
      await tick();
      check(M.state === B, "the current Open still lands");
      eq(M.docName, "one-photo", "and names the document");
      eq(M.dirtyDoc, false, "and a freshly opened document is clean again");
      eq(M.opening[M.opening.length - 1], "", "and the status is cleared by the one that owns it");
      check(M.toasts.some(t => /Opened one-photo\.json/.test(t)), "and it is the one reported");
    }
  }

  {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const T = M.state.tiers;

    const mk = (name, ti) => ({id:"p" + name, name:name, tierId:T[ti].id,
                               groupId:null, role:"", photo:null, pw:0, ph:0, frame:null});
    const seed = () => {
      M.state.people = [mk("Ana",0), mk("Cy",1), mk("Bo",0), mk("Di",1)];
    };

    const visible = () => T.map(t => M.state.people.filter(p => p.tierId === t.id)
                                                   .map(p => p.name)).filter(g => g.length);
    const order = () => M.state.people.map(p => p.name).join(",");
    const idOf  = n => M.state.people.find(p => p.name === n).id;

    const kindOf = (n, dir) => { const w = M.moveTarget(idOf(n), dir); return w ? w.kind : null; };
    const tierOf = (n, dir) => { const w = M.moveTarget(idOf(n), dir); return w ? w.tier : null; };

    seed();
    const before = M.state.people.slice();
    M.movePerson(idOf("Ana"), 1);
    eq(order(), "Bo,Cy,Ana,Di", "a within-group move still swaps the two array entries in place");
    eq(JSON.stringify(visible()), JSON.stringify([["Bo","Ana"],["Cy","Di"]]),
      "and reorders only inside that grade");
    check(M.state.people.length === before.length
       && before.every(p => M.state.people.indexOf(p) >= 0),
      "the same objects are still in the array — a swap, not a rebuild");
    eq(M.state.people.filter(p => p.tierId === T[0].id).length, 2,
      "and nobody changed grade");

    seed();
    eq(kindOf("Bo", 1), "grade", "the last person of a grade has a grade to move down into");
    check(tierOf("Bo", 1) === T[1], "and it is the next tier in state.tiers");
    M.movePerson(idOf("Bo"), 1);
    eq(M.state.people.find(p => p.name === "Bo").tierId, T[1].id, "moving down past the end changes grade");
    eq(JSON.stringify(visible()), JSON.stringify([["Ana"],["Bo","Cy","Di"]]),
      "and lands them FIRST in the new group, not wherever their old index fell");

    seed();
    eq(kindOf("Cy", -1), "grade", "the first person of a grade has a grade to move up into");
    M.movePerson(idOf("Cy"), -1);
    eq(M.state.people.find(p => p.name === "Cy").tierId, T[0].id, "moving up past the start changes grade");
    eq(JSON.stringify(visible()), JSON.stringify([["Ana","Bo","Cy"],["Di"]]),
      "and lands them LAST in the previous group");

    seed();
    M.state.people = [mk("Ana",0), mk("Bo",0)];
    eq(visible().length, 1, "only one group is drawn while the others are empty");
    eq(kindOf("Bo", 1), "grade", "the last person can still move down into an empty grade");
    check(tierOf("Bo", 1) === T[1], "into the adjacent one, not the next populated one");
    M.movePerson(idOf("Bo"), 1);
    eq(M.state.people.find(p => p.name === "Bo").tierId, T[1].id, "the empty grade accepts them");
    eq(JSON.stringify(visible()), JSON.stringify([["Ana"],["Bo"]]),
      "and that group now appears in the roster");

    seed();
    check(M.moveTarget(idOf("Ana"), -1) === null,
      "the first person of the first grade cannot move up");
    for(const [name, dir] of [["Ana",1],["Bo",-1],["Bo",1],["Cy",-1],["Cy",1],["Di",-1]]){
      check(M.moveTarget(idOf(name), dir) !== null,
        "everyone else keeps both arrows — " + name + " " + (dir < 0 ? "up" : "down"));
    }

    check(M.moveTarget(idOf("Di"), 1) !== null,
      "the last person of the last populated grade can still move down into the empty grades below");
    M.state.people.push(mk("Zoe", T.length - 1));
    check(M.moveTarget(idOf("Zoe"), 1) === null,
      "only the last person of the last grade in state.tiers cannot move down");
    check(M.moveTarget(idOf("Zoe"), -1) !== null, "though they can still move up");

    seed();
    eq(M.moveLabel(idOf("Ana"), 1), "moved Ana",
      "a within-group move is recorded as it always was");
    eq(M.moveLabel(idOf("Bo"), 1), "moved Bo to " + M.gradeName(T[1]),
      "a crossing move names the grade it goes to");
    check(/ to /.test(M.moveLabel(idOf("Cy"), -1)), "in both directions");

    M.movePerson(idOf("Bo"), 1);
    eq(M.moveLabel(idOf("Bo"), -1), "moved Bo to " + M.gradeName(T[0]),
      "and still describes the move ahead of it, not the one behind");

    seed();
    M.state.tiers[1].label = "";
    eq(M.gradeName(T[1]), T[1].code, "a grade with no name is called by its code");
    const steps = M.history.length;
    M.commit(M.moveLabel(idOf("Bo"), 1), () => M.movePerson(idOf("Bo"), 1));
    eq(M.history.length, steps + 1, "a crossing move is one history entry");
    eq(M.state.people.find(p => p.name === "Bo").tierId, T[1].id, "which moved the grade");
    M.undo();
    eq(M.state.people.find(p => p.name === "Bo").tierId, T[0].id,
      "and undo puts the grade back");
    eq(JSON.stringify(visible()), JSON.stringify([["Ana","Bo"],["Cy","Di"]]),
      "together with the position — both halves of the write, or the row lands in the wrong rank");
  }

{
  const M = makeModule();
  M.state = M.defaults();
  M.state.tiers = sixGrades();
  const T = M.state.tiers;
  const mk = (name, ti) => ({id:"p" + name, name:name, tierId:T[ti].id,
                             groupId:null, role:"", photo:null, pw:0, ph:0, frame:null});

  const seed = () => {
    M.state.people = [mk("Ana",0), mk("Cy",1), mk("Bo",0), mk("Di",1), mk("Ed",2)];
    M.dirtyDoc = false;
  };
  const visible = () => T.map(t => M.state.people.filter(p => p.tierId === t.id)
                                                 .map(p => p.name)).filter(g => g.length);
  const idOf = n => (M.state.people.find(p => p.name === n) || {}).id;
  const shown = () => JSON.stringify(visible());

  seed();
  eq(shown(), JSON.stringify([["Ana","Bo"],["Cy","Di"],["Ed"]]), "the seeded roster");
  check(M.reorderPerson(idOf("Bo"), idOf("Ana"), false), "dropping Bo above Ana is a move");
  eq(shown(), JSON.stringify([["Bo","Ana"],["Cy","Di"],["Ed"]]),
    "…and it reorders them inside their own grade");
  eq(M.state.people.find(p => p.name === "Bo").tierId, T[0].id, "without changing their grade");

  seed();
  check(M.reorderPerson(idOf("Ana"), idOf("Di"), false), "dropping Ana above Di is a move");
  eq(shown(), JSON.stringify([["Bo"],["Cy","Ana","Di"],["Ed"]]),
    "…and she lands between the two she was dropped between, not at an end");
  eq(M.state.people.find(p => p.name === "Ana").tierId, T[1].id, "in the grade she was dropped in");

  seed();
  check(M.reorderPerson(idOf("Ana"), idOf("Di"), true), "dropping Ana after the last of a grade");
  eq(shown(), JSON.stringify([["Bo"],["Cy","Di","Ana"],["Ed"]]),
    "…puts her at the end of it, which is what a heading means");

  seed();
  const before = M.history.length;

  const refused = (src, tgt, after, msg) => {
    const at = M.history.length;
    check(M.reorderPerson(src, tgt, after) === false && M.history.length === at,
      msg + " — refused outright, with no snapshot spent on the attempt");
  };
  refused(idOf("Ana"), idOf("Ana"), false, "dropping somebody on themselves is refused");
  refused(idOf("Ana"), idOf("Bo"), false, "…and so is a drop into the slot they already occupy");
  refused(idOf("Bo"), idOf("Ana"), true, "…named from the other side, which is the same slot");
  refused(idOf("Ana"), "no-such-person", false, "…and a stale target id from a rebuilt row");
  eq(M.history.length, before, "none of the four left a history entry");
  eq(shown(), JSON.stringify([["Ana","Bo"],["Cy","Di"],["Ed"]]), "or touched the roster");
  eq(M.dirtyDoc, false, "or marked the document dirty");

  seed();
  const hist = M.history.length;
  const startedAt = M.state.people.findIndex(p => p.name === "Ana");
  check(M.reorderPerson(idOf("Ana"), idOf("Ed"), true), "Ana is dropped two grades away");
  eq(shown(), JSON.stringify([["Bo"],["Cy","Di"],["Ed","Ana"]]),
    "…and lands after Ed at the far end");
  const endedAt = M.state.people.findIndex(p => p.name === "Ana");
  check(Math.abs(endedAt - startedAt) > 1,
    "the walk really did take more than one step — " + startedAt + " to " + endedAt);
  eq(M.history.length, hist + 1, "and the whole walk is ONE history entry");
  M.undo();
  eq(shown(), JSON.stringify([["Ana","Bo"],["Cy","Di"],["Ed"]]),
    "so one undo restores the order the drag started from");
  eq(M.state.people.find(p => p.name === "Ana").tierId, T[0].id, "and the grade with it");

  seed();
  M.reorderPerson(idOf("Ana"), idOf("Ed"), true);
  eq((M.history[M.history.length - 1] || {}).label, "moved Ana to " + M.gradeName(T[2]),
    "a drop over two boundaries names the grade it landed in");
  check((M.history[M.history.length - 1] || {}).label.indexOf(M.gradeName(T[1])) < 0,
    "…and not the one it passed through");

  seed();
  eq(M.moveLabelTo(idOf("Bo"), T[1]), M.moveLabel(idOf("Bo"), 1),
    "moveLabel and moveLabelTo produce the same sentence for the same move");
  eq(M.moveLabelTo(idOf("Ana"), T[0]), "moved Ana",
    "and a destination the person is already in is not a crossing");

  seed();
  M.reorderPerson(idOf("Bo"), idOf("Ana"), false);
  eq((M.history[M.history.length - 1] || {}).label, "moved Bo",
    "a reorder inside one grade says only that");

  {
    const N = makeModule();
    N.state = N.defaults();
    N.state.tiers = sixGrades();
    const TT = N.state.tiers;

    const nk = (name, ti) => ({id:"p" + name, name:name, tierId:TT[ti].id,
                               groupId:null, role:"", photo:null, pw:0, ph:0, frame:null});
    N.state.people = [nk("Ana",0), nk("Cy",1), nk("Bo",0)];
    const was = N.state.people.map(p => p.name + "@" + p.tierId).join(",");
    const entries = N.history.length;

    N.resetSteps();
    N.breakTheStep();
    const done = N.reorderPerson(N.state.people[0].id, N.state.people[2].id, true);
    eq(done, false, "a walk that cannot make progress reports failure");

    eq(N.steps, 1,
      "…on the FIRST step that achieves nothing, not after spending the whole "
      + "bound — got " + N.steps + " steps");
    eq(N.history.length, entries + 1,
      "the attempt is still one entry, so the no-op is one undo away either way");
    check(N.alerts.some(a => /could not be completed/.test(a)),
      "…and it says so rather than failing silently — got " + JSON.stringify(N.alerts));

    const P = makeModule();
    P.state = P.defaults();
    P.state.tiers = sixGrades();
    const PT = P.state.tiers;
    const pk = (name, ti) => ({id:"q" + name, name:name, tierId:PT[ti].id,
                               groupId:null, role:"", photo:null, pw:0, ph:0, frame:null});
    P.state.people = [pk("Ana",0), pk("Bo",0), pk("Cy",0), pk("Di",2)];
    const orderWas = P.state.people.map(p => p.name + "@" + p.tierId).join(",");
    P.breakTheStepAfter(1);
    const moved = P.reorderPerson("qAna", "qDi", true);
    eq(moved, false, "a walk that stalls part-way reports failure");
    eq(P.state.people.map(p => p.name + "@" + p.tierId).join(","), orderWas,
      "…and puts back BOTH halves — the array order and the tierId — so nobody is "
      + "left standing between two grades");
  }
}

{
  const M = makeModule();

  {
    const st = {
      tiers: [{id:"t1", code:"P", label:"Partner"}, {id:"t2", code:"A", label:"Associate"}],
      groups: [{id:"g1", label:"Berlin"}],
      people: [
        {id:"p1", name:"Ada", tierId:"t1", groupId:"g1", role:"Founder"},
        {id:"p2", name:"Bob", tierId:"t2", groupId:null, role:""}
      ]
    };
    eq(M.toCSV(st),
      "Name;Grade;Group;Role\r\nAda;P;Berlin;Founder\r\nBob;A;;",
      "header, then one row per person in roster order, semicolon-delimited");
  }

  {
    const st = {
      tiers: [{id:"t1", code:"P", label:"Partner"}],
      people: [{id:"p1", name:"Smith; Jr", tierId:"t1", groupId:null, role:""}]
    };
    eq(M.toCSV(st),
      'Name;Grade;Group;Role\r\n"Smith; Jr";P;;',
      "a name containing the ; delimiter is wrapped in quotes");
  }

  {
    const st = {
      tiers: [{id:"t1", code:"P", label:"Partner"}],
      people: [{id:"p1", name:'Ann "Annie" Lee', tierId:"t1", groupId:null, role:""}]
    };
    eq(M.toCSV(st),
      'Name;Grade;Group;Role\r\n"Ann ""Annie"" Lee";P;;',
      "a name containing a double quote is wrapped in quotes with the inner quote doubled");
  }

  {
    const st = {
      tiers: [
        {id:"t1", code:"P", label:"Partner"},
        {id:"t2", code:"", label:"Contractor"}
      ],
      people: [
        {id:"p1", name:"Ada", tierId:"t1", groupId:null, role:""},
        {id:"p2", name:"Cy",  tierId:"t2", groupId:null, role:""},
        {id:"p3", name:"Di",  tierId:"gone", groupId:null, role:""}
      ]
    };
    eq(M.toCSV(st),
      "Name;Grade;Group;Role\r\nAda;P;;\r\nCy;Contractor;;\r\nDi;;;",
      "grade is code, falling back to label when code is empty, and empty for "
      + "an unmatched tierId");
  }

  {
    const st = {tiers: [{id:"t1", code:"P", label:"Partner"}], people: []};
    eq(M.toCSV(st), "Name;Grade;Group;Role",
      "zero people is the header line alone, with no trailing newline");
  }

  {
    const st = {
      tiers: [{id:"t1", code:"P", label:"Partner"}],
      groups: [{id:"g1", label:"Berlin\nGermany"}],
      people: [{id:"p1", name:"Ada", tierId:"t1", groupId:"g1", role:""}]
    };
    eq(M.toCSV(st),
      'Name;Grade;Group;Role\r\nAda;P;"Berlin\nGermany";',
      "a field containing a line break is wrapped in quotes");
  }
}

{
  const M = makeModule();
  M.state = M.defaults();
  M.state.tiers = sixGrades();
  const T = M.state.tiers;

  const berlinId = M.resolveGroupId(M.state, "Berlin");
  const munichId = M.resolveGroupId(M.state, "Munich");
  const berlnId  = M.resolveGroupId(M.state, "Berln");
  const mk = (name, groupId) => ({id:"p"+name, name:name, tierId:T[0].id, groupId:groupId, role:""});
  M.state.people = [mk("Ana", berlinId), mk("Bo", berlinId), mk("Cy", munichId), mk("Di", berlnId)];

  M.syncGroupModal();
  eq(JSON.stringify(M.groupRows().map(r => [r.label, r.count])),
     JSON.stringify([["Berlin","2"],["Munich","1"],["Berln","1"]]),
     "three rows, state.groups order, each carrying its own label and its own "
     + "live count — got " + JSON.stringify(M.groupRows()));
  check(M.groupEmptyHidden === true, "the empty-state sentence is hidden once groups exist");

  {
    const before = M.history.length;
    check(M.moveGroup(munichId, -1), "Munich moves up, ahead of Berlin");
    eq(M.history.length, before + 1, "…as exactly one commit");
    eq(M.state.groups.map(g => g.label).join(","), "Munich,Berlin,Berln",
      "…and the order after the move");
    M.syncGroupModal();
    const rows = M.groupRows();
    eq(rows[0].upDisabled, true, "the first row's Up is disabled");
    eq(rows[rows.length - 1].downDisabled, true, "the last row's Down is disabled");
    eq(rows[1].upDisabled, false, "…and a middle row's Up is not");
    eq(rows[0].downDisabled, false, "…nor is the first row's Down");

    const at = M.history.length;
    check(M.moveGroup(munichId, -1) === false, "Munich is already first — moving up is refused");
    check(M.moveGroup(berlnId, 1) === false, "Berln is already last — moving down is refused");
    eq(M.history.length, at, "…neither refusal left a history entry");

    check(M.moveGroup(munichId, 1), "Munich moves back down");
    eq(M.state.groups.map(g => g.label).join(","), "Berlin,Munich,Berln",
      "…restoring the original order");
  }

  {
    const before = M.history.length;
    const cyGroupWas = (M.state.people.find(p => p.name === "Cy") || {}).groupId;
    M.setPrompt("München");
    check(await M.renameGroup(munichId), "renaming Munich to München");
    eq(M.history.length, before + 1, "…is one commit");
    eq((M.state.groups.find(g => g.id === munichId) || {}).label, "München", "…and the label changed");
    eq(M.state.groups.length, 3, "…with no group created or removed");
    eq((M.state.people.find(p => p.name === "Cy") || {}).groupId, cyGroupWas,
      "Cy's groupId is exactly what it was before — identity, not just the label");
  }

  {
    const before = M.history.length;
    const berlnMembersWere = M.state.people.filter(p => p.groupId === berlnId).map(p => p.id);
    eq(berlnMembersWere.length, 1, "the typo group starts with its one member — Di");
    M.setPrompt("berlin");
    check(await M.renameGroup(berlnId), "renaming Berln to berlin, which Berlin already is");
    eq(M.history.length, before + 1, "…is one commit");
    eq(M.state.groups.length, 2, "…and the memberless source is swept — one fewer group");
    check(!M.state.groups.some(g => g.id === berlnId),
      "the source entity itself is gone from state.groups — pruneGroups' doing, not a hand-delete");
    eq((M.state.groups.find(g => g.id === berlinId) || {}).label, "Berlin",
      "the survivor keeps its OWN casing — the typed \"berlin\" never lands anywhere");
    eq(M.state.people.filter(p => p.groupId === berlinId).map(p => p.name).sort().join(","),
      "Ana,Bo,Di", "all three people now point at the survivor, including the repointed Di");

    eq((M.state.groups[0] || {}).id, berlinId, "the survivor keeps its own position");
    M.undo();
    eq(M.state.groups.length, 3, "undo restores both entities");
    eq((M.state.groups.find(g => g.id === berlnId) || {}).label, "Berln", "…the source, by its own id");
    eq((M.state.people.find(p => p.name === "Di") || {}).groupId, berlnId,
      "…and Di's groupId is back on the source, not left pointing at the survivor");
  }

  {
    const before = M.history.length;
    M.setPrompt(null);
    check(await M.renameGroup(munichId) === false, "cancelling the dialog is refused");
    M.setPrompt("   ");
    check(await M.renameGroup(munichId) === false, "whitespace-only is refused after trimming");
    M.setPrompt("München");
    check(await M.renameGroup(munichId) === false, "typing back the same text is refused");
    eq(M.history.length, before, "none of the three spent a commit");
  }

  {
    const order = () => M.state.groups.map(g => g.id);
    const [g0, g1, g2] = order();
    const before = M.history.length;
    check(M.reorderGroupRow(g0, g0, false) === false, "dropping a group on itself is refused");
    check(M.reorderGroupRow(g0, g1, false) === false, "…and so is the slot it already occupies");
    check(M.reorderGroupRow("no-such-group", g1, false) === false, "…and a stale source id");
    eq(M.history.length, before, "none of the three left a history entry");
    check(M.reorderGroupRow(g2, g0, false), "a real drop — the last group, dropped before the first");
    eq(order().join(","), [g2, g0, g1].join(","), "…and the order reflects the drop");
    M.undo();
    eq(order().join(","), [g0, g1, g2].join(","),
      "…and ONE undo reverses the whole drop — it was a single commit");
  }
}

  await guarded("16a completes without throwing", async () => {
    const M = makeModule();
    const doc = M.demoDoc();
    check(M.stateLimitProblem(doc) === null,
      "the app's own save-gate accepts the demo document — got " + JSON.stringify(M.stateLimitProblem(doc)));
    check(doc.people.every(p => p.photo === null),
      "no demo person carries a photo, so the tour starts no image decode");
    check(doc.people.every(p => p.pw === 0 && p.ph === 0),
      "…nor any decoded photo dimensions");
    check(doc.people.every(p => p.frame === null),
      "…nor a crop frame — nothing is framed with no photo behind it");
    check(doc.people.every(p => doc.tiers.some(t => t.id === p.tierId)),
      "every demo person's tierId resolves to one of the demo's own tiers");
    check(doc.people.every(p => doc.groups.some(g => g.id === p.groupId)),
      "…and every groupId resolves to one of the demo's own groups");
    eq(doc.title, "Pearson Specter Litt", "the demo names its own firm");
    eq(doc.groupsLabel, "Practice", "…and its own group-axis label");
    eq(JSON.stringify(doc.groups.map(g => g.label)),
       JSON.stringify(["Litigation","Corporate","Operations"]),
       "three groups, in this document order — Matrix would read it as row order");
    eq(JSON.stringify(doc.tiers.map(t => t.code)),
       JSON.stringify(["P","A","D","SM","M","SC","C"]),
       "seven grades — Analyst and Junior Staff dropped, Assistant renamed to A");
    eq(JSON.stringify(doc.tiers.map(t => t.merge)),
       JSON.stringify([false,false,false,false,true,false,true]),
       "Manager and Consultant share the band above them; nobody else does");
    const attachOf = code => doc.tiers.find(t => t.code === code).attach;
    check(attachOf("A") === true,
      "Assistant's attach survives the AS-to-A rename — the template states it directly");
    check(attachOf("M") === true && attachOf("C") === true,
      "…and normalizeGradeLinks raises attach on both merged grades, asserted through the "
      + "built tiers rather than restated as a second copy of the rule");
    check(attachOf("P") === false && attachOf("D") === false
       && attachOf("SM") === false && attachOf("SC") === false,
      "nobody else attaches");

    check(doc.tiers.every(t => t.align === "center"),
      "every demo tier reads align \"center\" — got "
      + JSON.stringify(doc.tiers.map(t => t.code + ":" + t.align)));
    eq(doc.people.length, 12, "twelve people — the whole cast");
    eq(doc.people[0].name, "Jessica Pearson", "seated first, in the stated roster order");
    eq(doc.people[0].role, "Managing Partner", "…carrying her own title");
    check(doc.people.slice(1).every(p => p.role === ""),
      "everyone else's role is blank — a grade's own name prints under them instead");
    eq(doc.accent, "#004225",
      "the accent is the literal the template ships — not a copy of TEMPLATES' own field");
    eq(doc.layout, "pyramid", "the demo draws as a pyramid, big4-green's own layout");

    const a = M.demoDoc(), b = M.demoDoc();
    check(a !== b && a.tiers !== b.tiers && a.people !== b.people && a.groups !== b.groups,
      "two demoDoc() calls return distinct objects, not one shared document");
    check(a.tiers[0].id !== b.tiers[0].id,
      "…with fresh tier ids each time — newTier() runs again rather than handing out "
      + "one reused set of objects to corrupt");
  });

  await guarded("16b completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    M.commit("added Ana", () => { M.state.people.push(personIn(M, "Ana Original")); });
    const anaId = M.state.people[0].id;
    M.commit("added Bo", () => {
      const p = personIn(M, "Bo");
      p.photo = "data:image/png;base64,AAA";
      M.state.people.push(p);
    });

    M.setPrompt("acme-roster");
    eq(await M.saveDoc(false), true, "the user document saves");
    eq(M.docName, "acme-roster", "…and is named");
    eq(M.dirtyDoc, false, "…and clean");

    M.commit("renamed Ana", () => {
      M.state.people.find(p => p.id === anaId).name = "Ana Renamed";
    });
    eq(M.dirtyDoc, true, "the rename dirties the document again");
    eq(M.history.length, 3, "three commits, three history entries, before the tour starts");
    const preTourHistoryLen = M.history.length;

    check(M.startTour() === true, "startTour succeeds on a clean tree with no modal and no import busy");
    eq(M.state.title, "Pearson Specter Litt", "the live document is now the demo");
    eq(M.state.people.length, 12, "…with the demo's own twelve people");
    eq(M.history.length, 0, "…and an empty history — none of the user's steps are on the live stack");
    eq(M.dirtyDoc, false, "…and a clean flag — nothing about the demo is unsaved yet");
    eq(M.docName, "", "…and no filename — the demo was never saved");

    M.commit("switched the demo to swimlanes", () => { M.state.layout = "swimlanes"; }, {render:"all"});
    eq(M.dirtyDoc, true, "the demo's own commit marks the DEMO dirty");
    eq(M.history.length, 1, "…and grows the DEMO's own history");

    M.endTour();
    eq(M.docName, "acme-roster", "endTour restores the user's filename");
    eq(M.dirtyDoc, true, "…and the user's dirty flag — true, from the rename made before the tour");
    eq(M.state.people.length, 2, "…and the user's own two people, not the demo's twelve");

    const anaNow = () => (M.state.people.find(p => p.id === anaId) || {}).name;
    eq(anaNow(), "Ana Renamed", "…with the rename the user made still in place");
    eq(M.history.length, preTourHistoryLen, "…and the whole pre-tour undo stack, unchanged");

    M.undo();
    eq(anaNow(), "Ana Original",
      "undo after the tour restores the pre-tour rename — the stack is still CONNECTED, "
      + "not merely the same length as before the tour");
    check(M.canRedo(), "…and redo is available from there");
    M.redo();
    eq(anaNow(), "Ana Renamed", "…giving the rename back");
  });

  await guarded("16c completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.commit("added Priya", () => { M.state.people.push(personIn(M, "Priya")); });
    M.commit("added Tom", () => {
      const p = personIn(M, "Tom");
      p.photo = "data:image/png;base64,AAA";
      M.state.people.push(p);
    });
    const tomId = M.state.people[1].id;
    M.commit("gave Tom a title", () => {
      M.state.people.find(p => p.id === tomId).role = "Partner";
    });

    const photoIsLive = () => Array.from(M.photoStore.values()).includes("data:image/png;base64,AAA");
    check(photoIsLive(), "Tom's photo is reachable in photoStore before the tour ever starts");

    check(M.startTour(), "the tour starts");
    M.commit("switched the demo to swimlanes", () => { M.state.layout = "swimlanes"; }, {render:"all"});
    check(photoIsLive(),
      "…and Tom's photo is STILL in photoStore after the demo's own commit swept — reachable "
      + "only through tourSaved.history");

    M.endTour();
    M.undo();

    const tom = M.state.people.find(p => p.id === tomId) || {};
    eq(tom.role, "", "undo restored Tom to before his title was set");
    eq(tom.photo, "data:image/png;base64,AAA",
      "…and his photo round-tripped through the store intact across the boundary photoSweep "
      + "almost swept it out of");
  });

  await guarded("16d completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    const original = M.state;

    M.setModalOpen(true);
    check(M.startTour() === false, "a modal open refuses the tour");
    check(M.state === original, "…the live state is untouched — same object");
    check(M.tourSaved === null, "…and nothing was set aside");
    M.setModalOpen(false);

    M.importBusy = true;
    check(M.startTour() === false, "an import mid-flight refuses the tour");
    check(M.state === original, "…untouched");
    check(M.tourSaved === null, "…nothing set aside");
    M.importBusy = false;

    check(M.startTour() === true, "the tour starts once nothing is in the way");
    const bundle = M.tourSaved;
    check(!!bundle && bundle.state === original,
      "the set-aside bundle holds the user's ORIGINAL state object");
    check(M.startTour() === false, "a second start mid-tour is refused");
    check(M.tourSaved === bundle,
      "…and the ORIGINAL bundle is still there — a second start did not overwrite it with a "
      + "fresh (and now-unrecoverable) one");
    check(M.tourSaved.state === original,
      "…still pointing at the user's real state, not the demo it would have replaced it with");
  });

  await guarded("16e completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    const genBefore = M.docGen;
    check(M.startTour(), "the tour starts");
    const genMidTour = M.docGen;
    check(genMidTour !== genBefore, "starting the tour advances the generation");
    check(M.staleWrite(genBefore, null) !== null,
      "a decode captured before the tour is stale once it is running — got "
      + JSON.stringify(M.staleWrite(genBefore, null)));

    M.endTour();
    check(M.docGen !== genMidTour,
      "ending the tour advances the generation again — a decode started FOR the demo must "
      + "not land in the user's restored document");
    check(M.staleWrite(genMidTour, null) !== null,
      "a decode captured mid-tour is stale once the tour has ended — got "
      + JSON.stringify(M.staleWrite(genMidTour, null)));
  });

  await guarded("16f completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    M.commit("added a person", () => { M.state.people.push(personIn(M, "One")); });
    M.commit("added another", () => { M.state.people.push(personIn(M, "Two")); });

    check(M.startTour(), "the tour starts");
    let prevented = false;
    const evt = {preventDefault(){ prevented = true; }, returnValue:""};

    M.tourSaved.dirtyDoc = true;
    M.dirtyDoc = false;
    M.beforeUnload(evt);
    check(prevented, "the set-aside user document is dirty, so beforeunload still guards the tab");

    M.tourSaved.dirtyDoc = false;
    M.dirtyDoc = true;
    prevented = false;
    M.beforeUnload(evt);
    check(!prevented,
      "the demo's own dirt is not the user's — nothing of theirs is unsaved, so no guard fires");
    M.endTour();

    check(M.startTour(), "the tour starts again");
    M.commit("switched the demo to swimlanes", () => { M.state.layout = "swimlanes"; }, {render:"all"});
    const demoHistBefore = M.history.length, demoPendingBefore = M.historyPending;
    prevented = false;
    M.keydownHandler({key:"z", ctrlKey:true, shiftKey:false, preventDefault(){ prevented = true; }});
    check(prevented, "Ctrl+Z mid-tour still calls preventDefault, so the browser does not act on it either");
    eq(M.history.length, demoHistBefore,
      "…but it never reaches undo() — the demo's own history is untouched even though the "
      + "demo has something to undo");
    eq(M.historyPending, demoPendingBefore, "…and neither does its pending flag");

    M.endTour();
    const userPendingBefore = M.historyPending;
    prevented = false;
    M.keydownHandler({key:"z", ctrlKey:true, shiftKey:false, preventDefault(){ prevented = true; }});
    check(prevented, "Ctrl+Z still prevents default once the tour has ended");
    check(M.historyPending !== userPendingBefore,
      "…and now DOES reach the real undo() — historyPending flips exactly as undo() always "
      + "makes it, proving the shortcut is live again");
  });

  await guarded("16g completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    check(typeof M.commands.tour === "function", "COMMANDS.tour exists and is callable");
    check(M.classes.length === 0, "starting the tour is the first thing that touches the class log");
    await M.commands.tour();
    check(M.tourSaved !== null, "the command starts the tour — tourSaved is set");
    check(M.classes.length === 1 && M.classes[0].op === "add" && M.classes[0].cls === "tour-on",
      "…and body.tour-on was added exactly once — got " + JSON.stringify(M.classes));

    M.endTour();
    check(M.tourSaved === null, "endTour clears tourSaved");
    const last = M.classes[M.classes.length - 1];
    check(!!last && last.op === "remove" && last.cls === "tour-on",
      "…and the log's LAST entry is the remove — the two truths' writers sit adjacent, "
      + "got " + JSON.stringify(M.classes));

    const before = M.classes.length;
    M.setModalOpen(true);
    check(M.startTour() === false, "a modal open refuses the tour");
    check(M.classes.length === before, "…and the refusal left the class log exactly as it was");
    M.setModalOpen(false);
  });

  await guarded("16h completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    check(M.startTour(), "the tour starts");

    M.commit("switched the demo to swimlanes", () => { M.state.layout = "swimlanes"; }, {render:"all"});
    eq(M.dirtyDoc, true, "the demo's own commit dirties the demo");
    eq(M.history.length, 1, "…and grows the demo's own history");

    M.tourGoto(0);
    eq(M.dirtyDoc, false, "tourGoto(0) rebuilds a FRESH demo — clean");
    eq(M.history.length, 0, "…with an empty history — the demo commit is gone, not merely undone");
    eq(M.state.title, "Pearson Specter Litt", "…the demo's own literal title, not a stale copy");
    eq(M.state.layout, "pyramid",
      "…and the committed mutation itself is gone — replay-from-scratch, not undo, is the "
      + "mechanism that makes Back trivial");
    eq(M.tourStep, 0, "…and tourStep reads back the step just gone to");
  });

  await guarded("16i completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    check(M.startTour(), "the tour starts");
    eq(M.tourStep, 0, "…opening on step 0");
    eq(M.tourCount, 13, "…with all thirteen TOUR rows live — nothing here narrows a rect");
    eq(M.tourShown.length, 1, "…and showTourStep was called once, for step 0");
    eq(M.tourShown[0].pos, 0, "…recorded at position 0");
    eq(M.tourShown[0].count, 13, "…out of a live count of 13");

    const shownBefore = M.tourShown.length;
    M.clickTourBack();
    eq(M.tourStep, 0, "Back at step 0 is a no-op — tourStep does not move");
    eq(M.tourShown.length, shownBefore, "…and no rebuild is recorded — tourGoto was never called");

    for(let i = 1; i <= 12; i++){
      M.clickTourNext();
      eq(M.tourStep, i, "Next walks to step " + i);
    }
    eq(M.tourShown.slice(-2).map(s => s.pos).join(","), "11,12",
      "…the last two rebuilds recorded, in order, by position");

    const shownAtEnd = M.tourShown.length;
    M.clickTourNext();
    check(M.tourSaved === null, "Next at the last step (12) ends the tour instead of walking further");
    eq(M.tourShown.length, shownAtEnd,
      "…and does NOT call tourGoto — no further rebuild is recorded past the last step");
    const last = M.classes[M.classes.length - 1];
    check(!!last && last.op === "remove", "…and the class truth follows — the last write is the remove");

    check(M.startTour(), "the tour starts again");
    M.clickTourNext();
    eq(M.tourStep, 1, "…and has walked to step 1");
    M.clickTourX();
    check(M.tourSaved === null, "the X ends the tour from wherever it was, not only the last step");
  });

  await guarded("16j completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();
    check(M.startTour(), "the tour starts");

    let prevented = false;
    M.keydownHandler({key:"Escape", ctrlKey:false, metaKey:false, shiftKey:false,
      preventDefault(){ prevented = true; }});
    check(M.tourSaved === null, "Escape mid-tour ends the tour");
    check(!prevented,
      "…through endTour(), not through preventDefault() — Escape is left free to do whatever "
      + "else a browser does with it once the tour chrome is gone");

    const genBefore = M.history.length;
    let threw = false;
    try{
      M.keydownHandler({key:"a", ctrlKey:false, metaKey:false, shiftKey:false, preventDefault(){}});
    }catch(e){ threw = true; }
    check(!threw, "an ordinary key, not touring, passes through the gate without throwing");
    eq(M.history.length, genBefore, "…and reaches none of the tour's own branches — nothing moved");
  });

  await guarded("16k completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    const runnerAnchors = M.TOUR.filter(r => typeof r.run === "function")
      .map(r => r.anchor).sort();
    eq(runnerAnchors.join(","), ["#layoutBtn", "#nameLabelsBtn", "#pageBtn"].sort().join(","),
      "exactly the three demonstrated rows carry a run, by anchor SET — got "
      + JSON.stringify(runnerAnchors));

    check(M.startTour(), "the tour starts");

    M.tourGoto(7);
    eq(M.state.layout, "pyramid", "before the first run: layout is still the template's own");
    eq(M.state.page, "landscape", "…page is still the template's own");
    eq(M.state.nameLabelPosition, "next",
      "…and name label position is big4-green's own literal choice");

    M.tourGoto(8);
    eq(M.tourShown[M.tourShown.length - 1].anchor, "#layoutBtn",
      "confirmed by the anchor showTourStep was actually handed, not a recomputed position");
    eq(M.state.layout, "swimlanes", "the Layout run flips layout");
    eq(M.state.page, "landscape", "…and writes nothing else yet — page still untouched");
    eq(M.state.nameLabelPosition, "next", "…nor name label position");
    eq(M.history.length, 1, "…as exactly one commit so far");

    M.tourGoto(9);
    eq(M.tourShown[M.tourShown.length - 1].anchor, "#pageBtn",
      "confirmed by the anchor showTourStep was actually handed");
    eq(M.state.layout, "swimlanes", "…layout still swimlanes, from the earlier run");
    eq(M.state.page, "portrait", "the Page run turns the sample to portrait");
    eq(M.state.nameLabelPosition, "next", "…nor name label position, yet");
    eq(M.history.length, 2, "…two commits now, one per run so far");

    M.tourGoto(10);
    eq(M.tourShown[M.tourShown.length - 1].anchor, "#nameLabelsBtn",
      "confirmed by the anchor showTourStep was actually handed");
    eq(M.state.layout, "swimlanes", "…layout still swimlanes");
    eq(M.state.page, "portrait", "…page still portrait");
    eq(M.state.nameLabelPosition, "below", "the Name labels run moves labels below the photos");
    eq(M.history.length, 3, "…three commits, one per run, in row order");
    eq(M.dirtyDoc, true, "…and the demo is dirty");
    eq(M.state.accent, "#004225",
      "all three runs together wrote only their OWN fields — accent is still the template's "
      + "own literal");
    eq(M.state.title, "Pearson Specter Litt", "…and title too — the demo's own literal, untouched");

    M.tourGoto(9);
    eq(M.state.nameLabelPosition, "next",
      "stepping back across the Name-labels run reverts JUST it");
    eq(M.state.page, "portrait", "…the Page run's own field is untouched by that step back");
    eq(M.state.layout, "swimlanes", "…and so is the Layout run's");

    M.tourGoto(8);
    eq(M.state.page, "landscape", "stepping back across the Page run reverts JUST it");
    eq(M.state.layout, "swimlanes", "…the Layout run's own field is untouched by that step back");

    M.tourGoto(7);
    eq(M.state.layout, "pyramid", "stepping back across the Layout run reverts JUST it");
    eq(M.history.length, 0,
      "…with an empty history — replay-from-scratch discarded every commit, not undo");
  });

  await guarded("16l completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    M.setRect("#roster", {width:0, height:0});
    const live1 = M.tourLiveSteps();
    eq(live1.length, 12, "the roster step drops out of the live list — got " + live1.length);
    check(!live1.some(r => r.anchor === "#roster"), "…and #roster itself is the one missing");

    check(M.startTour(), "the tour starts with the roster step's anchor at zero");
    eq(M.tourCount, 12, "tourGoto's own count shrank to match the live list");
    eq(M.tourShown[M.tourShown.length - 1].count, 12,
      "…and showTourStep was handed the shrunk count, not TOUR.length");

    const lastAnchor = () => M.tourShown[M.tourShown.length - 1].anchor;
    let guard = 0;
    while(lastAnchor() !== '[data-cmd="groups"]' && guard++ < 20) M.clickTourNext();
    M.clickTourNext();
    eq(lastAnchor(), "#sheet",
      "Next from the groups step skips straight past the hidden roster step to #sheet — "
      + "got " + JSON.stringify(lastAnchor()));

    guard = 0;
    while(lastAnchor() !== "#layoutBtn" && guard++ < 20) M.clickTourNext();
    eq(M.state.layout, "swimlanes",
      "the run still fires once its own row comes up, at whatever position the skip left "
      + "it — being walked to by anchor, not by a fixed index, is the point");

    guard = 0;
    while(lastAnchor() !== '[data-cmd="tour"]' && guard++ < 20) M.clickTourNext();
    eq(M.tourStep, M.tourCount - 1, "…and that is the true last live position");
    M.clickTourNext();
    check(M.tourSaved === null,
      "Next at the true last live step ends the tour — a listener still comparing against "
      + "TOUR.length would re-enter tourGoto instead, clamp back to the same step, and never end");

    M.setRect("#layoutBtn", {width:0, height:0});
    check(M.startTour(), "the tour starts again with both anchors at zero");
    const live2 = M.tourLiveSteps();
    eq(live2.length, 11,
      "both the roster step and the Layout step are gone now — eleven remain — got "
      + live2.length);
    check(!live2.some(r => r.anchor === "#layoutBtn"), "…#layoutBtn itself is the second missing row");
    for(let i = 0; i < live2.length; i++){
      M.tourGoto(i);
      check(M.state.layout === "pyramid",
        "layout stays pyramid at live position " + i + " — the Layout row never shows, so its "
        + "run never fires — got " + M.state.layout);
    }
    eq(M.state.page, "portrait",
      "…yet the Page run still fires once its own (still-live) row is reached — hiding one "
      + "run's row does not skip the others");
    eq(M.state.nameLabelPosition, "below",
      "…and so does the Name-labels run, for the same reason");
    M.endTour();

    M.setRect("#roster", {width:100, height:24});
    M.setRect("#layoutBtn", {width:100, height:24});
    eq(M.tourLiveSteps().length, 13, "restoring both rects brings the live list back to thirteen");
  });

  await guarded("16m completes without throwing", async () => {
    const M = makeModule();
    M.state = M.defaults();
    M.state.tiers = sixGrades();

    check(M.neverSavedBar.hidden, "a clean untitled document keeps the bar hidden");
    M.markDirty();
    check(!M.neverSavedBar.hidden,
      "baseline: a dirty, unnamed user document shows the never-saved bar");

    check(M.startTour(), "the tour starts with the user's document dirty and unnamed");
    M.updateDocLabel();
    check(M.neverSavedBar.hidden,
      "mid-tour, before the demo has any dirt of its own, the bar is hidden — the LIVE "
      + "docName/dirtyDoc read here are the demo's, not the user's");

    M.tourGoto(8);
    M.updateDocLabel();
    eq(M.dirtyDoc, true, "the demo's own run commit dirties the demo");
    eq(M.docName, "", "…and the demo has no filename either — the never-saved SHAPE, exactly");
    check(M.neverSavedBar.hidden,
      "…yet the bar stays hidden — !tourSaved is what keeps the demo's own dirt from reading "
      + "as the user's unsaved work");

    M.endTour();
    M.updateDocLabel();
    check(!M.neverSavedBar.hidden,
      "ending the tour restores the user's dirty, unnamed document, and the bar reappears "
      + "the moment tourSaved clears");
  });

}

function report(){
  if(failures.length){
    console.log("FAILURES (" + failures.length + "):");
    failures.forEach(f => console.log("  ✗ " + f));
    console.log("\n" + passed + " passed, " + failures.length + " FAILED");
    if(typeof process !== "undefined") process.exit(1);
  }else{
    console.log("all " + passed + " document assertions passed");
  }
}

const pending = runSuite().then(report, e => {

  failures.push("the suite threw before finishing: " + ((e && e.message) || e));
  report();
});
