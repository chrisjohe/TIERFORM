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

const ROOT   = here();
const HTML   = readFile(ROOT + "tierform_app.html");
const SCRIPT = /<script>([\s\S]*)<\/script>/.exec(HTML)[1];

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
  if(start < 0) throw new Error("fixtures: function " + name + " not found — was it renamed?");
  let depth = 0;
  for(let j = MASK.indexOf("{", start); j < MASK.length; j++){
    if(MASK[j] === "{") depth++;
    else if(MASK[j] === "}" && !--depth) return SCRIPT.slice(start, j + 1);
  }
  throw new Error("fixtures: unbalanced braces reading " + name);
}
function grabConst(name){
  const m = new RegExp("(^|\\n)(?:const|let)\\s+" + name + "\\s*=").exec(MASK);
  if(!m) throw new Error("fixtures: const " + name + " not found — was it renamed?");
  const start = m.index + (m[1] ? 1 : 0);
  let depth = 0;
  for(let j = start; j < MASK.length; j++){
    const c = MASK[j];
    if("{[(".includes(c)) depth++;
    else if("}])".includes(c)) depth--;
    else if(c === ";" && depth === 0) return SCRIPT.slice(start, j + 1);
  }
  throw new Error("fixtures: unterminated const " + name);
}

const PREAMBLE = `
  let state = null;
  const meas = { font: "", measureText(t){
    const m = /([\\d.]+)px/.exec(this.font);
    return {width: String(t == null ? "" : t).length * (m ? parseFloat(m[1]) : 12) * 0.5};
  }};
  const document = {
    createElement(){ return {width:0, height:0, getContext(){ return meas; }, toDataURL(){ return "data:,"; }}; },
    getElementById(){ return {textContent: ""}; }
  };
`;
const M = new Function(PREAMBLE +
  ["FONT","FONTS","PAGES","ANGLES","DENSITY","G","SW","HV","MX","ZOOM_MAX","uid","LIMITS","ENUMS","ANCHORS","HEX6"]
    .map(grabConst).join("\n") + "\n" +
  ["xmlText","xmlAttr","paint","validatePhoto","isPlainObject","clampText","oneOf",
   "validColour","parseAndValidateRoster",
   "splitName","initials","tierOf","tierRole","subline","withAlpha","angleIndex",
   "codeParts","frameRect","frameLimit","clampFrame","normalizeGradeLinks",

   "computeLayout","gradeHeadingTexts",
   "buildBandGroups","buildBandStack","emitHeaderTexts","emitBandPeople",
   "computeTriangleLayout","computeHistogramLayout",
   "computePyramidLayout","computeTornadoLayout","computeSwimlaneLayout",
   "computeHiveLayout","computeMatrixLayout",
   "nameSegs","ellipsize","fitName","toSVG",

   "personLabelWidth","headNeedWidth","docFont",

   "newGroup","resolveGroupId","groupLabel","pruneGroups"]
   .map(grabFn).join("\n") + "\n" +
  "return {computeLayout, computePyramidLayout, computeTornadoLayout, computeHistogramLayout, computeSwimlaneLayout, computeHiveLayout, computeMatrixLayout," +
  " meas, toSVG, angleIndex, parseAndValidateRoster," +
  " validatePhoto, tierRole, groupLabel, resolveGroupId, setState(s){ state = s; }};")();


let passed = 0;
const failures = [];
const check = (c, m) => { if(c) passed++; else failures.push(m); };
const eq = (a, b, m) => check(a === b, m + " — got " + JSON.stringify(a) + ", want " + JSON.stringify(b));

function load(name){ return readFile(ROOT + "test/fixtures/" + name + ".json"); }
function parsed(name){ return JSON.parse(load(name)); }

function fresh(name){
  const r = M.parseAndValidateRoster(load(name));
  if(!r.ok) throw new Error(name + ".json no longer opens: " + r.reason);
  return r.state;
}

const VALID   = ["current","legacy","pyramid-zero","unicode","photos"];
const HOSTILE = ["bad-refs","bad-values","injection"];

try{

  {

    const bodyOf = (src) => {
      const mask = maskLiterals(src);
      const open = mask.indexOf("{");
      if(open < 0) return null;
      let depth = 0;
      for(let j = open; j < mask.length; j++){
        if(mask[j] === "{") depth++;
        else if(mask[j] === "}" && !--depth) return src.slice(open, j + 1);
      }
      return null;
    };

    const sample = 'a\n"b{c"\n/* d */\n';
    eq(maskLiterals(sample).length, sample.length,
      "the mask is the same length as the source");
    eq(maskLiterals(sample).split("\n").length, sample.split("\n").length,
      "and keeps every newline, so a line number means the same thing in both");

    const cases = [
      ["a brace in a line comment",
       'function f(){ // an unpaired { in prose\n  return 1;\n}',
       '{ // an unpaired { in prose\n  return 1;\n}'],

      ["a brace in a block comment",
       'function f(){\n  /* an unpaired { in\n     prose */\n  return 1;\n}',
       '{\n  /* an unpaired { in\n     prose */\n  return 1;\n}'],
      ["a brace in a double-quoted string",
       'function f(){ const s = "an unpaired { in a string"; return s; }',
       '{ const s = "an unpaired { in a string"; return s; }'],
      ["a brace in a single-quoted string",
       "function f(){ const s = 'an unpaired { in a string'; return s; }",
       "{ const s = 'an unpaired { in a string'; return s; }"],
      ["a brace in a template literal",
       'function f(){ const s = `an unpaired { in a template`; return s; }',
       '{ const s = `an unpaired { in a template`; return s; }'],
      ["an escaped quote inside a string",
       'function f(){ const s = "a quote \\" and an unpaired {"; return s; }',
       '{ const s = "a quote \\" and an unpaired {"; return s; }'],
      ["a ${} substitution holding an object literal",
       'function f(){ const s = `x${ {a:1}.a }y`; return s; }',
       '{ const s = `x${ {a:1}.a }y`; return s; }'],

      ["a backtick inside a string inside a substitution",
       'function f(){ const s = `x${ "a`b" }y{`; return s; }',
       '{ const s = `x${ "a`b" }y{`; return s; }'],

      ["quotes inside a regex literal",
       'function f(){ const a = s.replace(/"/g, "x"); if(b){ return "y"; } return 1; }',
       '{ const a = s.replace(/"/g, "x"); if(b){ return "y"; } return 1; }'],

      ["a division, which is not a regex",
       'function f(){ const h = w / 2; if(h){ return 1 / 2; } return 0; }',
       '{ const h = w / 2; if(h){ return 1 / 2; } return 0; }']
    ];
    for(const [what, src, want] of cases)
      eq(bodyOf(src), want, "the mask sees past " + what);

    const constOf = (src) => {
      const mask = maskLiterals(src);
      let depth = 0;
      for(let j = 0; j < mask.length; j++){
        const c = mask[j];
        if("{[(".includes(c)) depth++;
        else if("}])".includes(c)) depth--;
        else if(c === ";" && depth === 0) return src.slice(0, j + 1);
      }
      return null;
    };
    eq(constOf('const X = /^data:([A-Za-z0-9+/]+={0,2})$/.exec(s); const Y = 2;'),
       'const X = /^data:([A-Za-z0-9+/]+={0,2})$/.exec(s);',
      "a \"/\" inside a regex character class does not end the regex");
    eq(constOf('const X = { a: "; not the end", b: 2 }; const Y = 2;'),
       'const X = { a: "; not the end", b: 2 };',
      "and a \";\" inside a string does not end a declaration");

    const copyOf = (file) => {
      const t = readFile(ROOT + "test/" + file);
      const a = t.indexOf("function maskLiterals(src){");
      const b = a < 0 ? -1 : t.indexOf("\n}\n", a);
      return a < 0 || b < 0 ? null : t.slice(a, b + 2);
    };
    const running = maskLiterals.toString();

    check(running.length > 1000 && /REWORD/.test(running) && /stack\.pop\(\)/.test(running),
      "the function that answered the cases above is the whole mask — got "
      + running.length + " chars");
    for(const file of ["harness.js", "fixtures.js", "document.js", "import.js"])
      check(copyOf(file) === running,
        "test/" + file + " carries that same maskLiterals, character for character"
        + " — a copy that drifts is a suite counting braces by different rules");
  }

  function nonFinite(L){
    const bad = [];
    L.bands.forEach((b, i) => b.pts.forEach(q => {
      if(!isFinite(q[0]) || !isFinite(q[1])) bad.push("band[" + i + "]");
    }));
    L.avatars.forEach((a, i) => {
      if(!isFinite(a.cx) || !isFinite(a.cy) || !isFinite(a.r)) bad.push("avatar[" + i + "]");
      if(a.img && !["x","y","w","h"].every(k => isFinite(a.img[k]))) bad.push("avatar[" + i + "].img");
    });
    L.texts.forEach((t, i) => {
      if(!isFinite(t.x) || !isFinite(t.y)) bad.push("text[" + i + "]");
    });
    ["tx","ty","s"].forEach(k => { if(!isFinite(L.fit[k])) bad.push("fit." + k); });
    if(!isFinite(L.natW) || !isFinite(L.natH)) bad.push("natW/natH");
    return bad;
  }

  for(const name of VALID.concat(HOSTILE)){
    const opened = M.parseAndValidateRoster(load(name));

    if(!opened.ok){
      check(typeof opened.reason === "string" && opened.reason.length > 0,
        name + ".json is refused with a stated reason");
      continue;
    }
    let L = null, err = null;
    try{ M.setState(opened.state); L = M.computeLayout(opened.state); }
    catch(e){ err = e.message; }
    check(!err, "computeLayout survives " + name + ".json" + (err ? " — threw: " + err : ""));
    if(L){
      const bad = nonFinite(L);
      check(bad.length === 0, "no NaN geometry from " + name + ".json"
        + (bad.length ? " — " + bad.slice(0, 4).join(", ") : ""));
      check(L.bands.length > 0, name + ".json renders at least the header band");
      let svg = null;
      try{ svg = M.toSVG(L); }catch(e){ err = e.message; }
      check(svg && svg.indexOf("<svg") === 0 && svg.indexOf("</svg>") > 0,
        name + ".json produces a well-formed SVG envelope");
      check(!/NaN|undefined|Infinity/.test(svg || ""),
        name + ".json emits no NaN/undefined/Infinity into the SVG");
    }
  }

  {
    const st = fresh("legacy");

    check(st.tiers.every(t => t.style === undefined),
          "legacy: a property this build has no meaning for is dropped, not kept");
    check(st.tiers.every(t => t.fill === "green" || t.fill === "white"),
          "legacy: every grade comes out with a known fill");
    check(st.tiers.every(t => typeof t.attach === "boolean"), "legacy: attach is boolean everywhere");
    check(st.tiers.every(t => typeof t.merge === "boolean"),  "legacy: merge is boolean everywhere");
    check(st.tiers.every(t => !!t.align), "legacy: every grade has an alignment");

    check(st.tiers.every(t => !!M.tierRole(t)), "legacy: every grade still prints a title");
    check(st.tiers.every(t => t.role === undefined),
          "legacy: no grade carries a title of its own");
    check(st.tiers.every(t => M.tierRole(t) === t.label),
          "legacy: and the title a grade prints is exactly its name");

    eq(st.tiers.length, parsed("legacy").tiers.length,
       "legacy: it opens with the grades it states, no more and no fewer");
    eq(st.tiers.map(t => t.code).join(","), parsed("legacy").tiers.map(t => t.code).join(","),
       "legacy: with their codes untouched and in their own order");

    const bea = st.people.find(p => p.name === "Bea Brandt");
    check(bea && bea.role === "(Senior) Assistant",
          "legacy: a person's stated role is carried through exactly");

    for(const p of st.people){
      if(p.photo){
        eq(p.pw, 240, "legacy: " + p.name + " gets the default photo width");
        eq(p.ph, 240, "legacy: " + p.name + " gets the default photo height");
        check(p.frame && p.frame.zoom === 1 && p.frame.ox === 0 && p.frame.oy === 0,
              "legacy: " + p.name + " gets the neutral frame");
      }else{
        eq(p.pw, 0, "legacy: photoless " + p.name + " has zero width");
        check(p.frame === null, "legacy: photoless " + p.name + " has no frame");
      }
    }

    eq(st.angle, 2, "legacy: a non-number angle (\"subtle\") falls back to 2");
    check(st.page && st.density && st.bg && st.inkOnColour && st.inkOnWhite,
          "legacy: the fields that did not exist yet were filled in");
    eq(st.layout, "pyramid", "legacy: a file that states no layout opens as a pyramid");
  }

  {
    const st = fresh("pyramid-zero");
    eq(st.angle, 0, "angle: 0 survives opening — a flat chart stays flat");

    const again = M.parseAndValidateRoster(JSON.stringify(st));
    check(again.ok && again.state.angle === 0, "angle: 0 survives a second open");

    const falsyIn = {
      tiers: [{id:"t1", code:"P", label:"P", fill:"green",
               attach:false, merge:false, align:"center"}],
      people: [],
      angle: 0, title: "", brand: "", accent: "#000000",
      bg: "transparent", ring: "none", page: "portrait", density: "tight",
      inkOnColour: "#000000", inkOnWhite: "#FFFFFF"
    };
    const falsyOut = M.parseAndValidateRoster(JSON.stringify(falsyIn));
    check(falsyOut.ok, "a document of deliberately falsy values opens"
      + (falsyOut.ok ? "" : " — refused: " + falsyOut.reason));
    const falsy = falsyOut.ok ? falsyOut.state : {};
    eq(falsy.angle, 0, "a zero angle is not replaced by the default");
    eq(falsy.bg, "transparent", "a non-default background is not replaced");
    eq(falsy.page, "portrait", "a non-default page is not replaced");
    eq(falsy.density, "tight", "a non-default density is not replaced");
    eq(falsy.accent, "#000000", "black is a colour, not a missing value");
    eq(falsy.inkOnColour, "#000000", "black ink on the accent survives");
  }

  {
    const open = (tierRole, personRole) => {
      const t = {id:"t1", code:"P", label:"Partner", fill:"green",
                 attach:false, merge:false, align:"center"};
      if(tierRole !== undefined) t.role = tierRole;
      return M.parseAndValidateRoster(JSON.stringify({
        tiers:[t],
        people:[{id:"p1", name:"Ada", tierId:"t1", role:personRole, office:"",
                 photo:null, pw:0, ph:0, frame:null}]
      }));
    };

    const own = open("Partner (Equity)", "Founder");
    check(own.ok && own.state.people[0].role === "Founder",
      "a person's own role is carried through exactly, whatever the grade said");

    eq(M.tierRole({label:"Partner", role:"Partner (Equity)"}), "Partner",
       "tierRole reads the grade's name and ignores any role left on the object");
    eq(M.tierRole({label:"Partner"}), "Partner", "with or without one there");
    eq(M.tierRole(null), "", "and a missing grade prints nothing rather than throwing");

    const st = open(undefined, "");
    if(st.ok){
      st.state.tiers[0].label = "Partners";
      eq(M.tierRole(st.state.tiers[0]), "Partners",
         "renaming the grade moves the printed title with it");
    }
  }

  const shape = (st) => {
    const at = {};
    const tiers = st.tiers.map((t, i) => {
      at[t.id] = i;
      const c = Object.assign({}, t); delete c.id; return c;
    });

    const gat = {};
    const groups = (st.groups || []).map((g, i) => {
      gat[g.id] = i;
      const c = Object.assign({}, g); delete c.id; return c;
    });
    const people = st.people.map(p => {
      const c = Object.assign({}, p); delete c.id; c.tierId = at[p.tierId];
      c.groupId = p.groupId == null ? null : gat[p.groupId];
      return c;
    });
    return JSON.stringify(Object.assign({}, st, {tiers: tiers, groups: groups, people: people}));
  };
  for(const name of VALID.concat(HOSTILE)){
    const once = M.parseAndValidateRoster(load(name));
    if(!once.ok) continue;
    const twice = M.parseAndValidateRoster(JSON.stringify(once.state));
    check(twice.ok, name + ".json reopens after a round trip"
      + (twice.ok ? "" : " — refused: " + twice.reason));
    if(twice.ok){
      eq(shape(twice.state), shape(once.state),
        "opening " + name + ".json twice gives the same document");

      eq(twice.repaired.length, 0,
        "and the second open finds nothing to repair in " + name + ".json — got "
        + JSON.stringify(twice.repaired));
    }
  }

  for(const [input, want] of [[0,0],[1,1],[2,2],[3,3],[4,4],
                              [-5,0],[42,4],[2.4,2],[2.6,3]]){
    eq(M.angleIndex(input), want, "angleIndex(" + JSON.stringify(input) + ")");
  }
  for(const input of ["off","subtle","strong","anything-else",undefined,null,{},[]]){
    eq(M.angleIndex(input), 2, "angleIndex(" + JSON.stringify(input) + ") falls back to 2 — no word is recognised");
  }

  {

    function selMatch(n, sel){
      const m = /^(?:\.([A-Za-z0-9_-]+))?((?:\[[a-z-]+="[^"]*"\])*)$/.exec(sel);
      if(!m || (!m[1] && !m[2])) throw new Error("stub querySelector: unsupported selector " + sel);
      if(m[1] && (" " + n.className + " ").indexOf(" " + m[1] + " ") < 0) return false;
      return (m[2].match(/\[[a-z-]+="[^"]*"\]/g) || []).every(function(a){
        const kv = /^\[([a-z-]+)="([^"]*)"\]$/.exec(a);
        const key = kv[1].replace(/^data-/, "").replace(/-([a-z])/g, (s, c) => c.toUpperCase());
        return n.dataset[key] === kv[2];
      });
    }
    function node(tag){
      return {
        tagName: tag, children: [], dataset: {}, attrs: {}, style: {},
        className: "", textContent: "", value: "", checked: false,
        disabled: false, selected: false, src: "", title: "", placeholder: "",
        selectionStart: 0, selectionEnd: 0,
        appendChild(c){ this.children.push(c); return c; },
        setAttribute(k, v){ this.attrs[k] = String(v); },
        get firstChild(){ return this.children[0]; },
        removeChild(c){ this.children.splice(this.children.indexOf(c), 1); return c; },
        querySelector(sel){
          for(const c of this.children){
            if(selMatch(c, sel)) return c;
            const deep = c.querySelector && c.querySelector(sel);
            if(deep) return deep;
          }
          return null;
        }
      };
    }
    const DOC = `
      const document = {
        activeElement: null,          // nothing is focused in the stub
        /* syncRowIdentity reaches for the whole document now, not for #roster:
           the name is typed in a dialog and the things named after the person
           are spread across the row behind it, the menu its caret opens and the
           dialog's own photo section. So the stub's "document" is those three
           trees, searched in turn — a querySelector that always returned null
           would let every relabelling assertion below pass by finding nothing. */
        querySelector(sel){
          for(const k of ["roster", "tiers", "personMenu", "editPhoto"]){
            const hit = HOSTS[k] && HOSTS[k].querySelector(sel);
            if(hit) return hit;
          }
          return null;
        },
        createElement: makeNode,
        createElementNS(ns, tag){ const n = makeNode(tag); n.ns = ns; return n; },
        createTextNode(t){ const n = makeNode("#text"); n.textContent = t; return n; },
        getElementById(){ return {textContent: ""}; }
      };
      /* The Add people dialog's three availability targets. renderRoster reaches
         them through syncStructureAvailability on every render, so they have to
         exist and take a write — but this suite asserts the roster tree, not the
         dialog, so that is all they do. test/document.js owns what gets written.
         Neither dialog has a standing default to stub: both build their grade
         list when they open, so a render touches neither of them. At zero
         grades syncAddAvailability disables nothing; it toggles which half of
         the Grade row is on screen, so the three targets are the row's own two
         fields plus the Templates escape hatch beside them. */
      const HOSTS = {roster: makeNode("div"), tiers: makeNode("div"),
                     personMenu: makeNode("div"), editPhoto: makeNode("div"),
                     /* The Edit dialog's four fields are static markup in the app,
                        so they are nodes here rather than builders: syncEditModal
                        WRITES them, and a grade renamed under an open dialog has
                        to reach the grade list and the role placeholder inside
                        it — which is the regression this section was written for,
                        one box along. */
                     editName: makeNode("input"), editGroup: makeNode("input"),
                     editRole: makeNode("input"), editTier: makeNode("select"),
                     addTierField: {hidden: false}, addFirstGradeField: {hidden: true},
                     addTemplateHint: {hidden: true},
                     /* The roster search row and its three controls. rosterCount
                        and rosterSearch are nodes because renderRoster writes
                        .textContent and clearRosterSearch writes .value; the row
                        and the clear button are plain {hidden} objects, exactly
                        like addTierField above, since nothing but their
                        visibility is ever read. */
                     rosterSearchRow: {hidden: false}, rosterCount: makeNode("p"),
                     rosterSearch: makeNode("input"), rosterSearchClear: {hidden: false}};
      function $(sel){
        if(sel === "#roster")     return HOSTS.roster;
        if(sel === "#tiers")      return HOSTS.tiers;
        if(sel === "#personMenu") return HOSTS.personMenu;
        if(sel === "#editPhoto")  return HOSTS.editPhoto;
        if(sel === "#editName")   return HOSTS.editName;
        if(sel === "#editGroup")  return HOSTS.editGroup;
        if(sel === "#editRole")   return HOSTS.editRole;
        if(sel === "#editTier")   return HOSTS.editTier;
        if(sel === "#addTierField")      return HOSTS.addTierField;
        if(sel === "#addFirstGradeField")return HOSTS.addFirstGradeField;
        if(sel === "#addTemplateHint")   return HOSTS.addTemplateHint;
        if(sel === "#rosterSearchRow")   return HOSTS.rosterSearchRow;
        if(sel === "#rosterCount")       return HOSTS.rosterCount;
        if(sel === "#rosterSearch")      return HOSTS.rosterSearch;
        if(sel === "#rosterSearchClear") return HOSTS.rosterSearchClear;
        return null;                            // every other lookup is not this test's business
      }
      /* Ribbon overflow is covered by test/dom.js. This fixture isolates the
         roster tree, so layout measurement is deliberately a no-op here. */
      function syncRibbonOverflow(){}
      const meas = { font: "", measureText(t){ return {width: String(t||"").length * 6}; }};
      /* The search never touches state — no commit(), no edit(), no
         snapshot() — and none of the grabbed functions call any of the three
         today either, so these stubs only ever count something if a search
         path starts reaching one. Not grabbed from the app: a real commit()
         needs history and photoStore machinery this fixture has no reason to
         build, and the whole point here is a counter that goes red rather
         than one that throws when a mutation adds a call. */
      let historyWrites = 0;
      function commit(){ historyWrites++; }
      function edit(){ historyWrites++; }
      function snapshot(){ historyWrites++; }
    `;
    const R = new Function("makeNode",
      DOC +

      ["ZOOM_MAX","ENUMS","LIMITS","HEX6","SVGNS","uid","LAYOUTS"].map(grabConst).join("\n") + "\n" +
      ["validatePhoto","oneOf","clampText","isPlainObject","initials","codeParts","tierRole",
       "frameRect","frameLimit","clampFrame","normalizeGradeLinks","el","icon","clear","fill","fillTierOptions",
       "personLabel","framePanel","syncFramePreview","placeFramePreview",

       "notAvailableIn",

       "gradeName","moveTarget","moveAffordance","personRowName","personRow","personMenuBody",

       "rosterFiltered","personMatches","clearRosterSearch",

       "editPhotoBody","syncEditPhoto","editPerson",

       "syncRowIdentity",
       "gradeChip","gradePanelBody",
       "focusedField","restoreField","syncGradePanel",

       "setCommandDisabled","syncAddAvailability","syncStructureAvailability",

       "syncPersonMenu","syncEditModal","renderRoster",

       "newGroup","resolveGroupId","groupLabel","pruneGroups"]
        .map(grabFn).join("\n") + "\n" +
      grabConst("PREVIEW_R") + "\n" +

      "let state = null, gradeOpen = null, personOpen = null, editId = null, rosterQuery = \"\";\n" +

      "return {HOSTS, LAYOUTS, render(s, open){ state = s; this.shut(); renderRoster(); if(open) this.menu(s, open); },\n" +
      "        menu(s, id){ state = s; personOpen = id;\n" +
      "          return fill(HOSTS.personMenu, [personMenuBody(state.people.find(p=>p.id===id))]); },\n" +
      "        photo(s, id){ state = s; editId = id;\n" +
      "          return fill(HOSTS.editPhoto, [editPhotoBody(state.people.find(p=>p.id===id))]); },\n" +
      "        dialog(s, id){ state = s; editId = id; syncEditModal(); },\n" +
      "        shut(){ personOpen = null; editId = null; clear(HOSTS.personMenu); clear(HOSTS.editPhoto); },\n" +
      "        sync(p){ return syncRowIdentity(p); },\n" +
      "        panel(s, i){ state = s; return fill(el('div'), [gradePanelBody(s.tiers[i], i)]); },\n" +

      "        query(v){ rosterQuery = v; },\n" +
      "        writes(){ return historyWrites; }};"
    )(node);

    function walk(n, fn){ fn(n); for(const c of n.children) walk(c, fn); }
    function collect(n, pick){
      const out = [];
      walk(n, x => { const v = pick(x); if(v != null && v !== "") out.push(v); });
      return out;
    }

    const st = fresh("injection");
    R.render(st, null);
    const roster = R.HOSTS.roster, tiers = R.HOSTS.tiers;

    check(roster.children.length > 0, "the roster panel builds something for injection.json");
    check(tiers.children.length === st.tiers.length,
      "one grade card per grade — got " + tiers.children.length + ", want " + st.tiers.length);

    {
      const zero = Object.assign({}, st, {tiers: []});
      R.render(zero, null);
      const kids = R.HOSTS.tiers.children;
      eq(kids.length, 1,
        "zero grades: #tiers holds exactly one placeholder — got " + kids.length);
      const ph = kids[0];
      check(ph && ph.className === "tiers-empty",
        "…carrying the tiers-empty class — got " + JSON.stringify(ph && ph.className));
      eq(ph && ph.textContent, "No grades yet. Add one, or apply a template.",
        "…with the exact placeholder wording");
      check(ph && !("aria-hidden" in (ph.attrs || {})),
        "…and no aria-hidden — a screenreader should read the state");

      const rule = /\.empty,\.tiers-empty\{([^}]*)\}/.exec(HTML);
      check(!!rule, "the .empty / .tiers-empty rule is found in the stylesheet");
      check(rule && rule[1].indexOf("color:var(--mute)") >= 0,
        "…and it genuinely carries the roster's own .empty declaration, not a "
        + "lookalike copy — got " + JSON.stringify(rule && rule[1]));

      R.render(st, null);
      check(R.HOSTS.tiers.children.every(c => c.className !== "tiers-empty"),
        "with grades present, no placeholder is emitted");
    }

    const acts = collect(roster, x => x.dataset.act);
    for(const verb of ["menu","addTo"]){
      check(acts.indexOf(verb) >= 0, "the roster emits data-act=\"" + verb + '"');
    }
    for(const verb of ["photo","name","toggle","done","up","down","del","tier","office","role"]){
      check(acts.indexOf(verb) < 0,
        'the roster does NOT emit data-act="' + verb + '" — that control left the row');
    }

    {
      const rows = collect(roster, x => /\bp-row\b/.test(String(x.className||"")) ? x : null);
      eq(rows.length, st.people.length, "one row per person");
      for(const r of rows){
        const buttons = collect(r, x => x.tagName === "button" ? x : null);
        eq(buttons.length, 1, "a row holds exactly one button");
        eq(buttons[0] && buttons[0].dataset.act, "menu", "…and it is the caret");
        eq(collect(r, x => x.tagName === "input" ? x : null).length, 0,
          "…and no input at all");
        eq(collect(r, x => /\bthumb\b/.test(String(x.className||"")) ? x : null).length, 1,
          "…beside one thumbnail");
        const thumb = collect(r, x => /\bthumb\b/.test(String(x.className||"")) ? x : null)[0];
        eq(thumb && thumb.tagName, "span", "…which is a span, not a button");
        eq(thumb && thumb.attrs["aria-hidden"], "true", "…and is hidden from the accessibility tree");
      }
    }

    {

      const UNITS = {};
      for(const name of ["rowDragSurface", "gradeDragSurface"]){
        const stmt = new RegExp("const " + name + " = makeDragSurface\\(\\{[\\s\\S]*?\\n\\}\\);").exec(HTML);
        const rootM = stmt && /root:\s*"#([a-z]+)"/.exec(stmt[0]);
        const selM  = stmt && /itemSelector:\s*"\.([a-z-]+)"/.exec(stmt[0]);
        if(rootM && selM) UNITS[rootM[1]] = selM[1];
      }
      const hosts = Object.keys(UNITS);
      check(hosts.length >= 2,
        "the app wires at least two dragstart handlers, each naming its drag unit — got "
        + JSON.stringify(UNITS));

      for(const host of hosts){
        const root = R.HOSTS[host];
        check(!!root, 'the rendered tree includes #' + host
          + ", which the app binds a dragstart handler to");
        if(!root) continue;

        const want = UNITS[host];
        const handles = [];
        (function descend(n, unit){
          const cls = " " + String(n.className || "") + " ";
          if(cls.indexOf(" " + want + " ") >= 0) unit = n;
          if(n.draggable === true) handles.push({cls: String(n.className || ""), unit: unit});
          for(const c of n.children) descend(c, unit);
        })(root, null);

        check(handles.length > 0,
          "#" + host + " renders at least one draggable handle — otherwise every "
          + "assertion below passes by finding nothing");
        for(const h of handles){
          check(!!h.unit, "the draggable ." + h.cls + " in #" + host
            + " sits inside the ." + want + " its dragstart reaches for");
          check(!!(h.unit && h.unit.dataset && h.unit.dataset.id),
            "…and that ." + want + " carries data-id — without it the drag knows "
            + "what was grabbed and not who, and nothing lifts at all");
        }
      }

      const unitIds = (host, sel) => {
        const out = [];
        (function descend(n, unit){
          if((" " + String(n.className || "") + " ").indexOf(" " + sel + " ") >= 0) unit = n;
          if(n.draggable === true && unit && unit.dataset) out.push(unit.dataset.id);
          for(const c of n.children) descend(c, unit);
        })(R.HOSTS[host], null);
        return out.filter((v, k) => out.indexOf(v) === k);
      };
      const rowIds = unitIds("roster", UNITS.roster);
      check(rowIds.length > 0 && rowIds.every(id => st.people.some(p => p.id === id)),
        "each roster drag unit names a person in the fixture — got " + JSON.stringify(rowIds));
      const chipIds = unitIds("tiers", UNITS.tiers);
      check(chipIds.length > 0 && chipIds.every(id => st.tiers.some(t => t.id === id)),
        "and each strip drag unit names a grade in the fixture — got " + JSON.stringify(chipIds));
    }

    {
      const adds = collect(roster,
        x => x.dataset.act === "addTo" ? {id:x.dataset.id, cls:x.className,
                                          label:x.attrs["aria-label"], kids:x.children.length}
                                       : null);

      const peopled = st.tiers.filter(t => st.people.some(p => p.tierId === t.id));
      check(peopled.length > 0, "injection.json has at least one grade with people in it");
      eq(adds.length, peopled.length,
        "one \"+\" per group heading, and none for an empty grade — got "
        + adds.length + ", want " + peopled.length);
      check(adds.every(a => peopled.some(t => t.id === a.id)),
        "each one carries the id of a grade that actually has a heading");

      for(const a of adds){
        const t = peopled.find(x => x.id === a.id) || {};
        eq(a.label, "Add someone to " + t.label,
          "…and names that grade in its accessible name");
        eq(a.kids, 1, "…and holds exactly one icon");
      }
      check(adds.every(a => /\bth-add\b/.test(a.cls)),
        "…and carries the heading class the stylesheet centres it with");
    }

    const tacts = collect(tiers, x => x.dataset.tact)
      .concat(st.tiers.map((t, i) => collect(R.panel(st, i), x => x.dataset.tact))
                      .reduce((a, b) => a.concat(b), []));
    for(const verb of ["code","label","fill","align","attach","merge","up","down","del"]){
      check(tacts.indexOf(verb) >= 0, 'the grade editor emits data-tact="' + verb + '"');
    }

    const evilName = '<script>alert("name")</script>';
    const rowTexts = collect(roster, x => x.textContent);
    eq(rowTexts.filter(v => v === evilName).length, 1,
      "the hostile name appears once, as the row's text");
    eq(collect(roster, x => x.value).filter(v => v === evilName).length, 0,
      "…and not as an input value, because the row has no input to hold one");
    check(collect(roster, x => x.tagName === "script" ? "script" : null).length === 0,
      "no script element was constructed from roster text");

    const srcs = collect(roster, x => x.src);
    for(const s of srcs){
      check(/^data:image\/(jpeg|png);base64,/.test(s),
        "a thumbnail src is an embedded image, not a URL — got " + String(s).slice(0, 40));
    }

    const withPhoto = st.people.find(p => p.photo);
    check(!!withPhoto, "injection.json still has one person with a usable photo");
    if(withPhoto){
      const menuActs = collect(R.menu(st, withPhoto.id), x => x.dataset.act);
      for(const verb of ["edit","up","down","del"]){
        check(menuActs.indexOf(verb) >= 0, 'the row menu emits data-act="' + verb + '"');
      }
      eq(menuActs.length, 4, "and nothing else — four items, four verbs");
      const roles = collect(R.HOSTS.personMenu, x => x.attrs["role"]);
      eq(roles.filter(r => r === "menuitem").length, 4,
        "each of the four is announced as a menu item");

      const facts = collect(R.photo(st, withPhoto.id), x => x.dataset.fact);
      for(const verb of ["pan","zoom","reset","replace","remove"]){
        check(facts.indexOf(verb) >= 0, 'the framing editor emits data-fact="' + verb + '"');
      }
      check(collect(R.HOSTS.editPhoto, x => x.dataset.act).indexOf("photo") < 0,
        "…and offers no Add photo beside it — there is already one to work on");

      const openNames = collect(R.HOSTS.editPhoto, x => x.attrs["aria-label"])
        .concat(collect(R.HOSTS.personMenu, x => x.attrs["aria-label"]));
      const whoLabel = (withPhoto.name && withPhoto.name.trim()) || "the unnamed person";
      check(openNames.indexOf(
              "Remove " + whoLabel + "'s photo, leaving " + whoLabel + "'s initials") >= 0,
        "Remove photo says what is left behind — the initials, not the person");
      check(openNames.indexOf("Remove " + whoLabel + " from the roster") >= 0,
        "…and the menu's person-removal item beside it still names the roster");
      R.shut();
    }

    {
      const bare = fresh("unicode");
      const who  = bare.people.find(p => !p.photo);
      check(!!who, "the unicode fixture still has a person with no photo");
      if(who){
        who.name = "Ada Lovelace";
        const built = R.photo(bare, who.id);
        eq(collect(built, x => x.dataset.fact).length, 0,
          "a photo-less person gets no framing editor at all");
        eq(collect(built, x => x.dataset.act).filter(v => v === "photo").length, 2,
          "…and exactly two ways to add one — the placeholder circle itself, "
          + "now a real control, and the button beneath it");
        eq(collect(built, x => /\bnp-circle\b/.test(String(x.className||"")) ? x.textContent : null)[0],
          "AL",
          "…beside their initials, standing in for the picture they have not got");
        R.shut();
      }
    }

    R.render(fresh("unicode"), null);
    check(R.HOSTS.roster.children.length > 0, "a photo-less roster renders");
    const empty = fresh("current"); empty.people = [];
    R.render(empty, null);
    eq(R.HOSTS.roster.children.length, 1, "an empty roster renders exactly one placeholder");
    check(/Nobody yet/.test(R.HOSTS.roster.children[0].textContent),
      "the empty placeholder says so in words");

    const named = fresh("current");
    const target = named.people[0];
    R.render(named, target.id);
    R.photo(named, target.id);

    const names = collect(R.HOSTS.roster, x => x.attrs["aria-label"])
      .concat(collect(R.HOSTS.personMenu, x => x.attrs["aria-label"]))
      .concat(collect(R.HOSTS.editPhoto,  x => x.attrs["aria-label"]));
    check(names.length > 0, "the roster emits accessible names at all");
    for(const want of ["Actions for " + target.name,
                       "Edit details for " + target.name,
                       "Move " + target.name + " up",
                       "Move " + target.name + " down",
                       "Remove " + target.name + " from the roster"]){
      check(names.indexOf(want) >= 0, 'a control names its person: "' + want + '"');
    }
    check(names.some(n => /arrow keys to nudge/.test(n)),
      "the framing circle mentions its keyboard path");

    {
      const carets = collect(R.HOSTS.roster,
        x => x.dataset.act === "menu" ? x.attrs["aria-label"] : null);
      eq(carets.length, named.people.length, "every row's caret is named");
      check(carets.every(n => /^Actions for /.test(n)), "…and every one of them says whose");
    }

    const anon = fresh("current");
    anon.people[0].name = "";
    R.render(anon, anon.people[0].id);
    R.photo(anon, anon.people[0].id);
    const anonNames = collect(R.HOSTS.roster, x => x.attrs["aria-label"])
      .concat(collect(R.HOSTS.personMenu, x => x.attrs["aria-label"]))
      .concat(collect(R.HOSTS.editPhoto,  x => x.attrs["aria-label"]));
    check(anonNames.some(n => /the unnamed person/.test(n)),
      "an unnamed person is described, not left as an empty string");
    check(!anonNames.some(n => /^Move  /.test(n) || /^Remove  /.test(n)),
      "no accessible name collapses to a double space where the name should be");

    {
      const line = collect(R.HOSTS.roster,
        x => /\bp-name\b/.test(String(x.className||"")) ? x : null)[0];
      eq(line && line.textContent, "Unnamed",
        "the row shows a short placeholder for a nameless person, not the sentence form");
      check(line && /\bnone\b/.test(line.className),
        "…marked so the stylesheet can mute it");
    }
    R.shut();

    function labelMap(root){
      const out = {};
      walk(root, x => {
        const key = x.dataset && (x.dataset.act || x.dataset.fact
                                  || String(x.className || "").split(/\s+/)[0]);
        const lab  = x.attrs && x.attrs["aria-label"];
        if(key && x.dataset.id && lab) out[key + ":" + x.dataset.id] = lab;
      });
      return out;
    }
    const NEW_NAME = "Ada Lovelace";

    for(const open of [true, false]){
      const where = open ? "with the menu and the dialog open" : "with the row alone";
      const doc = fresh("injection");

      const subject = doc.people.find(p => p.photo) || doc.people[0];
      subject.name = "";
      R.render(doc, null);
      if(open){ R.menu(doc, subject.id); R.photo(doc, subject.id); }

      const before = Object.assign(labelMap(R.HOSTS.roster),
                                   labelMap(R.HOSTS.personMenu),
                                   labelMap(R.HOSTS.editPhoto));
      const mine = k => k.slice(k.indexOf(":") + 1) === subject.id;
      const keysOfSubject = Object.keys(before).filter(mine);
      check(keysOfSubject.length >= (open ? 6 : 1),
        where + ": several accessible names to keep current — got " + keysOfSubject.length);
      check(keysOfSubject.some(k => /the unnamed person/.test(before[k])),
        where + ": starts out announcing the unnamed fallback");

      subject.name = NEW_NAME;
      R.sync(subject);

      const after = Object.assign(labelMap(R.HOSTS.roster),
                                  labelMap(R.HOSTS.personMenu),
                                  labelMap(R.HOSTS.editPhoto));
      check(!Object.keys(after).filter(mine).some(k => /the unnamed person/.test(after[k])),
        where + ": no unnamed fallback is left anywhere after the rename");
      const personal = Object.keys(after).filter(mine);
      check(personal.length >= (open ? 6 : 1), where + ": person-derived names to check");
      check(personal.every(k => after[k].indexOf(NEW_NAME) >= 0),
        where + ": names the person in every one of their controls");

      for(const k of Object.keys(before)){
        if(!mine(k)) eq(after[k], before[k], where + ": another person's " + k + " is left alone");
      }

      R.render(doc, null);
      if(open){ R.menu(doc, subject.id); R.photo(doc, subject.id); }
      const rendered = Object.assign(labelMap(R.HOSTS.roster),
                                     labelMap(R.HOSTS.personMenu),
                                     labelMap(R.HOSTS.editPhoto));
      for(const k of Object.keys(rendered).filter(mine)){
        eq(after[k], rendered[k],
          where + ": relabelled " + k + " matches what a fresh render writes");
      }
      eq(Object.keys(after).filter(mine).length, Object.keys(rendered).filter(mine).length,
        where + ": relabels every control the renderer names, and no others");
      R.shut();
    }

    {
      const doc = fresh("injection");
      const t0 = doc.tiers[0], t1 = doc.tiers[1];
      const subject = doc.people[0];
      subject.tierId = t0.id;
      subject.name = "";
      doc.people = [subject].concat(doc.people.slice(1).map(p => {
        p.tierId = t1.id; return p;
      }));
      R.render(doc, null);
      R.menu(doc, subject.id);
      const downBefore = R.HOSTS.personMenu.querySelector('[data-act="down"][data-id="' + subject.id + '"]');
      check(!!downBefore && /the unnamed person/.test(downBefore.attrs["aria-label"]),
        "the lone member of a grade starts with an unnamed Down label");
      check(/to /.test(downBefore.attrs["aria-label"]),
        "and that label already carries its destination grade");

      subject.name = NEW_NAME;
      R.sync(subject);
      const lab = downBefore.attrs["aria-label"];
      check(lab.indexOf(NEW_NAME) >= 0, "after the rename the Down label names the person");
      check(lab.indexOf(t1.label || t1.code) >= 0,
        "and still names the grade it would move them to — got " + JSON.stringify(lab));
      R.shut();
    }

    const thumbOf = id => R.HOSTS.roster.querySelector('.thumb[data-id="' + id + '"]');
    const lineOf  = id => R.HOSTS.roster.querySelector('.p-name[data-id="' + id + '"]');
    {
      const doc = fresh("injection");
      const subject = doc.people[0];
      subject.photo = null;
      subject.name = "Ada Lovelace";
      R.render(doc, null);

      const txt = n => (n || {}).textContent;
      const thumb = thumbOf(subject.id), line = lineOf(subject.id);
      check(!!thumb, "a photo-less person has a thumbnail");
      eq(txt(thumb), "AL", "which starts out showing the rendered initials");
      check(!!line, "and a line of text beside it");
      eq(txt(line), "Ada Lovelace", "showing the name the render was given");

      subject.name = "Grace Hopper";
      R.sync(subject);
      eq(txt(thumb), "GH", "the initials follow the rename");
      eq(txt(line), "Grace Hopper", "and so does the line");
      check(thumbOf(subject.id) === thumb && lineOf(subject.id) === line,
        "on the very same DOM nodes — nothing was rebuilt to achieve it");

      R.render(doc, null);
      const redrawn = thumbOf(subject.id), redrawnLine = lineOf(subject.id);
      check(redrawn !== thumb, "a fresh render does build a new node (so the comparison is worth making)");
      eq(txt(thumb), txt(redrawn),
        "the in-place initials are exactly what a fresh render writes");
      eq(txt(line), txt(redrawnLine),
        "and so is the in-place line");

      subject.name = "";
      const cleared = thumbOf(subject.id), clearedLine = lineOf(subject.id);
      R.sync(subject);
      const afterClear = txt(cleared), afterClearLine = txt(clearedLine);
      const afterClearCls = (clearedLine || {}).className;
      R.render(doc, null);
      eq(afterClear, txt(thumbOf(subject.id)),
        "clearing the name falls back to what a fresh render produces");
      check(afterClear !== "GH", "and not to the initials it used to show — got " + JSON.stringify(afterClear));
      eq(afterClearLine, txt(lineOf(subject.id)),
        "the line falls back the same way");
      eq(afterClearCls, (lineOf(subject.id) || {}).className,
        "…and takes back the muted class with it, which a textContent-only repair would leave off");
    }
    {

      const doc = fresh("injection");
      const subject = doc.people.find(p => p.photo);
      check(!!subject, "injection.json still has a person with a usable photo");
      subject.name = "Ada Lovelace";
      R.render(doc, null);
      R.menu(doc, subject.id);

      const thumb = thumbOf(subject.id);
      const kids = n => (n || {}).children || [];
      const img = kids(thumb)[0];
      check(!!img && img.tagName === "img", "a photo thumbnail holds an image node");
      eq((thumb || {}).textContent, "", "and carries no text of its own");

      subject.name = "Grace Hopper";
      R.sync(subject);
      eq((thumb || {}).textContent, "",
        "a rename writes no text into a photo thumbnail — that would destroy the image");
      eq(kids(thumb).length, 1, "the image node is still the only child");
      check(kids(thumb)[0] === img, "and it is the same image node, not a replacement");
      const caret = R.HOSTS.roster.querySelector('[data-act="menu"][data-id="' + subject.id + '"]');
      check(caret && caret.attrs["aria-label"].indexOf("Grace Hopper") >= 0,
        "while the caret's accessible name still follows the rename");
      R.shut();
    }

    R.render(named, null);

    const first = named.tiers[0], second = named.tiers[1];
    const chipNames = collect(R.HOSTS.tiers, x => x.attrs["aria-label"]);
    check(chipNames.some(n => n === "Grade " + first.label + " — open settings"),
      "a chip says which grade it is and that it opens something — got "
      + JSON.stringify(chipNames));
    const stripVerbs = [];
    walk(R.HOSTS.tiers, x => { if(x.dataset.tact) stripVerbs.push(x.dataset.tact); });
    check(stripVerbs.every(v => v === "open"),
      "and the strip emits nothing but the chips themselves — got "
      + JSON.stringify(stripVerbs.filter((v, k) => stripVerbs.indexOf(v) === k)));
    const chip0 = R.HOSTS.tiers.children[0];
    const chipText = collect(chip0, x => x.textContent);
    check(chipText.indexOf(first.code) >= 0 && chipText.indexOf(first.label) >= 0,
      "the chip shows the grade's code and its name — got " + JSON.stringify(chipText));

    const toggle0 = collect(chip0, x =>
      String(x.className||"").indexOf("g-chip-toggle") >= 0 ? x : null)[0];
    check(!!toggle0, "the chip carries a caret button beside its drag handle");
    check(toggle0 && toggle0.attrs["aria-expanded"] === "false",
      "a chip's caret starts collapsed, and says so");
    check(toggle0 && toggle0.attrs["aria-haspopup"] === "dialog",
      "and announces that it opens a dialog rather than navigating");
    check(toggle0 && toggle0.dataset.tact === "open",
      "and it is the half that carries the verb — the drag handle carries none");
    const face0 = collect(chip0, x =>
      String(x.className||"").indexOf("g-chip-face") >= 0 ? x : null)[0];
    check(face0 && !face0.dataset.tact && face0.draggable === true,
      "the face drags and does nothing on click, so one gesture cannot do both");

    const panel0 = R.panel(named, 0), panel1 = R.panel(named, 1);
    const tierNames = collect(panel0, x => x.attrs["aria-label"])
      .concat(collect(panel1, x => x.attrs["aria-label"]));
    check(tierNames.some(n => n.indexOf("Delete grade " + first.label) === 0),
      "the delete button names its grade");
    check(tierNames.some(n => /unavailable for the first grade/.test(n)),
      "the first grade explains why attach and share are unavailable");
    check(tierNames.some(n => n.indexOf("Attach " + second.label) === 0),
      "a later grade's attach names both grades");

    const panelVerbs = [];
    walk(panel0, x => { if(x.dataset.tact) panelVerbs.push(x.dataset.tact); });
    for(const v of ["code","label","fill","align","attach","merge","up","down","del"]){
      check(panelVerbs.indexOf(v) >= 0,
        'the panel still emits data-tact="' + v + '" — got ' + JSON.stringify(panelVerbs));
    }

    const links = (p) => { const out = []; walk(p, x => {
        if(x.tagName === "button" && (x.dataset.tact === "attach"
           || x.dataset.tact === "merge")) out.push(x); }); return out; };
    const boxes = links(panel0);
    eq(boxes.length, 2, "the first grade's panel has both option toggles");
    check(boxes.every(b => b.disabled === true), "and both are disabled on the first grade");
    check(boxes.every(b => b.attrs["aria-pressed"] === "false"),
      "and both read as off, since the first grade can be neither");

    const boxes2 = links(panel1);
    check(boxes2.length === 2 && boxes2.every(b => b.disabled === false),
      "the second grade's options are available");

    const flags = {attach: named.tiers[1].attach, merge: named.tiers[1].merge};
    check(boxes2.every(b => b.attrs["aria-pressed"] === String(!!flags[b.dataset.tact])),
      "and each shows the flag it writes — attach " + flags.attach
      + ", share " + flags.merge + ", got "
      + JSON.stringify(boxes2.map(b => b.dataset.tact + "=" + b.attrs["aria-pressed"])));

    const moves = [];
    walk(panel1, x => { if(x.dataset.tact === "up" || x.dataset.tact === "down")
                          moves.push([x.dataset.tact, x.attrs["aria-label"]]); });
    eq(moves.length, 2, "the panel has both reorder buttons");
    check(moves.some(m => m[0] === "up"   && /\bleft\b/.test(m[1])
                          && /top of the chart/.test(m[1])),
      'the "up" verb is presented as Left, and says it means the top of the chart');
    check(moves.some(m => m[0] === "down" && /\bright\b/.test(m[1])
                          && /bottom of the chart/.test(m[1])),
      'and "down" as Right — got ' + JSON.stringify(moves));

    const lastPanel = R.panel(named, named.tiers.length - 1);
    const lastMoves = {};
    walk(lastPanel, x => { if(x.dataset.tact === "up" || x.dataset.tact === "down")
                             lastMoves[x.dataset.tact] = x.disabled; });
    check(lastMoves.down === true && lastMoves.up === false,
      "the bottom grade's Right is disabled and its Left is not");
    const firstMoves = {};
    walk(panel0, x => { if(x.dataset.tact === "up" || x.dataset.tact === "down")
                          firstMoves[x.dataset.tact] = x.disabled; });
    check(firstMoves.up === true && firstMoves.down === false,
      "and the top grade's Left is disabled while its Right is not");

    const texts = collect(panel1, x => x.textContent);
    check(texts.indexOf("Attach to left") >= 0,
      'the visible label says what Attach does');
    check(texts.indexOf("Share band") >= 0,
      'and so does the share option');
    check(texts.indexOf("A") < 0 && texts.indexOf("S") < 0,
      "the bare single-letter labels are gone");
    check(texts.indexOf("Border only") >= 0 && texts.indexOf("Only border") < 0,
      "the outline fill is faced Border only — noun first, like every other face "
      + "in the panel");

    const alignOrder = [];
    walk(panel1, x => { if(x.dataset.tact === "align")
                          alignOrder.push(x.attrs["data-value"]); });
    check(alignOrder.join(",") === "left,center,right",
      "the People options are built left, centre, right — got " + JSON.stringify(alignOrder));
    const fillOrder = [];
    walk(panel1, x => { if(x.dataset.tact === "fill")
                          fillOrder.push(x.attrs["data-value"]); });
    check(fillOrder.join(",") === "green,white",
      "and Fill is built Accent, Border only — got " + JSON.stringify(fillOrder));

    const laneState = JSON.parse(JSON.stringify(named));
    laneState.layout = "swimlanes";
    const lanePanel = R.panel(laneState, 1);
    const laneShare = [];
    walk(lanePanel, x => { if(x.dataset.tact === "merge") laneShare.push(x); });
    eq(laneShare.length, 1, "Swimlanes still offers the share toggle");
    check(laneShare[0] && /\blane\b/.test(laneShare[0].attrs["aria-label"])
          && !/\bband\b/.test(laneShare[0].attrs["aria-label"]),
      "and names a lane while Swimlanes is active — got "
      + JSON.stringify(laneShare[0] && laneShare[0].attrs["aria-label"]));
    const bandShare = [];
    walk(panel1, x => { if(x.dataset.tact === "merge") bandShare.push(x); });
    check(bandShare[0] && /\bband\b/.test(bandShare[0].attrs["aria-label"]),
      "while the pyramid names a band — got "
      + JSON.stringify(bandShare[0] && bandShare[0].attrs["aria-label"]));

    const laneMoves = [];
    walk(lanePanel, x => { if(x.dataset.tact === "up" || x.dataset.tact === "down")
                             laneMoves.push({tact:x.dataset.tact, title:x.title || "",
                                              label:(x.attrs && x.attrs["aria-label"]) || ""}); });
    eq(laneMoves.length, 2, "the Swimlanes lane panel still has both reorder buttons");
    check(laneMoves.every(m => !/chart/.test(m.title) && !/chart/.test(m.label)),
      "and neither reorder button mentions the chart while the grades are a row — got "
      + JSON.stringify(laneMoves));
    check(laneMoves.some(m => m.tact === "up"   && /one lane left/.test(m.title)
                                                 && /one lane left/.test(m.label)),
      'the "up" button reads as one lane left under Swimlanes — got '
      + JSON.stringify(laneMoves));
    check(laneMoves.some(m => m.tact === "down" && /one lane right/.test(m.title)
                                                 && /one lane right/.test(m.label)),
      'and "down" as one lane right — got ' + JSON.stringify(laneMoves));

    const pyramidMoveTitles = [];
    walk(panel1, x => { if(x.dataset.tact === "up" || x.dataset.tact === "down")
                          pyramidMoveTitles.push(x.title || ""); });
    check(pyramidMoveTitles.length === 2 && pyramidMoveTitles.every(t => /chart/.test(t)),
      "while the Pyramid panel's own reorder buttons still name the chart — got "
      + JSON.stringify(pyramidMoveTitles));

    const lanePanel0 = R.panel(laneState, 0);
    const laneAttach0 = links(lanePanel0).filter(b => b.dataset.tact === "attach")[0];
    check(laneAttach0 && /nothing before it/.test(laneAttach0.title)
                       && !/nothing above it/.test(laneAttach0.title),
      "the first lane's attach reason says \"before\", not \"above\" — got "
      + JSON.stringify(laneAttach0 && laneAttach0.title));
    const bandAttach0 = links(panel0).filter(b => b.dataset.tact === "attach")[0];
    check(bandAttach0 && /nothing above it/.test(bandAttach0.title)
                       && !/nothing before it/.test(bandAttach0.title),
      "while the first band keeps \"above\" — got "
      + JSON.stringify(bandAttach0 && bandAttach0.title));

    const laneFillLabels = collect(lanePanel, x =>
      (x.attrs && x.attrs.role === "radiogroup") ? x.attrs["aria-label"] : null);
    check(laneFillLabels.some(l => /^Lane fill for /.test(l)),
      "the Swimlanes fill radiogroup is named for a lane, not a band — got "
      + JSON.stringify(laneFillLabels));
    const bandFillLabels = collect(panel1, x =>
      (x.attrs && x.attrs.role === "radiogroup") ? x.attrs["aria-label"] : null);
    check(bandFillLabels.some(l => /^Band fill for /.test(l)),
      "while the Pyramid fill radiogroup keeps Band — got "
      + JSON.stringify(bandFillLabels));

    const laneFillTitles = [];
    walk(lanePanel, x => { if(x.dataset.tact === "fill") laneFillTitles.push(x.title || ""); });
    check(laneFillTitles.length === 2 && laneFillTitles.every(t => /\blane\b/.test(t))
                                       && laneFillTitles.every(t => !/\bband\b/.test(t)),
      "the Swimlanes fill options are titled for a lane, not a band — got "
      + JSON.stringify(laneFillTitles));
    const bandFillTitles = [];
    walk(panel1, x => { if(x.dataset.tact === "fill") bandFillTitles.push(x.title || ""); });
    check(bandFillTitles.length === 2 && bandFillTitles.every(t => /\bband\b/.test(t)),
      "while the Pyramid fill options keep band — got "
      + JSON.stringify(bandFillTitles));

    const swimLabel = R.LAYOUTS.swimlanes.label;
    const laneAligns = [];
    walk(lanePanel, x => { if(x.dataset.tact === "align") laneAligns.push(x); });
    eq(laneAligns.length, 3, "Swimlanes still offers all three People options");
    check(laneAligns.every(b => b?.disabled === true),
      "and all three are really disabled under Swimlanes — got "
      + JSON.stringify(laneAligns.map(b => b?.disabled)));
    check(laneAligns.every(b => b?.title === "Not available in " + swimLabel),
      "each names the CURRENT layout it is disabled for — got "
      + JSON.stringify(laneAligns.map(b => b?.title)) + ", want \"Not available in " + swimLabel + "\"");
    let laneRadiogroup = null;
    walk(lanePanel, x => { if(x.attrs && x.attrs.role === "radiogroup"
                               && /^Where people sit/.test(x.attrs["aria-label"] || "")) laneRadiogroup = x; });
    check(laneRadiogroup && laneRadiogroup.attrs["aria-label"].indexOf(
        "not available in " + swimLabel) >= 0,
      "and the radiogroup's own aria-label carries the same reason, lower-cased after the dash — got "
      + JSON.stringify(laneRadiogroup && laneRadiogroup.attrs["aria-label"]));

    const savedSwimLabel = R.LAYOUTS.swimlanes.label;
    R.LAYOUTS.swimlanes.label = "Lanes Test";
    const dopedPanel = R.panel(laneState, 1);
    const dopedAligns = [];
    walk(dopedPanel, x => { if(x.dataset.tact === "align") dopedAligns.push(x); });
    check(dopedAligns.length === 3 && dopedAligns.every(b => b?.title === "Not available in Lanes Test"),
      "and the reason follows a doctored LAYOUTS.swimlanes.label rather than a hard-typed "
      + "\"Swimlanes\" — got " + JSON.stringify(dopedAligns.map(b => b?.title)));
    R.LAYOUTS.swimlanes.label = savedSwimLabel;

    const laneAlignNow = laneState.tiers[1].align;
    check(laneAligns.every(b =>
        b?.attrs?.["aria-checked"] === String(b?.attrs?.["data-value"] === laneAlignNow)),
      "and the stored choice (" + laneAlignNow + ") is still visibly checked, not reset by "
      + "disabling — got "
      + JSON.stringify(laneAligns.map(b => b?.attrs?.["data-value"] + "=" + b?.attrs?.["aria-checked"])));

    const hiveState = JSON.parse(JSON.stringify(named));
    hiveState.layout = "hive";
    const hivePanel = R.panel(hiveState, 1);
    const hiveAligns = [];
    walk(hivePanel, x => { if(x.dataset.tact === "align") hiveAligns.push(x); });
    eq(hiveAligns.length, 3, "Hive still offers all three People options");
    check(hiveAligns.every(b => b?.disabled === true),
      "and all three are really disabled under Hive — got "
      + JSON.stringify(hiveAligns.map(b => b?.disabled)));
    check(hiveAligns.every(b => b?.title === "Not available in Hive"),
      "each names the CURRENT layout it is disabled for — got "
      + JSON.stringify(hiveAligns.map(b => b?.title)));

    const bandAligns = [];
    walk(panel1, x => { if(x.dataset.tact === "align") bandAligns.push(x); });
    eq(bandAligns.length, 3, "Pyramid keeps all three People options");
    check(bandAligns.every(b => b?.disabled === false),
      "and all three stay live under Pyramid — got "
      + JSON.stringify(bandAligns.map(b => b?.disabled)));
    const bandAlignTitles = bandAligns.map(b => b?.title || "");
    check(bandAlignTitles.every(t => t !== "Not available in " + swimLabel),
      "Pyramid's own options keep their per-option reasons, not the disabled-layout one — got "
      + JSON.stringify(bandAlignTitles));
    check(new Set(bandAlignTitles).size === 3,
      "…and the three reasons are distinct, one per option — got "
      + JSON.stringify(bandAlignTitles));
    const bandAlignNow = named.tiers[1].align;
    check(bandAligns.every(b =>
        b?.attrs?.["aria-checked"] === String(b?.attrs?.["data-value"] === bandAlignNow)),
      "and the stored choice (" + bandAlignNow + ") is still visibly checked under Pyramid too — got "
      + JSON.stringify(bandAligns.map(b => b?.attrs?.["data-value"] + "=" + b?.attrs?.["aria-checked"])));

    const tornadoState = JSON.parse(JSON.stringify(named));
    tornadoState.layout = "tornado";
    const tornadoPanel = R.panel(tornadoState, 1);
    const tornadoAligns = [];
    walk(tornadoPanel, x => { if(x.dataset.tact === "align") tornadoAligns.push(x); });
    eq(tornadoAligns.length, 3, "Tornado still offers all three People options");
    check(tornadoAligns.every(b => b?.disabled === false),
      "and all three stay live under Tornado too — got "
      + JSON.stringify(tornadoAligns.map(b => b?.disabled)));

    const histogramState = JSON.parse(JSON.stringify(named));
    histogramState.layout = "histogram";
    const histogramPanel = R.panel(histogramState, 1);
    const histogramAligns = [];
    walk(histogramPanel, x => { if(x.dataset.tact === "align") histogramAligns.push(x); });
    eq(histogramAligns.length, 3, "Histogram still offers all three People options");
    check(histogramAligns.every(b => b?.disabled === false),
      "and all three stay live under Histogram too — got "
      + JSON.stringify(histogramAligns.map(b => b?.disabled)));

    const renamed = fresh("current");
    const tier = renamed.tiers[0];
    const person = renamed.people.find(p => p.tierId === tier.id);
    check(!!person, "the grade under test has someone in it");

    R.render(renamed, person.id);
    const before = collect(R.HOSTS.roster, x => x.textContent)
      .concat(collect(R.HOSTS.tiers, x => x.attrs["aria-label"]));
    check(before.some(t => t && t.indexOf(tier.label) >= 0),
      "the old grade name is on screen before the rename");

    tier.label = "Renamed Grade";
    tier.code  = "RG";
    R.render(renamed, person.id);

    const heads = collect(R.HOSTS.roster, x =>
      x.className === "nm" ? x.textContent : null);
    check(heads.indexOf("Renamed Grade") >= 0,
      "the roster group heading follows the new grade name — got " + JSON.stringify(heads));

    const codes = collect(R.HOSTS.roster, x =>
      x.className === "code" ? x.textContent : null);
    check(codes.indexOf("RG") >= 0, "the group heading's code chip follows too");

    R.dialog(renamed, person.id);
    const opts = collect(R.HOSTS.editTier, x => x.tagName === "option" ? x.textContent : null);
    check(opts.indexOf("Renamed Grade") >= 0,
      "the dialog's grade picker lists the new name — got " + JSON.stringify(opts));
    eq(opts.length, renamed.tiers.length,
      "…and still lists every grade, which is fillTierOptions' whole job");

    eq(R.HOSTS.editRole.placeholder, "Renamed Grade",
      "the role placeholder follows the grade's name");
    check(R.HOSTS.editRole.placeholder !== "Renamed Role",
      "and there is no grade-level title left to follow instead");

    eq(R.HOSTS.editName.value, person.name, "the dialog shows this person's name");
    eq(R.HOSTS.editTier.children.filter(o => o.selected).length, 1,
      "…and their grade is the one selected in the list");
    R.shut();

    const cardNames = collect(R.HOSTS.tiers, x => x.attrs["aria-label"])
      .concat(collect(R.panel(renamed, 0), x => x.attrs["aria-label"]));
    check(cardNames.some(n => n === "Delete grade Renamed Grade"),
      "the grade panel's accessible names follow — got "
      + JSON.stringify(cardNames.filter(n => /Delete grade/.test(n))));
    check(cardNames.some(n => n === "Grade Renamed Grade — open settings"),
      "and so does the chip's");
    check(!cardNames.some(n => n && n.indexOf(tier.id) >= 0), "and none leaks an id");
    const chipText2 = collect(R.HOSTS.tiers, x => x.textContent);
    check(chipText2.indexOf("Renamed Grade") >= 0 && chipText2.indexOf("RG") >= 0,
      "the chip's visible code and name follow too — got " + JSON.stringify(chipText2));

    const after = collect(R.HOSTS.roster, x => x.textContent)
      .concat(collect(R.HOSTS.tiers, x => x.textContent))
      .concat(collect(R.HOSTS.tiers, x => x.attrs["aria-label"]))
      .concat(collect(R.panel(renamed, 0), x => x.attrs["aria-label"]))
      .concat(collect(R.HOSTS.roster, x => x.placeholder));
    check(!after.some(t => t === "Partner" || t === "Delete grade Partner"),
      "no part of the roster is left showing the old grade name");

  {
    function searchDoc(){
      return {
        tiers: [
          {id:"tqA", code:"PTR", label:"Partner",  fill:"white", align:"center", attach:false, merge:false},
          {id:"tqB", code:"MGR", label:"Manager",  fill:"white", align:"center", attach:false, merge:false},
          {id:"tqC", code:"DIR", label:"Director", fill:"white", align:"center", attach:false, merge:false}
        ],
        groups: [{id:"gqA", label:"Falcons"}, {id:"gqB", label:"Owls"}],
        people: [
          {id:"pqA", name:"Ada Byte", tierId:"tqA", role:"",             groupId:"gqA"},
          {id:"pqD", name:"Al Adams", tierId:"tqA", role:"",             groupId:"gqA"},
          {id:"pqB", name:"Bo Cache", tierId:"tqC", role:"Team Captain", groupId:"gqB"},
          {id:"pqC", name:"Cy Data",  tierId:"tqB", role:"",             groupId:null}
        ]
      };
    }
    const sdoc = searchDoc();
    const N = sdoc.people.length;
    const namesIn = () => collect(R.HOSTS.roster, x => x.className === "p-name" ? x.textContent : null);
    const headsIn = () => collect(R.HOSTS.roster, x => x.className === "th" ? true : null);

    R.query("Cache");
    R.render(sdoc, null);
    eq(namesIn().join(","), "Bo Cache",
      "querying \"Cache\" leaves only Bo Cache's row in the tree — got " + JSON.stringify(namesIn()));
    eq(headsIn().length, 1,
      "…and only the one grade that still has someone in it keeps its .th heading");
    eq(collect(R.HOSTS.roster, x => x.className === "ct" ? x.textContent : null).join(","), "1",
      "…whose count span reads the filtered size of the grade, not its real headcount");

    function onlyMatching(q){ R.query(q); R.render(sdoc, null); return namesIn().join(","); }
    eq(onlyMatching("Captain"), "Bo Cache", "\"Captain\" matches only through p.role");
    eq(onlyMatching("Partner"), "Ada Byte,Al Adams",
      "\"Partner\" matches Ada and Al — both hold an empty role, so their grade's own "
      + "name reaches them only through tierRole's fallback");
    eq(onlyMatching("MGR"), "Cy Data", "\"MGR\" matches only through the grade's own t.code");
    eq(onlyMatching("Director"), "Bo Cache",
      "\"Director\" matches Bo Cache despite her non-empty role — proving t.label is read "
      + "on its own, not only as tierRole's fallback text");
    eq(onlyMatching("Owls"), "Bo Cache", "\"Owls\" matches only through groupLabel(st, p)");

    R.query("Cache");
    R.render(sdoc, null);
    eq(R.HOSTS.rosterCount.hidden, false, "the count line shows while a filter is active");
    eq(R.HOSTS.rosterCount.textContent, "1 of " + N + " shown",
      "…reading exactly \"1 of " + N + " shown\" — got "
      + JSON.stringify(R.HOSTS.rosterCount.textContent));
    R.query("");
    R.render(sdoc, null);
    eq(R.HOSTS.rosterCount.hidden, true, "…and hides again once the query is empty");

    R.query("zzz");
    R.render(sdoc, null);
    eq(collect(R.HOSTS.roster, x => x.className === "empty" ? x.textContent : null).join(","),
      'Nobody matches "zzz"',
      "a query matching nobody shows the roster's own empty-state wording, naming the query");
    eq(headsIn().length, 0, "…and every grade lost its heading along with its last match");

    R.query("");
    R.render(sdoc, null);
    eq(namesIn().length, N, "an empty query shows every person again — got " + namesIn().length);

    const LOCK_TITLE = "Not available while searching — clear the search to reorder";
    function moveButtons(menuNode){
      return {up:   collect(menuNode, x => x.dataset && x.dataset.act === "up"   ? x : null)[0],
              down: collect(menuNode, x => x.dataset && x.dataset.act === "down" ? x : null)[0]};
    }
    R.query("");
    let mv = moveButtons(R.menu(sdoc, "pqA"));
    check(mv.up && mv.up.disabled === true, "unfiltered: Ada is first in her grade, so Move up is disabled");
    check(mv.down && mv.down.disabled === false, "unfiltered: Move down is enabled — Al is right behind her");
    R.query("Cache");
    mv = moveButtons(R.menu(sdoc, "pqA"));
    check(mv.up && mv.up.disabled === true && mv.up.title === LOCK_TITLE,
      "filtered: Move up is disabled and carries the shared reason — got " + JSON.stringify(mv.up && mv.up.title));
    check(mv.down && mv.down.disabled === true && mv.down.title === LOCK_TITLE,
      "filtered: Move down is ALSO disabled now, with the same reason — got "
      + JSON.stringify(mv.down && mv.down.title));
    R.query("");
    mv = moveButtons(R.menu(sdoc, "pqA"));
    check(mv.up && mv.up.disabled === true, "clearing the search restores Move up's ordinary (still disabled) state");
    check(mv.down && mv.down.disabled === false,
      "…and restores Move down's ordinary ENABLED state — the lock let go, it did not overwrite a value");

    R.query("Cache");
    R.render({tiers: sdoc.tiers, groups: sdoc.groups, people: []}, null);
    eq(R.HOSTS.rosterSearchRow.hidden, true, "the search row hides itself once nobody is left to search");
    R.render(sdoc, null);
    eq(namesIn().length, N,
      "…and the reset is real, not cosmetic — a render with people again shows everyone, "
      + "not a filter left standing from before the roster went empty");

    eq(R.writes(), 0,
      "the whole search flow above touched history zero times — got " + R.writes() + " write(s)");
  }
  }

  {
    const LEG = new Function("makeNode",

      ["FONT","FONTS","PAGES","ANGLES","DENSITY","G","SW","HV","MX","ZOOM_MAX","uid","LIMITS","ENUMS","ANCHORS","HEX6",
       "NAME_PT","MIN_NAME_PT","MIN_FACE_PT","LAYOUTS"].map(grabConst).join("\n") + "\n" +
      ["validatePhoto","oneOf","splitName","initials","tierOf","tierRole","subline","withAlpha",
       "angleIndex","codeParts","frameRect","frameLimit","clampFrame","computeLayout",
       "gradeHeadingTexts","buildBandGroups","buildBandStack","emitHeaderTexts","emitBandPeople",
       "computeTriangleLayout","computeHistogramLayout","computePyramidLayout","computeTornadoLayout",
       "computeSwimlaneLayout","computeHiveLayout","computeMatrixLayout",
       "nameSegs","ellipsize","fitName","checkLegibility",
       "personLabelWidth","headNeedWidth","docFont",
       "newGroup","resolveGroupId","groupLabel","pruneGroups"].map(grabFn).join("\n") + "\n" +
      "let state = null;\n" +
      "const BAR = makeNode('div'); BAR.hidden = true;\n" +
      "function $(sel){ return sel === '#legibility' ? BAR : null; }\n" +
      "const meas = { font:'', measureText(t){ return {width: String(t||'').length * 6}; } };\n" +
      "const document = { createElement(){ return {getContext(){ return meas; }}; } };\n" +
      "return {BAR, run(s){ state = s; checkLegibility(computeLayout(s)); },\n" +
      "        scaleOf(s){ state = s; return computeLayout(s).fit.s; }};"
    )(function node(tag){
      return {tagName:tag, hidden:false, textContent:"", children:[], dataset:{}, attrs:{},
              appendChild(c){ this.children.push(c); return c; },
              setAttribute(k,v){ this.attrs[k]=String(v); },
              get firstChild(){ return this.children[0]; },
              removeChild(c){ this.children.splice(this.children.indexOf(c),1); return c; }};
    });

    function roster(perGrade, grades, over){
      const tiers = [], people = [];
      for(let g = 0; g < grades; g++){
        const id = "lt" + g;
        tiers.push({id:id, code:"G"+g, label:"Grade "+g, role:"Grade "+g,
                    fill:"green", attach:false, merge:false, align:"center"});
        for(let i = 0; i < perGrade; i++){
          people.push({id:"lp"+g+"-"+i, name:"Person Number "+g+"-"+i, tierId:id,
                       groupId:null, role:"", photo:null, pw:0, ph:0, frame:null});
        }
      }
      return Object.assign({title:"Legibility", brand:"", accent:"#046A38",
        inkOnColour:"#FFFFFF", inkOnWhite:"#1A2129", bg:"white", ring:"none",
        angle: 2, page:"landscape", density:"balanced",
        tiers:tiers, people:people}, over || {});
    }

    LEG.run(roster(4, 3));
    check(LEG.BAR.hidden === true, "a roster that fits raises no warning");
    eq(LEG.BAR.textContent, "", "and leaves the bar empty");

    LEG.run(roster(0, 4));
    check(LEG.BAR.hidden === true, "an empty roster raises no warning");

    const huge = roster(40, 9);
    const s = LEG.scaleOf(huge);
    check(s * 15 < 6, "the test roster really is scaled below the threshold (name is "
      + (s*15).toFixed(2) + "pt)");
    LEG.run(huge);
    check(LEG.BAR.hidden === false, "an unreadable roster warns");
    check(/too small to read/.test(LEG.BAR.textContent), "the warning says what is wrong");
    check(/pt on the printed page/.test(LEG.BAR.textContent),
      "and quantifies it, so it is not a matter of opinion");
    check(/Try: /.test(LEG.BAR.textContent), "and suggests what to change");
    check(/turn the page|spacing|split|remove a grade/.test(LEG.BAR.textContent),
      "the suggestion names a concrete setting — got " + JSON.stringify(LEG.BAR.textContent));

    LEG.run(roster(40, 9, {density:"tight"}));
    check(!/set spacing to tight/.test(LEG.BAR.textContent),
      "it does not suggest a setting that is already applied");
    LEG.run(roster(40, 9, {page:"portrait"}));
    check(/turn the page to landscape/.test(LEG.BAR.textContent),
      "on a portrait page it suggests landscape, not portrait");

    LEG.run(roster(3, 2));
    check(LEG.BAR.hidden === true, "the warning goes away when the roster fits again");
    eq(LEG.BAR.textContent, "", "and takes its text with it");

    LEG.run(roster(4, 3, {layout:"swimlanes"}));
    check(LEG.BAR.hidden === true, "a swimlanes roster that fits raises no warning");

    const deep = roster(40, 9, {layout:"swimlanes"});
    check(LEG.scaleOf(deep) * 15 < 6, "the swimlanes test roster really is below the threshold");
    LEG.run(deep);
    check(LEG.BAR.hidden === false, "an unreadable swimlanes chart warns");
    check(/too small to read/.test(LEG.BAR.textContent), "with the same wording for what is wrong");
    check(/lane/.test(LEG.BAR.textContent),
      "and advice about lanes — got " + JSON.stringify(LEG.BAR.textContent));
    check(!/grade/.test(LEG.BAR.textContent),
      "not about pyramid grades — got " + JSON.stringify(LEG.BAR.textContent));

    LEG.run(roster(6, 12, {layout:"swimlanes", page:"portrait"}));
    check(/turn the page to landscape/.test(LEG.BAR.textContent),
      "many lanes on a portrait page suggests landscape — got " + JSON.stringify(LEG.BAR.textContent));
    LEG.run(roster(40, 2, {layout:"swimlanes", page:"landscape"}));
    check(/turn the page to portrait/.test(LEG.BAR.textContent),
      "a deep lane on a landscape page suggests portrait — got " + JSON.stringify(LEG.BAR.textContent));

    LEG.run(roster(40, 2, {layout:"swimlanes", page:"portrait"}));
    check(!/turn the page/.test(LEG.BAR.textContent),
      "two deep lanes on a portrait page get no rotation advice — rotating cannot help — got "
      + JSON.stringify(LEG.BAR.textContent));

    LEG.run(roster(40, 9));
    check(/grade/.test(LEG.BAR.textContent) && !/lane/.test(LEG.BAR.textContent),
      "the pyramid still talks about grades");

    const deepHive = roster(40, 9, {layout:"hive"});
    check(LEG.scaleOf(deepHive) * 15 < 6, "the hive test roster really is below the threshold");
    LEG.run(deepHive);
    check(LEG.BAR.hidden === false, "an unreadable hive chart warns");
    check(/cell/.test(LEG.BAR.textContent),
      "and advice about cells — got " + JSON.stringify(LEG.BAR.textContent));
    check(!/lane/.test(LEG.BAR.textContent),
      "never lane — got " + JSON.stringify(LEG.BAR.textContent));
    check(!/\bgrade\b/.test(LEG.BAR.textContent),
      "not about pyramid grades either — got " + JSON.stringify(LEG.BAR.textContent));

    LEG.run(roster(40, 9, {page:"square"}));
    check(LEG.BAR.hidden === false, "an unreadable roster on a square page still warns");
    check(!/turn the page/.test(LEG.BAR.textContent),
      "but a square page gets no rotation advice, in either direction — got "
      + JSON.stringify(LEG.BAR.textContent));
    LEG.run(roster(40, 9, {layout:"swimlanes", page:"square"}));
    check(LEG.BAR.hidden === false, "an unreadable swimlanes chart on a square page still warns");
    check(!/turn the page/.test(LEG.BAR.textContent),
      "and swimlanes gets no rotation advice on a square page either — got "
      + JSON.stringify(LEG.BAR.textContent));
  }

  {

    const DRAW = new Function("makeNode",
      ["FONT","FONTS","PAGES","ANGLES","DENSITY","G","SW","HV","MX","ZOOM_MAX","uid","LIMITS","ENUMS","ANCHORS","HEX6",
       "NAME_PT","MIN_NAME_PT","MIN_FACE_PT","SVGNS",

       "TEMPLATES","LAYOUTS"].map(grabConst).join("\n") + "\n" +
      ["validatePhoto","oneOf","clampText","isPlainObject","paint","xmlText","xmlAttr",
       "splitName","initials","tierOf","tierRole","subline","withAlpha","angleIndex","codeParts",
       "frameRect","frameLimit","clampFrame","computeLayout","gradeHeadingTexts",
       "buildBandGroups","buildBandStack","emitHeaderTexts","emitBandPeople",
       "computeTriangleLayout","computeHistogramLayout",
       "computePyramidLayout","computeTornadoLayout",
       "computeSwimlaneLayout","computeHiveLayout","computeMatrixLayout","nameSegs","ellipsize","fitName","toSVG","el","icon","clear","fill",
       "checkLegibility","describeChart","drawChart",

       "startView","layoutIcon","normalizeGradeLinks","newTier",
       "personLabelWidth","headNeedWidth","docFont",
       "newGroup","resolveGroupId","groupLabel","pruneGroups"].map(grabFn).join("\n") + "\n" +
      "let state = null;\n" +

      "const EVENTS = [];\n" +
      "const SHEET = makeNode('div');\n" +

      "Object.defineProperty(SHEET, 'innerHTML', {\n" +
      "  set(v){ EVENTS.push('insert');\n" +
      "          this.children.length = 0;\n" +
      "          if(/^<svg/.test(v)) this.children.push(makeNode('svg'));\n" +
      "          this._html = v; },\n" +
      "  get(){ return this._html || ''; }});\n" +
      "SHEET.querySelector = function(sel){\n" +
      "  return sel === 'svg' ? (this.children.find(c => c.tagName === 'svg') || null) : null; };\n" +
      "Object.defineProperty(SHEET, 'svg', {get(){ return this.querySelector('svg'); }});\n" +

      "const CLASSES = new Set();\n" +
      "SHEET.classList = {\n" +
      "  add(c){ CLASSES.add(c); },\n" +
      "  remove(c){ CLASSES.delete(c); },\n" +
      "  contains(c){ return CLASSES.has(c); },\n" +
      "  toggle(c, on){ if(on) CLASSES.add(c); else CLASSES.delete(c); }};\n" +
      "const TEXT = makeNode('div'), HINT = makeNode('span'), HINTR = makeNode('span');\n" +

      "const NOTE = makeNode('span'); NOTE.hidden = true;\n" +
      "const BAR = makeNode('div'); BAR.hidden = true;\n" +
      "function $(sel){\n" +
      "  if(sel === '#sheet') return SHEET;\n" +
      "  if(sel === '#chartText') return TEXT;\n" +
      "  if(sel === '#hint') return HINT;\n" +
      "  if(sel === '#hintRight') return HINTR;\n" +
      "  if(sel === '#previewNote') return NOTE;\n" +
      "  if(sel === '#legibility') return BAR;\n" +
      "  return null;\n" +
      "}\n" +
      "const meas = { font:'', measureText(t){ return {width: String(t||'').length * 6}; } };\n" +
      "const document = { createElement: makeNode,\n" +
      "  createElementNS(ns, tag){ const n = makeNode(tag); n.ns = ns; return n; },\n" +
      "  createTextNode(t){ const n = makeNode('#text'); n.textContent = t; return n; } };\n" +

      "const _describe = describeChart;\n" +
      "describeChart = function(){ EVENTS.push('label'); return _describe.apply(null, arguments); };\n" +
      "return {EVENTS, SHEET, TEXT, NOTE, draw(s){ EVENTS.length = 0; state = s; drawChart(); }};"
    )(function node(tag){

      const styleProps = {};
      return {tagName:tag, hidden:false, textContent:"", children:[], dataset:{}, attrs:{},
              style:{ setProperty(k,v){ styleProps[k]=v; },
                      removeProperty(k){ delete styleProps[k]; },
                      getPropertyValue(k){ return styleProps[k] || ""; } },
              appendChild(c){ this.children.push(c); return c; },
              setAttribute(k,v){ this.attrs[k]=String(v); },
              get firstChild(){ return this.children[0]; },
              removeChild(c){ this.children.splice(this.children.indexOf(c),1); return c; }};
    });

    const drawn = fresh("current");
    DRAW.draw(drawn);

    eq(JSON.stringify(DRAW.EVENTS), JSON.stringify(["insert","label"]),
      "the SVG is inserted first and labelled second — labelling first names the previous render");
    check(DRAW.SHEET.svg !== null, "an SVG really was inserted");
    const label = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["aria-label"];
    const role  = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["role"];
    eq(role, "img", "the SVG on the page carries role=img");
    check(label && label.length > 0, "and an accessible name — got " + JSON.stringify(label));
    check(label && label.indexOf(drawn.title) === 0,
      "the name starts with the chart's title");
    check(label && /26 people/.test(label), "and states the headcount — got " + JSON.stringify(label));

    check(DRAW.TEXT.children.length > 0, "the text description was built");
    const heading = DRAW.TEXT.children[0];
    eq(heading.tagName, "h2", "it opens with a heading");
    eq(heading.textContent, label, "the heading and the SVG name say the same thing");
    const dl = DRAW.TEXT.children[1];
    eq(dl.tagName, "dl", "the grades are a description list");
    eq(dl.children.length, drawn.tiers.length * 2,
      "one term and one definition per grade");
    check(dl.children[0].textContent.indexOf(drawn.tiers[0].label) === 0,
      "the first term names the first grade");

    check(/a pyramid of/.test(label), "the pyramid calls itself a pyramid");
    check(!/swimlane/i.test(label), "and not swimlanes");
    {
      const lanes = fresh("current");
      lanes.layout = "swimlanes";
      DRAW.draw(lanes);
      const lab = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["aria-label"];
      check(lab && /swimlanes/i.test(lab),
        "a swimlanes chart says swimlanes — got " + JSON.stringify(lab));
      check(lab && !/pyramid/i.test(lab), "and never calls itself a pyramid");
      check(lab && /lanes/.test(lab), "counting lanes rather than grades — got " + JSON.stringify(lab));
      const laneIds = [];
      lanes.tiers.forEach(t => {
        if(t.merge && laneIds.length) laneIds[laneIds.length - 1].push(t.id);
        else laneIds.push([t.id]);
      });
      const expectedLanes = laneIds.filter(ids =>
        lanes.people.some(p => ids.indexOf(p.tierId) >= 0)).length;
      check(lab && lab.indexOf(expectedLanes + " lanes") >= 0,
        "shared and empty grades are reflected in the accessible lane count — got "
        + JSON.stringify(lab));
      check(lab && /26 people/.test(lab), "with the same headcount");
      eq(DRAW.TEXT.children[0].textContent, lab,
        "and the text equivalent still agrees with the name");

      eq(DRAW.TEXT.children[1].children.length, lanes.tiers.length * 2,
        "the description still lists every grade, including any that draw no lane");
    }

    {
      const two = fresh("current");
      two.layout = "hive";
      two.tiers = two.tiers.slice(0, 2);
      const twoIds = new Set(two.tiers.map(t => t.id));
      two.people = two.people.filter(p => twoIds.has(p.tierId));
      DRAW.draw(two);
      const lab2 = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["aria-label"];
      check(lab2 && lab2.indexOf("a hive of 2 cells") >= 0,
        "a two-grade hive roster announces \"a hive of 2 cells\" — got " + JSON.stringify(lab2));

      const withEmpty = fresh("current");
      withEmpty.layout = "hive";
      withEmpty.tiers = withEmpty.tiers.slice(0, 3);
      const occupiedIds = new Set(withEmpty.tiers.slice(0, 2).map(t => t.id));
      withEmpty.people = withEmpty.people.filter(p => occupiedIds.has(p.tierId));
      DRAW.draw(withEmpty);
      const labEmpty = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["aria-label"];
      check(labEmpty && labEmpty.indexOf("a hive of 2 cells") >= 0,
        "three grades but one empty still announces \"a hive of 2 cells\", the drawn count — got "
        + JSON.stringify(labEmpty));
      check(labEmpty && labEmpty.indexOf("3 cells") < 0,
        "never the raw tiers.length of 3 — got " + JSON.stringify(labEmpty));

      const one = fresh("current");
      one.layout = "hive";
      one.tiers = one.tiers.slice(0, 1);
      one.people = one.people.filter(p => p.tierId === one.tiers[0].id);
      DRAW.draw(one);
      const lab1 = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["aria-label"];
      check(lab1 && lab1.indexOf("a hive of 1 cell") >= 0,
        "and a one-grade hive roster says \"cell\", singular — got " + JSON.stringify(lab1));
      check(lab1 && lab1.indexOf("1 cells") < 0, "never \"1 cells\" — got " + JSON.stringify(lab1));
    }

    const second = fresh("unicode");
    DRAW.draw(second);
    eq(JSON.stringify(DRAW.EVENTS), JSON.stringify(["insert","label"]),
      "a redraw keeps the same order");
    const reLabel = DRAW.SHEET.svg && DRAW.SHEET.svg.attrs["aria-label"];
    check(reLabel && reLabel.indexOf(second.title) === 0,
      "and the freshly inserted SVG carries the new name — got " + JSON.stringify(reLabel));

    const empty = fresh("current");
    empty.tiers = []; empty.people = [];
    DRAW.draw(empty);
    check(DRAW.EVENTS.indexOf("label") >= 0,
      "an empty chart is still described, rather than leaving the old text in place");
    check(DRAW.TEXT.children.length > 0, "the empty state produces a description");
    check(/0 people|0 grades/.test(DRAW.TEXT.children[0].textContent),
      "which reports that it is empty — got "
      + JSON.stringify(DRAW.TEXT.children[0].textContent));

    {
      const cardTops = [];
      (function walk(n){
        for(const c of (n?.children || [])){
          if(c.className === "start-card-top") cardTops.push(c);
          walk(c);
        }
      })(DRAW.SHEET);

      const tplSrc = /const TEMPLATES = \[[\s\S]*?\n\];/.exec(SCRIPT);
      const tplLayouts = [];
      { const re = /layout:"([^"]+)"/g; let m;
        while((m = re.exec(tplSrc ? tplSrc[0] : ""))) tplLayouts.push(m[1]); }
      check(tplLayouts.length === 3,
        "found three template layouts in TEMPLATES — got " + tplLayouts.length);
      check(cardTops.length === 3,
        "three template cards each carry a .start-card-top — got " + cardTops.length);

      const LAYOUT_LABELS = {pyramid:"Pyramid", swimlanes:"Swimlanes", hive:"Hive"};
      cardTops.forEach((top, i) => {
        const svgIcon = (top?.children || []).find(c => c.tagName === "svg");
        const expected = (LAYOUT_LABELS[tplLayouts[i]] || "?") + " layout";
        check(svgIcon?.attrs?.role === "img",
          "card " + i + "'s layout icon carries role=img — got "
          + JSON.stringify(svgIcon?.attrs?.role));
        check(svgIcon?.attrs?.["aria-label"] === expected,
          "card " + i + "'s layout icon is labelled " + JSON.stringify(expected)
          + " — got " + JSON.stringify(svgIcon?.attrs?.["aria-label"]));

        const useEl = (svgIcon?.children || []).find(c => c.tagName === "use");
        const expectedHref = "#i-" + tplLayouts[i];
        check(useEl?.attrs?.href === expectedHref,
          "card " + i + "'s layout icon draws " + JSON.stringify(expectedHref)
          + " — got " + JSON.stringify(useEl?.attrs?.href));
      });

      const privacyBtns = [];
      let foot = null;
      (function walk(n){
        for(const c of (n?.children || [])){
          if(c?.attrs?.["data-cmd"] === "infoPrivacy") privacyBtns.push(c);
          if(c.className === "start-foot") foot = c;
          walk(c);
        }
      })(DRAW.SHEET);
      check(privacyBtns.length === 1,
        'exactly one start-view control carries data-cmd="infoPrivacy" — got '
        + privacyBtns.length);
      const footText = (foot?.children || []).map(c => c?.textContent || "").join("");
      check(/Everything processed offline on your device · nothing uploaded/.test(footText),
        "the start view footer states the offline-processing claim — got "
        + JSON.stringify(footText));
    }

    eq(DRAW.NOTE.hidden, true, "no grades, no live-preview note");
    DRAW.draw(fresh("current"));
    eq(DRAW.NOTE.hidden, false, "a drawn chart brings it back");
    DRAW.draw(empty);
    eq(DRAW.NOTE.hidden, true, "and deleting every grade hides it again");

    {
      const has = () => DRAW.SHEET.classList.contains("clear");

      const clearBg = fresh("current");
      clearBg.bg = "transparent";
      DRAW.draw(clearBg);
      check(has(), "a transparent chart puts the checkerboard on the sheet");

      const gone = fresh("current");
      gone.bg = "transparent";
      gone.tiers = []; gone.people = [];
      DRAW.draw(gone);
      check(!has(),
        "and the empty state that follows does NOT inherit it — an empty sheet is plain");
      check(DRAW.SHEET.querySelector("svg") === null,
        "there is no chart on it either");

      const said = DRAW.TEXT.children[0] && DRAW.TEXT.children[0].textContent;
      check(/0 people/.test(said || ""),
        "and the text description is the empty one — got " + JSON.stringify(said));
      check(!/26 people/.test(said || ""),
        "not the one belonging to the chart that was there before");

      const backOn = fresh("current");
      backOn.bg = "transparent";
      DRAW.draw(backOn);
      check(has(), "drawing a transparent chart again puts the class back");
      const white = fresh("current");
      white.bg = "white";
      DRAW.draw(white);
      check(!has(), "and a white chart takes it off");
    }
  }

  {
    const TABS = new Function("makeNode",
      ["FONT"].map(grabConst).join("\n") + "\n" +
      grabFn("selectTab") + "\n" +
      "const TABS = ['file','roster','grades','design','info'].map(function(name){\n" +
      "  const b = makeNode('button'); b.dataset.tab = name; b.className = 'rb-tab';\n" +
      "  b.focused = false; b.focus = function(){ this.focused = true; };\n" +
      "  return b; });\n" +
      "const PANES = ['file','roster','grades','design','info'].map(function(name){\n" +
      "  const p = makeNode('div'); p.dataset.pane = name; p.className = 'rb-pane';\n" +
      "  return p; });\n" +

      "const DISMISSED = {menu:0, panel:0};\n" +
      "function closeMenu(){ DISMISSED.menu++; }\n" +
      "function closeGradePanel(){ DISMISSED.panel++; }\n" +

      "function syncRibbonOverflow(){}\n" +
      "const document = { querySelectorAll(sel){\n" +
      "  if(sel === '.rb-tab')  return TABS;\n" +
      "  if(sel === '.rb-pane') return PANES;\n" +
      "  return []; } };\n" +
      "return {TABS, PANES, selectTab, DISMISSED};"
    )(function node(tag){
      const classes = new Set();
      return {tagName:tag, dataset:{}, attrs:{}, tabIndex:undefined, focused:false,
              get className(){ return [...classes].join(" "); },
              set className(v){ classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c=>classes.add(c)); },
              classList:{ toggle(c, on){ if(on) classes.add(c); else classes.delete(c); },
                          contains(c){ return classes.has(c); } },
              setAttribute(k,v){ this.attrs[k]=String(v); },
              focus(){ this.focused = true; }};
    });

    TABS.selectTab("file", false);

    const active   = TABS.TABS.filter(t => t.attrs["aria-selected"] === "true");
    const inactive = TABS.TABS.filter(t => t.attrs["aria-selected"] === "false");
    eq(active.length, 1, "exactly one tab is marked selected after boot");
    eq(active[0].dataset.tab, "file", "and it is the File tab");
    eq(inactive.length, 4, "the other four are explicitly marked not selected");
    check(!TABS.TABS.some(t => t.attrs["aria-selected"] === undefined),
      "no tab is left without an aria-selected state");

    eq(active[0].tabIndex, 0, "the active tab is the one Tab reaches");
    check(inactive.every(t => t.tabIndex === -1),
      "and the rest are out of the tab order — got "
      + JSON.stringify(inactive.map(t => t.tabIndex)));
    check(active[0].classList.contains("on"), "the active tab carries the visual class too");
    check(inactive.every(t => !t.classList.contains("on")),
      "and the inactive ones do not — class and aria must not disagree");

    const shown = TABS.PANES.filter(p => p.classList.contains("on"));
    eq(shown.length, 1, "exactly one pane is shown");
    eq(shown[0].dataset.pane, "file", "and it is the File pane");

    check(!TABS.TABS.some(t => t.focused), "initialising the tabs does not move focus");

    TABS.selectTab("design", true);
    const now = TABS.TABS.find(t => t.dataset.tab === "design");
    eq(now.attrs["aria-selected"], "true", "the newly selected tab is marked selected");
    eq(now.tabIndex, 0, "and becomes the tab stop");
    check(now.focused, "and takes focus when asked to");
    eq(TABS.TABS.find(t => t.dataset.tab === "file").attrs["aria-selected"], "false",
      "the previous tab gives up its selected state");
    eq(TABS.TABS.find(t => t.dataset.tab === "file").tabIndex, -1,
      "and leaves the tab order");
    eq(TABS.PANES.filter(p => p.classList.contains("on")).length, 1,
      "still exactly one pane is shown");

    eq(TABS.DISMISSED.menu, 2, "every tab switch dismisses the save menu");
    eq(TABS.DISMISSED.panel, 2, "and the grade panel with it");

    check(!/closeOfficePop/.test(SCRIPT), "the script defines no closeOfficePop — there is no such popup to dismiss");
  }

  {

    const SLOT_HITTABLE = !/\.g-drop-slot\{[^}]*pointer-events:none/.test(HTML);

    const DRAG_HIDES = /\.g-chip\.dragging\{display:none\}/.test(HTML);

    const WIDTHS = {t1:90, t2:150, t3:118, t4:118};

    function dsel(n, sel){

      if(typeof sel !== "string") return false;
      const not = /:not\(\.([A-Za-z0-9_-]+)\)$/.exec(sel);
      if(not) sel = sel.slice(0, not.index);
      const m = /^\.([A-Za-z0-9_-]+)((?:\[[a-z-]+="[^"]*"\])*)$/.exec(sel);
      if(!m) throw new Error("stub selector: unsupported " + sel);
      if((" " + n.className + " ").indexOf(" " + m[1] + " ") < 0) return false;
      if(not && (" " + n.className + " ").indexOf(" " + not[1] + " ") >= 0) return false;
      return (m[2].match(/\[[a-z-]+="[^"]*"\]/g) || []).every(function(a){
        const kv = /^\[([a-z-]+)="([^"]*)"\]$/.exec(a);
        const key = kv[1].replace(/^data-/, "").replace(/-([a-z])/g, (s, c) => c.toUpperCase());
        return n.dataset[key] === kv[2];
      });
    }

    function dnode(tag){
      const n = {
        tagName:tag, children:[], dataset:{}, attrs:{}, style:{}, listeners:{},
        className:"", textContent:"", value:"", parentNode:null,
        rect:{left:0, top:0, right:0, bottom:0, width:0, height:0},
        addEventListener(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); },
        appendChild(c){ if(c.parentNode) c.parentNode.removeChild(c); c.parentNode = this;
                        this.children.push(c); return c; },
        removeChild(c){
          const i = this.children.indexOf(c);
          if(i < 0) throw new Error("stub removeChild: not a child");
          this.children.splice(i, 1); c.parentNode = null; return c;
        },
        remove(){ if(this.parentNode) this.parentNode.removeChild(this); },

        insertBefore(c, ref){
          if(ref === c) ref = c.nextSibling;
          let at = this.children.length;
          if(ref != null){
            at = this.children.indexOf(ref);
            if(at < 0) throw new Error("stub insertBefore: the reference is not a child");
          }
          if(c.parentNode){
            const i = c.parentNode.children.indexOf(c);
            c.parentNode.children.splice(i, 1);
            if(c.parentNode === this && i < at) at--;
          }
          c.parentNode = this; this.children.splice(at, 0, c); return c;
        },
        get firstChild(){ return this.children[0] || null; },
        get nextSibling(){
          if(!this.parentNode) return null;
          return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null;
        },
        setAttribute(k, v){ this.attrs[k] = String(v); },
        getBoundingClientRect(){ return this.rect; },
        contains(o){ for(let p = o; p; p = p.parentNode) if(p === this) return true; return false; },
        closest(sel){ for(let p = this; p; p = p.parentNode) if(dsel(p, sel)) return p; return null; },
        querySelector(sel){
          for(const c of this.children){
            if(dsel(c, sel)) return c;
            const deep = c.querySelector(sel);
            if(deep) return deep;
          }
          return null;
        },
        querySelectorAll(sel){
          const out = [];
          (function walk(p){ for(const c of p.children){ if(dsel(c, sel)) out.push(c); walk(c); } })(this);
          return out;
        }
      };
      n.classList = {
        add(c){ if(!n.classList.contains(c)) n.className = (n.className + " " + c).trim(); },
        remove(c){ n.className = n.className.split(/\s+/).filter(x => x && x !== c).join(" "); },
        contains(c){ return (" " + n.className + " ").indexOf(" " + c + " ") >= 0; }
      };
      return n;
    }

    const D = new Function("makeNode", "SLOT_HITTABLE", "DRAG_HIDES", "WIDTHS", `
      const GAP = 6, ORIGIN = 100, ROW = 66;
      const TIERS   = makeNode("div");
      const OUTSIDE = makeNode("div");   // somewhere else on the page
      const CALLS = {reorder:[], offReorder:[], closed:0, captured:[]};
      TIERS.setPointerCapture = function(id){ CALLS.captured.push(id); };
      /* The deferred hide is the whole point of the dragstart trap, so time is
         a queue this suite drains by hand rather than something that happens. */
      const LATER = [];
      function setTimeout(fn){ LATER.push(fn); return LATER.length; }
      /* flexbox, as far as this strip needs it: children left to right at one
         gap, and a display:none chip contributing neither box nor gap. */
      function relayout(){
        let x = ORIGIN;
        for(const c of TIERS.children){
          if(DRAG_HIDES && c.classList.contains("dragging")){
            c.rect = {left:0, top:0, right:0, bottom:0, width:0, height:0};
            continue;
          }
          const isSlot = c.classList.contains("g-drop-slot");
          const w = isSlot ? parseFloat(c.style.width) : WIDTHS[c.dataset.id];
          /* A slot of zero width is the macOS symptom itself — the strip does not
             open up and the dashed box collapses to its own two borders. It has to
             lay out, not throw: a throw here abandons the section and leaves the
             assertion that was about to go red reported as coverage. A chip with
             no width is still a broken stub and still throws. */
          if(!(w > 0) && !(isSlot && w === 0))
            throw new Error("stub layout: no width for " + (c.className || c.tagName));
          c.rect = {left:x, top:0, right:x + w, bottom:ROW, width:w, height:ROW};
          x += w + GAP;
        }
      }
      /* What the browser would hand the handlers: the innermost thing painted at
         that point. A chip resolves to its face, which is what makes
         .closest(".g-chip") do real work here. */
      function elementFromPoint(x, y){
        relayout();
        if(y < 0 || y > ROW) return OUTSIDE;
        for(const c of TIERS.children){
          if(DRAG_HIDES && c.classList.contains("dragging")) continue;
          if(c.classList.contains("g-drop-slot") && !SLOT_HITTABLE) continue;
          if(x >= c.rect.left && x < c.rect.right)
            return c.classList.contains("g-drop-slot") ? c : (c.firstChild || c);
        }
        return x >= ORIGIN ? TIERS : OUTSIDE;
      }
      const document = {
        createElement: makeNode,
        createElementNS(ns, tag){ const n = makeNode(tag); n.ns = ns; return n; },
        createTextNode(t){ const n = makeNode("#text"); n.textContent = t; return n; },
        elementFromPoint
      };
      function $(sel){ return sel === "#tiers" ? TIERS : null; }
      function closeGradePanel(){ CALLS.closed++; }
      /* Recorded, not performed: what reorderGrade then does to the document is
         test/document.js's, and one commit per drop is its assertion. What this
         suite owns is that the drop asks for the move the slot was showing. */
      function reorderGrade(a, b, after){ CALLS.reorder.push([a, b, after]); return true; }
      /* Defined so the ROW surface's own onDrop resolves inside this sandbox
         too — makeDragSurface's config is pulled in whole (see below), and a
         mutation that swapped the two onDrop entries would otherwise throw a
         ReferenceError building gradeDragSurface's config instead of failing a
         named assertion. Expected to stay empty here; offReorder.length is
         asserted after the first real drop. */
      function reorderPerson(a, b, after){ CALLS.offReorder.push([a, b, after]); return true; }
      ` +
      grabConst("SVGNS") + "\n" +
      ["el","icon","clear","fill","gradeChip","gradeChipFor","makeDragSurface"]
        .map(grabFn).join("\n") + "\n" +

      grabConst("gradeDragSurface") + `
      function fire(type, ev){ relayout(); (TIERS.listeners[type] || []).forEach(fn => fn(ev)); }
      function evAt(x, extra){
        relayout();
        /* buttons defaults to "one held down", which is what every event in a
           drag carries. §6g overrides it: a pointermove with nothing held is the
           whole difference between a drag and a hover. */
        const e = {clientX:x, clientY:ROW/2, pointerId:7, button:0, buttons:1,
                   pointerType:"mouse",
                   prevented:false, preventDefault(){ this.prevented = true; },
                   relatedTarget:TIERS,
                   dataTransfer:{effectAllowed:"", dropEffect:"", setData(){}}};
        e.target = elementFromPoint(x, ROW/2);
        for(const k in (extra || {})) e[k] = extra[k];
        return e;
      }
      return {
        TIERS, CALLS, OUTSIDE, ORIGIN, ROW, fire, evAt, relayout,
        render(tiers){ fill(TIERS, tiers.map(gradeChip)); relayout(); },
        flush(){ let n = 0; while(LATER.length){ LATER.shift()(); n++; } return n; },
        pending(){ return LATER.length; },
        drop(){ return gradeDragSurface.pendingDrop(); },
        /* instrumentation for §6f: the surface's own state, read without
           disturbing it */
        dragW(){ return gradeDragSurface.dragSize(); },
        dragId(){ return gradeDragSurface.dragId(); },
        pointerDragging(){ return gradeDragSurface.pointerDragging(); },
        hasPointer(){ return gradeDragSurface.hasPointer(); },
        slot(){ return TIERS.querySelector(".g-drop-slot"); },
        slots(){ return TIERS.querySelectorAll(".g-drop-slot"); },
        hidden(){ return TIERS.querySelectorAll(".dragging").map(c => c.dataset.id); },
        /* the strip as the DOM holds it: [slot] for the placeholder, and a
           chip taken out of the flow in brackets — it is still a child, it
           just contributes no box and no gap */
        order(){ return TIERS.children.map(c =>
          c.classList.contains("g-drop-slot") ? "[slot]"
          : c.classList.contains("dragging") ? "(" + c.dataset.id + ")"
          : c.dataset.id); },
        chip(id){ return gradeChipFor(id); },
        face(id){ return gradeChipFor(id).firstChild; },
        rect(id){ relayout(); return gradeChipFor(id).getBoundingClientRect(); },
        slotRect(){ relayout(); const s = TIERS.querySelector(".g-drop-slot");
                    return s && s.getBoundingClientRect(); },
        hit(x){ return elementFromPoint(x, ROW/2); }
      };
    `)(dnode, SLOT_HITTABLE, DRAG_HIDES, WIDTHS);

    const GRADES = [{id:"t1", code:"P",  label:"Partner"},
                    {id:"t2", code:"D",  label:"Director"},
                    {id:"t3", code:"M",  label:"Manager"},
                    {id:"t4", code:"SC", label:"Senior Consultant"}];

    const inChip = (id, side) => {
      const r = D.rect(id);
      return r.left + r.width * (side === "left" ? 0.25 : 0.75);
    };

    const slotWidth = () => { const s = D.slot(); return s ? s.style.width : "(no slot)"; };

    const inGap = () => { const r = D.slotRect(); return r ? r.left + 4 : -1; };
    const slotAria  = () => { const s = D.slot(); return s ? s.attrs["aria-hidden"] : "(no slot)"; };
    const startDrag = id => {
      D.render(GRADES);
      D.fire("dragstart", D.evAt(inChip(id, "left"), {target:D.face(id)}));
      return id;
    };

    D.render(GRADES);
    eq(D.order().join(" "), "t1 t2 t3 t4", "the strip starts as the grades are ordered");
    D.fire("dragstart", D.evAt(inChip("t2", "left"), {target:D.face("t2")}));
    eq(D.hidden().join(","), "",
      "dragstart does NOT hide the chip while it runs — some browsers take the drag "
      + "image from the element after the handler returns and cancel a drag that has "
      + "nothing left to take it from");
    eq(D.pending(), 1, "it defers the hide by one task instead");
    const closedUp = D.rect("t3").left;
    D.flush();
    eq(D.hidden().join(","), "t2", "and that task is what takes the chip out of the flow");
    eq(D.rect("t3").left, closedUp - (WIDTHS.t2 + 6),
      "which is what closes the strip up behind it: everything after the dragged "
      + "chip moves back by its width and the gap it was holding, leaving room for "
      + "the slot to stand in a gap rather than widening the ribbon");
    eq(D.slots().length, 0, "no slot yet — the pointer has not been over a target");

    D.fire("dragover", D.evAt(inChip("t3", "left")));
    eq(JSON.stringify(D.drop()), '{"id":"t3","after":false}',
      "the left half of a chip is a drop before it");
    eq(D.order().join(" "), "t1 (t2) [slot] t3 t4",
      "…and that is where the slot stands: in the gap, with the dragged chip gone "
      + "from the position it is leaving");
    const firstSlot = D.slot();
    eq(D.slots().length, 1, "exactly one slot exists");
    eq(slotAria(), "true",
      "the slot is decoration — the move it previews is not announced twice");
    eq(slotWidth(), "150px",
      "and it is drawn at the dragged chip's own measured width (t2 is 150 here), so "
      + "the strip does not change width when a chip is taken out of it");

    D.fire("dragover", D.evAt(inChip("t3", "right")));
    eq(JSON.stringify(D.drop()), '{"id":"t3","after":true}',
      "the right half of the same chip is a drop after it");
    eq(D.order().join(" "), "t1 (t2) t3 [slot] t4", "and the slot moves to the other side of it");
    eq(D.slots().length, 1, "still exactly one slot — #tiers never holds two");
    check(D.slot() === firstSlot,
      "and it is the same element moved, not a second one built at the new position "
      + "with the first left behind at the old one");

    const inSlot = inGap();

    const gapSlot = D.slot();
    check(D.hit(inSlot) !== gapSlot && !D.hit(inSlot).closest(".g-chip"),
      "hit-testing inside the slot finds no chip — the slot itself is not hittable, "
      + "and the strip behind it is not a chip either");
    D.fire("dragover", D.evAt(inSlot));
    eq(JSON.stringify(D.drop()), '{"id":"t3","after":true}',
      "a dragover over the slot leaves the answer exactly as it was");
    eq(D.order().join(" "), "t1 (t2) t3 [slot] t4",
      "…and leaves the slot standing, so the strip does not close up under the "
      + "pointer and re-open on the next event");
    D.fire("dragover", D.evAt(inSlot, {target:gapSlot || D.TIERS}));
    eq(JSON.stringify(D.drop()), '{"id":"t3","after":true}',
      "and so does one that arrives with the slot itself as its target, for a "
      + "surface that hit-tests it anyway");

    D.CALLS.reorder.length = 0;
    D.CALLS.offReorder.length = 0;
    D.fire("drop", D.evAt(inSlot));
    eq(JSON.stringify(D.CALLS.reorder), '[["t2","t3",true]]',
      "the drop hands reorderGrade the source, the target and the side — the same "
      + "three arguments the thin edge marker produced");
    eq(D.CALLS.offReorder.length, 0,
      "…and never calls reorderPerson — the grade surface's onDrop names "
      + "reorderGrade only");
    eq(D.slots().length, 0, "the slot is gone");
    eq(D.hidden().join(","), "", "and the dragged chip is back in the strip");
    eq(D.drop(), null, "with nothing left to drop");

    startDrag("t2"); D.flush();
    D.fire("dragover", D.evAt(inChip("t3", "left")));
    eq(D.hidden().join(","), "t2", "mid-drag the chip is out of the flow");
    D.fire("dragleave", D.evAt(inChip("t3", "left"), {relatedTarget:D.OUTSIDE}));
    eq(D.slots().length, 0, "a drag that leaves the strip takes the slot with it");
    eq(D.hidden().join(","), "",
      "and puts the chip back — a strip left holding a hidden chip is a grade that "
      + "vanished from the ribbon");
    eq(D.order().join(" "), "t1 t2 t3 t4", "the strip is the document's order again");
    D.fire("dragover", D.evAt(inChip("t3", "left")));
    eq(D.hidden().join(","), "t2", "coming back takes it out again");
    eq(D.order().join(" "), "t1 (t2) [slot] t3 t4", "and stands the slot back in the gap");
    D.fire("dragend", {});
    eq(D.slots().length, 0, "dragend clears the slot");
    eq(D.hidden().join(","), "", "and restores the chip");

    D.render(GRADES);
    D.fire("dragstart", D.evAt(inChip("t2", "left"), {target:D.face("t2")}));
    D.fire("dragend", {});
    D.flush();
    eq(D.hidden().join(","), "",
      "a hide still queued when the drag ends hides nothing — it reads the drag id "
      + "that dragend has already cleared");

    D.render(GRADES);
    D.CALLS.reorder.length = 0;
    const from = inChip("t2", "left");
    D.fire("pointerdown", D.evAt(from, {target:D.face("t2")}));
    D.fire("pointermove", D.evAt(from + 4, {target:D.face("t2")}));
    eq(D.hidden().join(","), "",
      "four pixels is a click, not a drag — the six-pixel threshold is untouched");
    eq(D.slots().length, 0, "and nothing is previewed for it");
    D.fire("pointermove", D.evAt(from + 8, {target:D.face("t2")}));
    eq(D.hidden().join(","), "t2",
      "past six pixels the fallback takes the chip out of the flow, with no task "
      + "to wait for — nothing is taking a drag image on this path");
    eq(JSON.stringify(D.CALLS.captured), "[7]",
      "…capturing on the strip, which is not the element it just hid");
    D.fire("pointermove", D.evAt(inChip("t3", "left")));
    eq(D.order().join(" "), "t1 (t2) [slot] t3 t4",
      "and it produces the same slot in the same gap as native DnD");
    eq(slotWidth(), "150px", "at the same width");
    eq(JSON.stringify(D.drop()), '{"id":"t3","after":false}', "for the same drop");
    const gapX = inGap();
    D.fire("pointermove", D.evAt(gapX));
    eq(JSON.stringify(D.drop()), '{"id":"t3","after":false}',
      "the gap is not nowhere on this path either — elementFromPoint returns the "
      + "strip there, and the answer has to survive it");
    D.fire("pointerup", D.evAt(gapX));
    eq(JSON.stringify(D.CALLS.reorder), '[["t2","t3",false]]',
      "and pointer-up asks for the same one move");
    eq(D.slots().length, 0, "leaving no slot behind");
    eq(D.hidden().join(","), "", "and no hidden chip");

    for(const [id, want] of [["t1","90px"], ["t3","118px"], ["t2","150px"]]){
      startDrag(id); D.flush();
      D.fire("dragover", D.evAt(inChip(id === "t4" ? "t1" : "t4", "left")));
      eq(slotWidth(), want,
        "dragging " + id + " draws the slot at that chip's width");
      D.fire("dragend", {});
    }

    D.render(GRADES);
    D.fire("dragstart", D.evAt(inChip("t2", "left"), {target:D.face("t2")}));
    D.flush();
    D.fire("dragover", D.evAt(inChip("t3", "left")));
    const classes = [];
    (function walk(n){ for(const c of n.children){ classes.push(c.className); walk(c); } })(D.TIERS);
    check(!classes.some(c => /drop-before|drop-after/.test(c)),
      "no chip is left carrying a before/after marker class — got "
      + JSON.stringify(classes.filter(c => /drop/.test(c))));
    D.fire("dragend", {});

    D.render(GRADES);
    D.CALLS.reorder.length = 0;
    const mStart = inChip("t2", "left");
    D.fire("pointerdown", D.evAt(mStart, {target:D.face("t2")}));
    D.fire("dragstart", D.evAt(mStart + 3, {target:D.face("t2")}));
    eq(D.dragW(), WIDTHS.t2,
      "the native dragstart measures the chip while it is still in the flow");
    check(!D.pointerDragging(),
      "and it does so without the pointer path having claimed the gesture — three "
      + "pixels is under the six-pixel threshold, so dragstart's one guard "
      + "(gradePointer.dragging) does not fire and both paths are now live");
    D.flush();
    eq(D.hidden().join(","), "t2",
      "the deferred hide then takes the chip out of the flow, where it measures zero");

    D.fire("pointermove", D.evAt(inChip("t3", "left")));
    check(!D.pointerDragging(),
      "a pointermove past six pixels does NOT claim a gesture the native path is "
      + "already running — dragstart refuses to start a second drag over the "
      + "fallback's, and the fallback owes it the same refusal in return");
    eq(D.dragW(), WIDTHS.t2,
      "and the width must still be the chip's own: the second beginGradeDrag "
      + "re-measures a chip that display:none has already collapsed, and the number "
      + "it reads is what every slot from here on is drawn at");
    D.fire("dragover", D.evAt(inChip("t3", "left")));
    eq(slotWidth(), WIDTHS.t2 + "px",
      "so the slot is still drawn at the dragged chip's width…");
    const mRect = D.slotRect();
    eq(mRect ? mRect.width : "(no slot)", WIDTHS.t2,
      "…and still renders as a chip-width gap rather than collapsing to its own "
      + "two dashed borders, which is the hairline the screenshot shows");
    eq(D.order().join(" "), "t1 (t2) [slot] t3 t4",
      "the strip still shows the chip's destination as somewhere it would fit");
    D.fire("dragend", {});
    D.fire("pointerup", D.evAt(inChip("t3", "left")));

    D.render(GRADES);
    const wStart = inChip("t2", "left");
    D.fire("pointerdown", D.evAt(wStart, {target:D.face("t2")}));
    D.fire("dragstart", D.evAt(wStart, {target:D.face("t2")}));
    const overSelf = D.evAt(wStart, {target:D.face("t2")});
    D.fire("dragover", overSelf);
    check(overSelf.prevented,
      "a dragover while the pointer is still over the chip being dragged calls "
      + "preventDefault — a drag in progress over its own source is a valid drop "
      + "target region, and withholding it is what paints the not-allowed cursor");
    eq(overSelf.dataTransfer.dropEffect, "move",
      "…and sets dropEffect to move, which is the cursor the user gets");

    D.render(GRADES);
    const lastStart = inChip("t4", "left");
    D.fire("pointerdown", D.evAt(lastStart, {target:D.face("t4")}));
    D.fire("dragstart", D.evAt(lastStart, {target:D.face("t4")}));
    D.flush();
    eq(D.hidden().join(","), "t4", "the last chip is out of the flow");
    check(!D.hit(lastStart).closest(".g-chip"),
      "and nothing has slid under the pointer to replace it — past the end of the "
      + "strip there is no chip to hit");
    const overEnd = D.evAt(lastStart);
    D.fire("dragover", overEnd);
    check(overEnd.prevented,
      "a drag held over the gap the last chip left still calls preventDefault — "
      + "otherwise the cursor says not-allowed for as long as the user holds still, "
      + "and the drag reads as never having started");
    D.fire("dragend", {});

    D.render(GRADES);
    const cStart = inChip("t2", "left");
    D.fire("pointerdown", D.evAt(cStart, {target:D.face("t2")}));
    D.fire("dragstart", D.evAt(cStart, {target:D.face("t2")}));
    D.flush();
    eq(D.dragId(), "t2", "the native drag is under way and knows which chip it holds");
    D.fire("pointercancel", D.evAt(cStart));
    eq(D.dragId(), "t2",
      "a pointercancel from the surface handing the gesture to native DnD must not "
      + "empty the native drag's own state — clearGradeDrag is shared, and the drag "
      + "it disarms here is the one that is still running");
    eq(D.hidden().join(","), "t2",
      "…nor put the dragged chip back in the strip, which is what makes the gesture "
      + "look like it never started");
    const afterCancel = D.evAt(inChip("t3", "left"));
    D.fire("dragover", afterCancel);
    check(afterCancel.prevented,
      "and dragover over a perfectly good target still calls preventDefault — with "
      + "gradeDragId nulled it returns at its first line, so dropEffect stays none "
      + "and the cursor says not-allowed for the whole of the drag");
    D.fire("dragend", {});

    D.render(GRADES);
    const lStart = inChip("t2", "left");
    D.fire("pointerdown", D.evAt(lStart, {target:D.face("t2")}));
    D.fire("dragstart", D.evAt(lStart, {target:D.face("t2")}));
    D.flush();
    D.fire("dragend", {});
    check(!D.hasPointer(),
      "the end of a native drag also ends the press the fallback is watching — a "
      + "native drag swallows the pointerup, so anything dragend leaves behind is "
      + "a live press record with no button held, and the next hover across the "
      + "strip starts a drag nobody asked for");

    D.render(GRADES);
    D.fire("dragend", {});
    const foreign = D.evAt(inChip("t3", "left"));
    delete foreign.dataTransfer.setData;
    D.fire("dragover", foreign);
    check(!foreign.prevented,
      "a drag that #tiers did not start is not accepted by it — a photo on its way "
      + "to the chart crosses the grade strip, and the strip must not offer itself "
      + "as the target for it");
    eq(D.slots().length, 0, "and nothing is previewed for it");

    D.render(GRADES);
    const oStart = inChip("t2", "left");
    D.fire("pointerdown", D.evAt(oStart, {target:D.face("t2")}));

    const hover = D.evAt(inChip("t1", "left"), {buttons:0});
    D.fire("pointermove", hover);
    check(!D.pointerDragging(),
      "a pointermove with no button held does not start a drag — the press it "
      + "would be continuing ended outside the strip, where #tiers never heard it");
    eq(D.hidden().join(","), "",
      "…so no chip is taken out of the flow by a gesture nobody is making");
    eq(D.slots().length, 0, "…and no drop position is offered for it");

    {
      const HEIGHTS = {pAna:40, pBo:52, pCy:40, pDi:64};
      const SLOT_HITTABLE_R = !/\.p-drop-slot\{[^}]*pointer-events:none/.test(HTML);
      const DRAG_HIDES_R    = /\.p-row\.dragging\{display:none\}/.test(HTML);

      const R = new Function("rawMakeNode", "SLOT_HITTABLE", "DRAG_HIDES", "HEIGHTS", `
        const GAP = 1, ORIGIN = 50, COL = 300;
        /* Every node lays the list out before it answers for its own box, which
           is what a browser does and what makes rule 5 testable at all: a row
           that .dragging has just taken out of the flow must MEASURE zero, not
           return the height it had before the class went on. Without this the
           whole measure-before-hide rule passes under a mutation that hides
           first — the reads are cached, so the collapsed row still answers 52.
           Installed here rather than in the shared factory: §6e's horizontal
           harness drives the strip, which this change is under orders not to
           go near. */
        function makeNode(tag){
          const n = rawMakeNode(tag);
          n.getBoundingClientRect = function(){ relayout(); return n.rect; };
          return n;
        }
        const ROSTER  = makeNode("div");
        const OUTSIDE = makeNode("div");
        const CALLS = {reorder:[], offReorder:[], closedMenu:0, captured:[]};
        ROSTER.setPointerCapture = function(id){ CALLS.captured.push(id); };
        const LATER = [];
        function setTimeout(fn){ LATER.push(fn); return LATER.length; }
        /* Block layout, as far as this panel needs it: groups stacked, each a
           heading then its rows, one margin between rows, and a display:none row
           contributing neither box nor margin. */
        function relayout(){
          let y = ORIGIN;
          (function place(parent){
            for(const c of parent.children){
              if(c.className === "tier-group"){ place(c); continue; }
              if(DRAG_HIDES && c.classList.contains("dragging")){
                c.rect = {left:0, top:0, right:0, bottom:0, width:0, height:0};
                continue;
              }
              const isSlot = c.classList.contains("p-drop-slot");
              let h = isSlot ? parseFloat(c.style.height)
                     : c.className === "th" ? 22
                     : HEIGHTS[c.dataset.id];
              /* A slot sized from the wrong style property — an axis mutation
                 that writes .width instead of .height — parses as NaN. That is
                 exactly the shape the defect takes, so it lays out as a
                 readable 0 rather than throwing: the assertions that check the
                 rendered height are what should name it, not a stub crash that
                 abandons the rest of the section. */
              if(isSlot && Number.isNaN(h)) h = 0;
              /* A zero-height slot is the vertical form of the hairline the
                 strip was drawn as. It has to lay out rather than throw — a
                 throw abandons the section and reports the assertion that was
                 about to go red as coverage. A row with no height is still a
                 broken stub and still throws. */
              if(!(h > 0) && !(isSlot && h === 0))
                throw new Error("stub layout: no height for " + (c.className || c.tagName));
              c.rect = {left:ORIGIN, top:y, right:ORIGIN + COL, bottom:y + h,
                        width:COL, height:h};
              y += h + GAP;
            }
          })(ROSTER);
        }
        function elementFromPoint(x, y){
          relayout();
          let found = null;
          (function walk(p){
            for(const c of p.children){
              if(c.className === "tier-group"){ walk(c); continue; }
              if(DRAG_HIDES && c.classList.contains("dragging")) continue;
              if(c.classList.contains("p-drop-slot") && !SLOT_HITTABLE) continue;
              if(y >= c.rect.top && y < c.rect.bottom) found = found || c;
            }
          })(ROSTER);
          return found || (y >= ORIGIN ? ROSTER : OUTSIDE);
        }
        const document = {
          createElement: makeNode,
          createElementNS(ns, tag){ const n = makeNode(tag); n.ns = ns; return n; },
          createTextNode(t){ const n = makeNode("#text"); n.textContent = t; return n; },
          elementFromPoint
        };
        function $(sel){ return sel === "#roster" ? ROSTER : null; }
        function closePersonMenu(){ CALLS.closedMenu++; }
        /* Recorded, not performed. What reorderPerson then does to the document
           — the walk, the single commit, the label — is test/document.js §13's;
           what this suite owns is that a drop asks for the move the gap showed. */
        function reorderPerson(a, b, after){ CALLS.reorder.push([a, b, after]); return true; }
        /* Defined so the GRADE surface's own onDrop resolves inside this
           sandbox too — a mutation that swapped the two onDrop entries would
           otherwise throw a ReferenceError building rowDragSurface's config
           instead of failing a named assertion. Expected to stay empty here. */
        function reorderGrade(a, b, after){ CALLS.offReorder.push([a, b, after]); return true; }
        /* rowDragSurface's own config reads this — the gate that locks
           reordering while the roster panel is showing a filtered subset.
           Grabbed real (below), so it has to find a real rosterQuery here or
           throw a ReferenceError the moment a gesture starts, exactly the
           way rosterFiltered's app-side callers do. Defaults to "" — the same
           as the app's own top-level default — so every §6h assertion above
           this point keeps behaving as an unfiltered roster. */
        let rosterQuery = "";
        ` +
        grabConst("SVGNS") + "\n" +
        ["el","icon","clear","fill","makeDragSurface","rosterFiltered"]
          .map(grabFn).join("\n") + "\n" +

        grabConst("rowDragSurface") + `
        function fire(type, ev){ relayout(); (ROSTER.listeners[type] || []).forEach(fn => fn(ev)); }
        function evAt(y, extra){
          relayout();
          const e = {clientX:ORIGIN + 20, clientY:y, pointerId:9, button:0, buttons:1,
                     pointerType:"mouse",
                     prevented:false, preventDefault(){ this.prevented = true; },
                     relatedTarget:ROSTER,
                     dataTransfer:{effectAllowed:"", dropEffect:"", setData(){}}};
          e.target = elementFromPoint(ORIGIN + 20, y);
          for(const k in (extra || {})) e[k] = extra[k];
          return e;
        }
        /* Two groups, the way renderRoster builds them: a heading, then rows.
           Built here rather than through renderRoster because that function
           wants the whole document — this block is about geometry and events. */
        function render(groups){
          clear(ROSTER);
          for(const g of groups){
            const group = el("div", {cls:"tier-group"});
            group.appendChild(el("div", {cls:"th"}));
            for(const id of g) group.appendChild(el("div", {cls:"p-row", did:id}));
            ROSTER.appendChild(group);
          }
          relayout();
        }
        return {
          ROSTER, OUTSIDE, CALLS, ORIGIN, fire, evAt, relayout, render,
          flush(){ let n = 0; while(LATER.length){ LATER.shift()(); n++; } return n; },
          pending(){ return LATER.length; },
          drop(){ return rowDragSurface.pendingDrop(); },
          dragH(){ return rowDragSurface.dragSize(); },
          dragId(){ return rowDragSurface.dragId(); },
          pointerDragging(){ return rowDragSurface.pointerDragging(); },
          hasPointer(){ return rowDragSurface.hasPointer(); },
          slot(){ return ROSTER.querySelector(".p-drop-slot"); },
          slots(){ return ROSTER.querySelectorAll(".p-drop-slot"); },
          /* Laid out first: the gap is inserted inside the handler, so its box
             does not exist until the next layout — and reading .rect straight
             off it answers 0, which is the very hairline being asserted against. */
          slotRect(){ relayout(); const s = ROSTER.querySelector(".p-drop-slot"); return s ? s.rect : null; },
          hidden(){ return ROSTER.querySelectorAll(".dragging").map(c => c.dataset.id); },
          row(id){ return ROSTER.querySelector('.p-row[data-id="' + id + '"]'); },
          head(i){ return ROSTER.children[i].children[0]; },
          order(){
            const out = [];
            for(const g of ROSTER.children) for(const c of g.children){
              if(c.className === "th") out.push("#");
              else if(c.classList.contains("p-drop-slot")) out.push("[slot]");
              else out.push(c.classList.contains("dragging") ? "(" + c.dataset.id + ")" : c.dataset.id);
            }
            return out;
          },
          query(v){ rosterQuery = v; }
        };
      `)(dnode, SLOT_HITTABLE_R, DRAG_HIDES_R, HEIGHTS);

      const GROUPS = [["pAna","pBo"], ["pCy","pDi"]];

      const inRow = (id, half) => {
        R.relayout();
        const r = R.row(id).rect;
        return r.top + r.height * (half === "top" ? 0.25 : 0.75);
      };
      const slotH = () => { const s = R.slot(); return s ? s.style.height : "(no slot)"; };

      R.render(GROUPS);
      eq(R.order().join(" "), "# pAna pBo # pCy pDi", "the panel starts as the roster reads");
      R.fire("dragstart", R.evAt(inRow("pBo", "top"), {target:R.row("pBo")}));
      eq(R.hidden().join(","), "",
        "dragstart does NOT hide the row while it runs — the drag image is taken "
        + "from the element after the handler returns");
      eq(R.pending(), 1, "it defers the hide by one task");
      eq(R.dragH(), HEIGHTS.pBo, "and measures the row while it is still in the flow");
      R.flush();
      eq(R.hidden().join(","), "pBo", "which is what the deferred task then takes out of it");
      R.fire("dragover", R.evAt(inRow("pCy", "top")));
      eq(slotH(), HEIGHTS.pBo + "px", "the gap is written at the dragged row's own height");
      const gapRect = R.slotRect();
      eq(gapRect ? gapRect.height : "(no slot)", HEIGHTS.pBo,
        "…and RENDERS at that height — a gap asserted only to exist is satisfied "
        + "by the hairline this rule is about");
      eq(R.order().join(" "), "# pAna (pBo) # [slot] pCy pDi",
        "standing in the gap the row will land in, in the other group");
      R.fire("dragend", {});

      for(const [id, want] of [["pAna",40], ["pDi",64], ["pBo",52]]){
        R.render(GROUPS);
        R.fire("dragstart", R.evAt(inRow(id, "top"), {target:R.row(id)}));
        R.flush();
        R.fire("dragover", R.evAt(inRow(id === "pAna" ? "pDi" : "pAna", "top")));
        eq(slotH(), want + "px", "dragging " + id + " draws the gap at that row's height");
        const rr = R.slotRect();
        eq(rr ? rr.height : "(no slot)", want, "…and it renders at it");
        R.fire("dragend", {});
      }

      R.render(GROUPS);
      R.fire("dragstart", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      R.flush();
      R.fire("dragover", R.evAt(inRow("pDi", "top")));
      eq(JSON.stringify(R.drop()), '{"id":"pDi","after":false}',
        "the top half of a row is a drop above it");
      eq(R.order().join(" "), "# (pAna) pBo # pCy [slot] pDi", "…and the gap opens above it");
      const firstSlot = R.slot();
      R.fire("dragover", R.evAt(inRow("pDi", "bottom")));
      eq(JSON.stringify(R.drop()), '{"id":"pDi","after":true}',
        "the bottom half of the same row is a drop below it");
      eq(R.order().join(" "), "# (pAna) pBo # pCy pDi [slot]", "and the gap moves under it");
      eq(R.slots().length, 1, "still exactly one gap — the panel never holds two");
      check(R.slot() === firstSlot,
        "and it is the same element moved, not a second one built at the new position");

      R.fire("dragover", R.evAt(R.head(1).rect.top + 5, {target:R.head(1)}));
      eq(JSON.stringify(R.drop()), '{"id":"pDi","after":true}',
        "a drop on a group heading aims at the LAST row of that group, after it — "
        + "which is what the end of a grade means, and it needs no empty-heading "
        + "case in reorderPerson to express");
      R.fire("dragend", {});

      R.render(GROUPS);
      R.fire("dragstart", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      R.flush();
      R.fire("dragover", R.evAt(inRow("pDi", "top")));
      const gap = R.slotRect();
      const inGapY = gap ? gap.top + 4 : -1;
      R.fire("dragover", R.evAt(inGapY));
      eq(JSON.stringify(R.drop()), '{"id":"pDi","after":false}',
        "a dragover inside the gap leaves the answer exactly as it was");
      eq(R.order().join(" "), "# (pAna) pBo # pCy [slot] pDi",
        "…and leaves the gap standing, so the list does not close up under the pointer");
      R.fire("dragend", {});

      R.render(GROUPS);
      R.CALLS.reorder.length = 0;
      R.CALLS.offReorder.length = 0;
      R.fire("dragstart", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      R.flush();
      R.fire("dragover", R.evAt(inRow("pDi", "bottom")));
      R.fire("drop", R.evAt(inRow("pDi", "bottom")));
      eq(JSON.stringify(R.CALLS.reorder), '[["pAna","pDi",true]]',
        "the drop hands reorderPerson the source, the target and the side — the "
        + "same three arguments reorderGrade takes");
      eq(R.CALLS.offReorder.length, 0,
        "…and never calls reorderGrade — the row surface's onDrop names "
        + "reorderPerson only");
      eq(R.slots().length, 0, "the gap is gone");
      eq(R.hidden().join(","), "", "and the row is back in the list");

      R.render(GROUPS);
      const aStart = inRow("pAna", "top");
      R.fire("pointerdown", R.evAt(aStart, {target:R.row("pAna")}));
      R.fire("pointermove", R.evAt(aStart + 10, {target:R.row("pAna")}));
      check(R.pointerDragging(), "the fallback has crossed six pixels and owns the gesture");
      const late = R.evAt(aStart + 12, {target:R.row("pAna")});
      R.fire("dragstart", late);
      check(late.prevented,
        "a native dragstart arriving after that is cancelled — two drop paths "
        + "running one gesture is how a drag gets applied twice");
      R.fire("pointerup", R.evAt(aStart + 12));

      R.render(GROUPS);
      const bStart = inRow("pBo", "top");
      R.fire("pointerdown", R.evAt(bStart, {target:R.row("pBo")}));
      R.fire("dragstart", R.evAt(bStart + 3, {target:R.row("pBo")}));
      check(!R.pointerDragging(),
        "three pixels is under the threshold, so both paths are live at this point");
      R.flush();
      eq(R.hidden().join(","), "pBo", "the row is out of the flow, where it measures zero");
      R.fire("pointermove", R.evAt(inRow("pCy", "top")));
      check(!R.pointerDragging(),
        "a pointermove past six pixels does NOT claim a gesture the native path is "
        + "already running");
      eq(R.dragH(), HEIGHTS.pBo,
        "…so the height is still the row's own — a second beginRowDrag would read "
        + "the collapsed row and draw every gap from here on as a line");
      R.fire("dragover", R.evAt(inRow("pCy", "top")));
      const stillR = R.slotRect();
      eq(stillR ? stillR.height : "(no slot)", HEIGHTS.pBo,
        "and the gap still renders at the row's height");
      R.fire("dragend", {});
      R.fire("pointerup", R.evAt(inRow("pCy", "top")));

      R.render(GROUPS);
      R.fire("dragstart", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      const overSelf = R.evAt(inRow("pAna", "top"));
      R.fire("dragover", overSelf);
      eq(R.drop(), null, "over the dragged row itself there is no position to choose");
      check(overSelf.prevented,
        "…and the drag is accepted anyway: a refusal here is the not-allowed "
        + "cursor from the press onwards, which is what a dead drag looks like");
      const overNothing = R.evAt(4);
      R.fire("dragover", overNothing);
      check(overNothing.prevented, "…and over no row at all, for the same reason");

      R.fire("dragend", {});
      eq(R.dragId(), null, "no row drag is in flight");
      const foreign = R.evAt(inRow("pCy", "top"));
      R.fire("dragover", foreign);
      check(!foreign.prevented,
        "a drag that is not a row's is refused — preventDefault stays below the "
        + "rowDragId guard, or a file dragged over the list is offered a drop");

      R.render(GROUPS);
      const cStart = inRow("pBo", "top");
      R.fire("pointerdown", R.evAt(cStart, {target:R.row("pBo")}));
      R.fire("dragstart", R.evAt(cStart + 2, {target:R.row("pBo")}));
      R.flush();
      check(!R.pointerDragging(), "the fallback never claimed this gesture");
      R.fire("pointercancel", R.evAt(cStart + 2));
      eq(R.dragId(), "pBo",
        "pointercancel does not tear down the native drag it is only announcing");
      eq(R.hidden().join(","), "pBo", "…the row stays out of the flow");
      check(!R.hasPointer(), "…and the press record it WAS watching is dropped");
      const after = R.evAt(inRow("pCy", "top"));
      R.fire("dragover", after);
      check(after.prevented, "…so the rest of the drag is still accepted");
      eq(JSON.stringify(R.drop()), '{"id":"pCy","after":false}',
        "…and still chooses positions");
      R.fire("dragend", {});

      R.render(GROUPS);
      const dStart = inRow("pBo", "top");
      R.fire("pointerdown", R.evAt(dStart, {target:R.row("pBo")}));
      R.fire("pointermove", R.evAt(dStart + 10, {target:R.row("pBo")}));
      check(R.pointerDragging() && R.dragId() === "pBo", "the fallback owns this one");
      R.fire("pointercancel", R.evAt(dStart + 10));
      eq(R.dragId(), null, "and pointercancel DOES end a drag the fallback started");
      eq(R.hidden().join(","), "", "putting the row back");
      eq(R.slots().length, 0, "and taking the gap with it");

      R.render(GROUPS);
      const eStart = inRow("pAna", "top");
      R.fire("pointerdown", R.evAt(eStart, {target:R.row("pAna")}));
      R.fire("dragstart", R.evAt(eStart + 2, {target:R.row("pAna")}));
      R.flush();
      check(R.hasPointer(), "the press record is still live during the native drag");
      R.fire("dragend", {});
      check(!R.hasPointer(),
        "dragend clears it — a native drag swallows the pointerup that would "
        + "have, and the record left behind starts a drag on the next hover");

      R.render(GROUPS);
      const fStart = inRow("pBo", "top");
      R.fire("pointerdown", R.evAt(fStart, {target:R.row("pBo")}));
      R.fire("pointermove", R.evAt(inRow("pAna", "top"), {buttons:0}));
      check(!R.pointerDragging(),
        "a pointermove with no button held does not start a drag — the press it "
        + "would be continuing ended where #roster never heard it");
      eq(R.hidden().join(","), "", "…so no row is taken out of the flow for it");
      eq(R.slots().length, 0, "…and no drop position is offered");
      check(!R.hasPointer(), "…and the stale record is dropped rather than kept");

      R.render(GROUPS);

      const caret = dnode("button");
      caret.className = "ghost p-menu";
      caret.dataset.act = "menu"; caret.dataset.id = "pAna";
      R.row("pAna").appendChild(caret);
      R.fire("pointerdown", R.evAt(inRow("pAna", "top"), {target:caret}));
      check(!R.hasPointer(),
        "a press that begins on the caret starts no press record at all — the "
        + "same exclusion .g-chip-toggle gets on the strip");
      R.fire("pointermove", R.evAt(inRow("pDi", "top")));
      check(!R.pointerDragging() && R.slots().length === 0,
        "…so drifting six pixels from it reorders nothing");

      R.render(GROUPS);
      R.fire("pointerdown", R.evAt(inRow("pAna", "top"),
        {target:R.row("pAna"), pointerType:"touch"}));
      check(!R.hasPointer(),
        "a touch press starts no drag — the panel scrolls by finger and must "
        + "keep doing so, exactly as the ribbon does");

      R.render(GROUPS);
      R.query("anything");
      R.fire("dragstart", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      eq(R.dragId(), null, "dragstart refuses to start a new drag while the search is active");
      R.fire("pointerdown", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      check(!R.hasPointer(),
        "…and pointerdown does not even open a press record while searching");
      R.fire("pointermove", R.evAt(inRow("pAna", "top") + 10, {target:R.row("pAna")}));
      check(!R.pointerDragging(),
        "…so drifting past the six-pixel threshold still starts nothing");
      R.query("");
      R.render(GROUPS);
      R.fire("dragstart", R.evAt(inRow("pAna", "top"), {target:R.row("pAna")}));
      eq(R.dragId(), "pAna",
        "the positive control: the SAME gesture begins normally once the search is cleared");
      R.fire("dragend", {});
    }
  }

  {
    const STYLE = new Function(
      ["PAGES","LAYOUTS"].map(grabConst).join("\n") + "\n" +
      ["notAvailableIn","syncStyleSummaries"].map(grabFn).join("\n") + "\n" +
      `
      function ctl(){
        return {value:"", disabled:false, title:"", attrs:{},
                style:{setProperty(){}},
                setAttribute(k, v){ this.attrs[k] = String(v); }};
      }
      const EL = {};
      for(const id of ["layoutBtn","densityBtn","pageBtn","bgBtn","ringBtn","nameLabelsBtn","fontBtn",
                        "layout","density","page","bg","ring","nameLabelPosition","nameBold","font",
                        "accentSwatch","inkAccentDot","accentBtn","accent","angleBtn","angle"]){
        EL[id] = ctl();
      }
      function $(sel){ return EL[sel.slice(1)] || null; }
      const document = {querySelectorAll(){ return []; }};
      return {EL, LAYOUTS, run(layoutValue){ EL.layout.value = layoutValue; syncStyleSummaries(); }};
      `
    )();

    STYLE.run("swimlanes");
    check(STYLE.EL.angleBtn.disabled === true,
      "Swimlanes really disables the Angle command — got " + STYLE.EL.angleBtn.disabled);
    check(STYLE.EL.angle.disabled === true,
      "…and the angle value control along with it — got " + STYLE.EL.angle.disabled);
    check(STYLE.EL.angleBtn.title === "Not available in Swimlanes",
      "…with a reason naming the CURRENT layout — got " + JSON.stringify(STYLE.EL.angleBtn.title));
    check(STYLE.EL.angleBtn.attrs["aria-label"] === "Angle — not available in Swimlanes",
      "…and the aria-label embeds the same reason after the command's own name — got "
      + JSON.stringify(STYLE.EL.angleBtn.attrs["aria-label"]));

    const savedSwimLabel = STYLE.LAYOUTS.swimlanes.label;
    STYLE.LAYOUTS.swimlanes.label = "Lanes Test";
    STYLE.run("swimlanes");
    check(STYLE.EL.angleBtn.title === "Not available in Lanes Test",
      "the reason follows a doctored LAYOUTS.swimlanes.label rather than a hard-typed "
      + "\"Swimlanes\" — got " + JSON.stringify(STYLE.EL.angleBtn.title));
    STYLE.LAYOUTS.swimlanes.label = savedSwimLabel;

    STYLE.run("pyramid");
    check(STYLE.EL.angleBtn.disabled === false,
      "Pyramid leaves the angle command enabled — got " + STYLE.EL.angleBtn.disabled);
    check(STYLE.EL.angle.disabled === false,
      "…and the angle value control too — got " + STYLE.EL.angle.disabled);
    check(STYLE.EL.angleBtn.title === "Angle",
      "…back to its own name — got " + JSON.stringify(STYLE.EL.angleBtn.title));

    STYLE.run("tornado");
    check(STYLE.EL.angleBtn.disabled === false,
      "Tornado leaves the angle command enabled too — got " + STYLE.EL.angleBtn.disabled);
    check(STYLE.EL.angle.disabled === false,
      "…and the angle value control — got " + STYLE.EL.angle.disabled);
    check(STYLE.EL.angleBtn.title === "Angle",
      "…with its own name, not a disabled reason — got " + JSON.stringify(STYLE.EL.angleBtn.title));

    STYLE.run("histogram");
    check(STYLE.EL.angleBtn.disabled === true,
      "Histogram disables the Angle command — got " + STYLE.EL.angleBtn.disabled);
    check(STYLE.EL.angle.disabled === true,
      "…and the angle value control along with it — got " + STYLE.EL.angle.disabled);
    check(STYLE.EL.angleBtn.title === "Not available in Histogram",
      "…with a reason naming the CURRENT layout — got " + JSON.stringify(STYLE.EL.angleBtn.title));
    check(STYLE.EL.angleBtn.attrs["aria-label"] === "Angle — not available in Histogram",
      "…and the aria-label embeds the same reason after the command's own name — got "
      + JSON.stringify(STYLE.EL.angleBtn.attrs["aria-label"]));

    STYLE.run("hive");
    check(STYLE.EL.angleBtn.disabled === true,
      "Hive disables the Angle command — got " + STYLE.EL.angleBtn.disabled);
    check(STYLE.EL.angle.disabled === true,
      "…and the angle value control along with it — got " + STYLE.EL.angle.disabled);
    check(STYLE.EL.angleBtn.title === "Not available in Hive",
      "…with a reason naming the CURRENT layout — got " + JSON.stringify(STYLE.EL.angleBtn.title));
    check(STYLE.EL.angleBtn.attrs["aria-label"] === "Angle — not available in Hive",
      "…and the aria-label embeds the same reason after the command's own name — got "
      + JSON.stringify(STYLE.EL.angleBtn.attrs["aria-label"]));
  }

  {
    const TM = new Function(
      ["SVGNS", "TEMPLATES"].map(grabConst).join("\n") + "\n" +
      ["el", "icon", "layoutIcon", "fillTemplatesMenu"].map(grabFn).join("\n") + `
      function node(tag){
        return {tagName:tag, className:"", attrs:{}, children:[], textContent:"",
                appendChild(c){ this.children.push(c); return c; },
                setAttribute(k, v){ this.attrs[k] = String(v); }};
      }
      const document = {
        createElement: node,
        createElementNS(ns, tag){ return node(tag); },
        createTextNode(t){ const n = node("#text"); n.textContent = t; return n; }
      };
      const MENU = node("div");
      function $(sel){ return sel === "#templatesMenu" ? MENU : null; }
      fillTemplatesMenu();
      return {MENU};
      `
    )();

    const ROWS = TM.MENU.children.filter(c => c?.attrs?.["data-tpl"] != null);
    check(ROWS.length === 3, "the Templates menu builds exactly three template rows — got " + ROWS.length);

    const WANT = [
      ["big4-green",  "#004225", "#i-pyramid",   "Big 4 green"],
      ["big4-orange", "#FF4F00", "#i-swimlanes", "Big 4 orange"],
      ["mbb-blue",    "#003153", "#i-hive",      "MBB blue"]
    ];
    WANT.forEach((w, i) => {
      const row = ROWS[i];
      check(row?.tagName === "button",
        "row " + i + " is a button — got " + JSON.stringify(row?.tagName));
      check(row?.attrs?.role === "menuitem",
        "row " + i + " carries role=\"menuitem\" — got " + JSON.stringify(row?.attrs?.role));
      check(row?.attrs?.["data-tpl"] === w[0],
        "row " + i + "'s data-tpl is " + JSON.stringify(w[0])
        + " — got " + JSON.stringify(row?.attrs?.["data-tpl"]));
      check(row?.attrs?.style === "--swatch:" + w[1],
        "row " + i + "'s accent is " + JSON.stringify(w[1])
        + " — got " + JSON.stringify(row?.attrs?.style));

      const dot = row?.children?.[0];
      check(dot?.className === "accent-dot",
        "row " + i + "'s FIRST child carries class accent-dot — got "
        + JSON.stringify(dot?.className));
      check(dot?.attrs?.["aria-hidden"] === "true",
        "row " + i + "'s accent dot is decorative — got "
        + JSON.stringify(dot?.attrs?.["aria-hidden"]));

      const svgIcon = row?.children?.[1];
      check(svgIcon?.tagName === "svg",
        "row " + i + "'s SECOND child is the layout icon svg — got "
        + JSON.stringify(svgIcon?.tagName));
      const useEl = svgIcon?.children?.[0];
      check(useEl?.attrs?.href === w[2],
        "row " + i + "'s layout icon draws " + JSON.stringify(w[2])
        + " — got " + JSON.stringify(useEl?.attrs?.href));

      const textNode = row?.children?.[2];
      check(textNode?.textContent === w[3],
        "row " + i + "'s THIRD child is the label " + JSON.stringify(w[3])
        + " — got " + JSON.stringify(textNode?.textContent));
    });

    const note = TM.MENU.children[TM.MENU.children.length - 1];
    check(note?.tagName === "span",
      "the menu's last child is the templatesNote span — got " + JSON.stringify(note?.tagName));
    check(note?.className === "warn-chip",
      "…carrying class warn-chip — got " + JSON.stringify(note?.className));
    check(note?.attrs?.id === "templatesNote",
      "…with id=\"templatesNote\", the id syncStructureAvailability shows and hides — got "
      + JSON.stringify(note?.attrs?.id));
    check(note?.attrs?.role === "status",
      "…and role=\"status\" — got " + JSON.stringify(note?.attrs?.role));
    check(note?.hidden === true,
      "…starting hidden, since the rows go disabled and it only makes sense beside a "
      + "disabled row — got " + JSON.stringify(note?.hidden));
  }

  {

    const C = new Function(
      grabFn("luminance") + "\n" + grabFn("contrastRatio") + "\n" +
      grabConst("CONTRAST_MIN") + "\n" +
      grabFn("defaults") + "\n" +
      "return {luminance, contrastRatio, CONTRAST_MIN, defaults};")();
    const D = C.defaults();
    check(/^#[0-9A-Fa-f]{6}$/.test(D.accent) && /^#[0-9A-Fa-f]{6}$/.test(D.inkOnColour)
       && /^#[0-9A-Fa-f]{6}$/.test(D.inkOnWhite),
      "defaults() states all three colours as full hex — got "
      + [D.accent, D.inkOnColour, D.inkOnWhite].join(", "));

    const near = (a, b, msg, tol) => check(Math.abs(a - b) <= (tol || 0.01),
      msg + " — got " + (a === null ? "null" : a.toFixed(3)) + ", want " + b);

    near(C.luminance("#000000"), 0,     "black has zero luminance");
    near(C.luminance("#ffffff"), 1,     "white has luminance 1");
    near(C.luminance("#808080"), 0.216, "mid grey matches the spec curve");

    near(C.contrastRatio("#000000", "#ffffff"), 21, "black on white is 21:1");
    near(C.contrastRatio("#ffffff", "#ffffff"), 1,  "white on white is 1:1");
    near(C.contrastRatio("#767676", "#ffffff"), 4.54, "#767676 on white is the AA boundary", 0.02);
    check(C.contrastRatio(D.accent, D.inkOnColour) > C.CONTRAST_MIN,
      "the accent a new document ships passes with the ink it ships on it — "
      + D.accent + " on " + D.inkOnColour + " is "
      + C.contrastRatio(D.accent, D.inkOnColour).toFixed(2) + ":1");
    check(C.contrastRatio("#ffffff", D.inkOnWhite) > C.CONTRAST_MIN,
      "…and the ink it ships for white bands passes on white — " + D.inkOnWhite
      + " is " + C.contrastRatio("#ffffff", D.inkOnWhite).toFixed(2) + ":1");

    check(C.contrastRatio("#9BE5B8", "#FFFFFF") < C.CONTRAST_MIN,
      "a pale accent with white text is flagged");

    {
      const CC = new Function("makeNode",
        ["HEX6"].map(grabConst).join("\n") + "\n" +
        grabConst("CONTRAST_MIN") + "\n" +
        ["luminance","contrastRatio","checkContrast"].map(grabFn).join("\n") + "\n" +
        "let state = null;\n" +
        "const CHIP = makeNode('span'); CHIP.hidden = true;\n" +
        "function $(sel){ return sel === '#contrastWarn' ? CHIP : null; }\n" +
        "return {CHIP, run(s){ state = s; checkContrast(); }};"
      )(function node(tag){
        return {tagName:tag, hidden:false, textContent:""};
      });

      const design = {accent:D.accent, inkOnColour:D.inkOnColour, inkOnWhite:D.inkOnWhite};

      CC.run(design);
      check(CC.CHIP.hidden === true, "the shipped default colours raise no warning");
      eq(CC.CHIP.textContent, "", "and leave the chip empty");

      CC.run(Object.assign({}, design, {accent:"#9BE5B8"}));
      check(CC.CHIP.hidden === false, "a pale accent with white ink warns");
      check(/on the accent/.test(CC.CHIP.textContent),
        "and says which pairing is at fault — got " + JSON.stringify(CC.CHIP.textContent));
      check(/:1/.test(CC.CHIP.textContent), "and quotes the ratio, so it is checkable");
      check(CC.CHIP.textContent.indexOf(String(C.CONTRAST_MIN)) >= 0,
        "and names the threshold it failed");

      CC.run(Object.assign({}, design, {inkOnWhite:"#EEEEEE"}));
      check(CC.CHIP.hidden === false, "pale ink on a white band warns");
      check(/on white bands/.test(CC.CHIP.textContent),
        "and names that pairing — got " + JSON.stringify(CC.CHIP.textContent));

      CC.run({accent:"#9BE5B8", inkOnColour:"#FFFFFF", inkOnWhite:"#EEEEEE"});
      check(/on the accent/.test(CC.CHIP.textContent) && /on white bands/.test(CC.CHIP.textContent),
        "both failing pairings are reported together");

      CC.run(design);
      check(CC.CHIP.hidden === true, "fixing the colours clears the warning");
      eq(CC.CHIP.textContent, "", "and empties the chip, so nothing stale is read out");

      CC.run(Object.assign({}, design, {accent:"not-a-colour"}));
      check(CC.CHIP.hidden === true,
        "a colour that cannot be parsed is not reported as a contrast failure");
    }
    eq(C.contrastRatio("nonsense", "#ffffff"), null, "an unparseable colour yields no ratio");
    eq(C.contrastRatio("#FFF", "#ffffff"), null, "a short hex is not silently accepted");

    near(C.contrastRatio("#046A38", "#FFFFFF"), C.contrastRatio("#FFFFFF", "#046A38"),
      "the ratio is symmetric");
  }

  {
    const CSS8 = ((/<style>([\s\S]*?)<\/style>/.exec(HTML) || ["", ""])[1])
      .replace(/\/\*[\s\S]*?\*\//g, " ");

    const rootMatch = /:root\{([^}]*)\}/.exec(CSS8);
    check(!!rootMatch, "the :root token block is found in the stylesheet");
    const TOKENS = {};
    const LIGHT_NAMES = new Set();
    const LIGHT_RAW = {};
    if(rootMatch){
      const re = /--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g;
      let m;
      while((m = re.exec(rootMatch[1]))){
        const val = m[2].trim();
        LIGHT_NAMES.add("--" + m[1]);
        LIGHT_RAW["--" + m[1]] = val;
        if(/^#[0-9A-Fa-f]{6}$/.test(val)) TOKENS["--" + m[1]] = val;
      }
    }
    check(!!TOKENS["--ink"] && !!TOKENS["--surface"]
       && !!TOKENS["--inverse-bg"] && !!TOKENS["--inverse-ink"],
      "the token map resolves --ink, --surface, --inverse-bg and --inverse-ink "
      + "— got " + JSON.stringify(Object.keys(TOKENS)));

    const C2 = new Function(
      grabFn("luminance") + "\n" + grabFn("contrastRatio") + "\n" +
      grabConst("CONTRAST_MIN") + "\n" +
      "return {luminance, contrastRatio, CONTRAST_MIN};")();

    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    const allRules = [];
    let rm0;
    while((rm0 = ruleRe.exec(CSS8))) allRules.push([rm0[1].trim(), rm0[2]]);

    const LITERAL_INK_BASE = new Set();
    const baseSelector = part => part.trim()
      .replace(/(:[a-zA-Z-]+(\([^)]*\))?|\[[^\]]*\])+$/, "").trim();
    allRules.forEach(([sel, body]) => {
      const decls = body.split(";").map(d => d.trim()).filter(Boolean);
      const colorDecl = decls.find(d => /^color\s*:/.test(d));
      if(!colorDecl || /var\(/.test(colorDecl)) return;
      sel.split(",").forEach(part => LITERAL_INK_BASE.add(baseSelector(part)));
    });

    const pairs = new Map();
    allRules.forEach(([sel, body]) => {
      const decls = body.split(";").map(d => d.trim()).filter(Boolean);
      const bgDecl = decls.find(d => /^background(-color)?\s*:/.test(d));
      if(!bgDecl) return;

      if(/gradient\(/.test(bgDecl)) return;
      const bgVar = /var\(\s*(--[A-Za-z0-9-]+)\s*\)/.exec(bgDecl);
      if(!bgVar || !(bgVar[1] in TOKENS)) return;
      const xName = bgVar[1];

      const colorDecl = decls.find(d => /^color\s*:/.test(d));
      let yName;
      if(colorDecl){
        const colVar = /var\(\s*(--[A-Za-z0-9-]+)\s*\)/.exec(colorDecl);
        if(colVar && (colVar[1] in TOKENS)) yName = colVar[1];
        else return;
      }else{
        const inheritsLiteral = sel.split(",").some(part => LITERAL_INK_BASE.has(baseSelector(part)));
        if(inheritsLiteral) return;
        if(!("--ink" in TOKENS)) return;
        yName = "--ink";
      }
      pairs.set(xName + "|" + yName, [yName, xName]);
    });

    const distinctPairs = Array.from(pairs.values());
    check(distinctPairs.length >= 6,
      "the class check finds at least 6 distinct token pairs — a parser that "
      + "finds nothing must fail, not pass vacuously — got " + distinctPairs.length);
    check(pairs.has("--inverse-bg|--inverse-ink"),
      "the (--inverse-bg, --inverse-ink) pair is among them — the second source "
      + "proving .g-code's and .toast's inverse decoupling actually parses");
    check(pairs.has("--shell|--brand-ink"),
      "the (--shell, --brand-ink) pair is among them — .rb-tab.on's active-tab "
      + "ink now reads through a token a dark scheme can lift off --brand");
    check(pairs.has("--badge-bg|--badge-ink"),
      "the (--badge-bg, --badge-ink) pair is among them — the 2D badge's fill "
      + "and ink both read through tokens now, decoupled from --mute/#fff");

    check(TOKENS["--brand-ink"] === TOKENS["--brand"],
      "in the light scheme, --brand-ink still equals --brand byte for byte — got "
      + TOKENS["--brand-ink"] + " vs " + TOKENS["--brand"]);
    check(TOKENS["--badge-bg"] === TOKENS["--mute"],
      "in the light scheme, --badge-bg still equals --mute byte for byte — got "
      + TOKENS["--badge-bg"] + " vs " + TOKENS["--mute"]);

    check(TOKENS["--brand-mark"] === TOKENS["--brand"],
      "in the light scheme, --brand-mark still equals --brand byte for byte — got "
      + TOKENS["--brand-mark"] + " vs " + TOKENS["--brand"]);

    const darkMediaMatch = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*)\}\s*$/.exec(CSS8);
    const darkRootMatch = darkMediaMatch ? /:root\{([^}]*)\}/.exec(darkMediaMatch[1]) : null;
    check(!!darkMediaMatch && !!darkRootMatch,
      "the @media (prefers-color-scheme: dark) block and its own :root rule "
      + "are both found in the stylesheet");

    const DARK_OVERRIDES = {};
    const DARK_TOKENS = Object.assign({}, TOKENS);
    if(darkRootMatch){
      const re3 = /--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g;
      let m3;
      while((m3 = re3.exec(darkRootMatch[1]))){
        const name = "--" + m3[1];
        const val = m3[2].trim();
        DARK_OVERRIDES[name] = val;
        if(/^#[0-9A-Fa-f]{6}$/.test(val)) DARK_TOKENS[name] = val;
      }
    }
    const overrideNames = Object.keys(DARK_OVERRIDES);

    check(overrideNames.length > 0 && overrideNames.every(n => LIGHT_NAMES.has(n)),
      "every dark-block override name exists in the light map — a token defined "
      + "only in the dark scheme would be undefined in light, a token with no "
      + "resting value — got " + JSON.stringify(overrideNames.filter(n => !LIGHT_NAMES.has(n))));
    check("--surface" in DARK_OVERRIDES && "--ink" in DARK_OVERRIDES,
      "the dark block redefines both --surface and --ink — a \"dark mode\" that "
      + "darkens neither is not one — got " + JSON.stringify(overrideNames));
    check(!("--brand" in DARK_OVERRIDES) && !("--brand-dark" in DARK_OVERRIDES)
       && !("--brand-rgb" in DARK_OVERRIDES),
      "the brand does not move: --brand, --brand-dark and --brand-rgb are absent "
      + "from the dark overrides — got " + JSON.stringify(overrideNames));

    [["light", TOKENS], ["dark", DARK_TOKENS]].forEach(([scheme, TOK]) => {
      distinctPairs.forEach(([y, x]) => {
        const fg = TOK[y], bg = TOK[x];
        const ratio = C2.contrastRatio(fg, bg);
        check(ratio !== null && ratio >= C2.CONTRAST_MIN,
          "chrome pair " + y + " on " + x + " clears AA in the " + scheme + " scheme — got "
          + (ratio === null ? "null" : ratio.toFixed(2) + ":1"));
      });
    });

    const sheetEmptyBlocks = [];
    const seRe = /\.sheet-empty\{([^}]*)\}/g;
    let sm;
    while((sm = seRe.exec(CSS8))) sheetEmptyBlocks.push(sm[1]);
    const islandBody = sheetEmptyBlocks.find(b => /--[A-Za-z0-9-]+\s*:/.test(b)) || null;

    const ISLAND_TOKENS = {};
    if(islandBody){
      const re4 = /--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g;
      let m4;
      while((m4 = re4.exec(islandBody))) ISLAND_TOKENS["--" + m4[1]] = m4[2].trim();
    }
    const islandNames = Object.keys(ISLAND_TOKENS);

    check(!!islandBody && islandNames.length > 0
       && islandNames.indexOf("--ink") >= 0 && islandNames.indexOf("--surface") >= 0,
      "the .sheet-empty island re-pin rule exists and is non-empty, naming at "
      + "least --ink and --surface — the page never themes, so the start view "
      + "needs its own light-locked token set — got " + JSON.stringify(islandNames));
    check(islandNames.every(n => LIGHT_NAMES.has(n)),
      "every re-pinned island token name exists in the light :root — a name "
      + "found nowhere in light would be the start view inventing a token, "
      + "not locking one — got " + JSON.stringify(islandNames.filter(n => !LIGHT_NAMES.has(n))));
    check(islandNames.every(n => ISLAND_TOKENS[n] === LIGHT_RAW[n]),
      "every re-pinned island value equals the light :root's own raw value "
      + "byte for byte — a drifted island value is the start view quietly "
      + "theming — got " + JSON.stringify(islandNames.filter(n => ISLAND_TOKENS[n] !== LIGHT_RAW[n])
          .map(n => n + ": island=" + ISLAND_TOKENS[n] + " light=" + LIGHT_RAW[n])));

    const islandVarNames = new Set();
    allRules.forEach(([sel, body]) => {
      if(sel.indexOf(".sheet-empty") < 0 && sel.indexOf(".start-") < 0) return;
      const reVar = /var\(\s*(--[A-Za-z0-9-]+)/g;
      let vm;
      while((vm = reVar.exec(body))) islandVarNames.add(vm[1]);
    });
    check(islandVarNames.size > 0,
      "at least one var(--x) is read by a .sheet-empty/.start- rule — a scan "
      + "that finds nothing must fail, not pass vacuously — got 0");
    const mustPin = Array.from(islandVarNames).filter(n => n in DARK_OVERRIDES);
    check(mustPin.length > 0,
      "at least one of those tokens is also redefined in the dark block, so "
      + "the completeness check has something to demand — got 0");
    check(mustPin.every(n => islandNames.indexOf(n) >= 0),
      "every island-subtree token that the dark block redefines is also in "
      + "the island's own pin list — a reader with no pin is the "
      + "--hover-faint bug again — missing: "
      + JSON.stringify(mustPin.filter(n => islandNames.indexOf(n) < 0)));
  }

}catch(e){
  failures.push("the suite threw before finishing: " + ((e && e.message) || e));
}

console.log("fixtures: " + (VALID.length + HOSTILE.length) + " roster files · valid " + VALID.length
  + " · hostile " + HOSTILE.length);
if(failures.length){
  console.log("\nFAILURES (" + failures.length + "):");
  failures.forEach(f => console.log("  ✗ " + f));
  console.log("\n" + passed + " passed, " + failures.length + " FAILED");
  if(typeof process !== "undefined") process.exit(1);
}else{
  console.log("all " + passed + " fixture assertions passed");
}
