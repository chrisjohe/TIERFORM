import { DENSITY, PAGES } from "../engine/constants.js";
import { angleIndex } from "../engine/helpers.js";
import { DECODE_CANCELLED, decodeImage } from "./photo-decode.js";
import { normalizeGradeLinks, pruneGroups, uid } from "../model/entities.js";
import { clampFrame } from "../model/framing.js";
import { applyPhoto } from "../model/photos.js";
import { ENUMS, FILE_FORMAT, LIMITS } from "../model/settings.js";
import { clampText, isPlainObject, oneOf, validColour, validatePhoto } from "../model/validation.js";

function parseAndValidateRoster(raw){
  const repaired = [];
  const fail = reason => ({ok:false, reason});
  const note = what => { if(repaired.indexOf(what) < 0) repaired.push(what); };

  if(typeof raw !== "string") return fail("the file is not text");
  if(raw.length > LIMITS.rosterBytes)
    return fail("the file is larger than the " + Math.round(LIMITS.rosterBytes/1024/1024) + " MB limit");

  let doc;
  try{ doc = JSON.parse(raw); }
  catch(e){ return fail("the file is not valid JSON"); }

  if(!isPlainObject(doc)) return fail("the file does not contain a roster object");

  if(Object.prototype.hasOwnProperty.call(doc, "format") && doc.format !== FILE_FORMAT)
    return fail("the file uses roster format " + JSON.stringify(doc.format)
      + " — this build reads format " + FILE_FORMAT);
  if(!Array.isArray(doc.tiers)) return fail("the file has no list of grades");
  if(!Array.isArray(doc.people)) return fail("the file has no list of people");
  if(!doc.tiers.length) return fail("the file contains no grades at all");
  if(doc.tiers.length > LIMITS.tiers)
    return fail("the file has " + doc.tiers.length + " grades — the limit is " + LIMITS.tiers);
  if(doc.people.length > LIMITS.people)
    return fail("the file has " + doc.people.length + " people — the limit is " + LIMITS.people);
  if(!doc.tiers.every(isPlainObject)) return fail("one of the grades is not a grade");
  if(!doc.people.every(isPlainObject)) return fail("one of the people is not a person");

  const seenIds = Object.create(null);
  for(const t of doc.tiers){
    const key = String(t.id);
    if(seenIds[key]) return fail("two grades share the id “" + clampText(key, 40)
      + "”, so the people in them cannot be told apart");
    seenIds[key] = true;
  }

  const firstClaimedMerge = isPlainObject(doc.tiers[0]) && doc.tiers[0].merge === true;

  const st = doc;

  const had = (o, k) => isPlainObject(o) && Object.prototype.hasOwnProperty.call(o, k);
  const stated = k => had(doc, k);
  const noteChanged = (k, what) => { if(stated(k) && out[k] !== doc[k]) note(what); };

  const out = {
    title:  clampText(st.title, LIMITS.title),
    brand:  clampText(st.brand, LIMITS.title),
    groupsLabel: clampText(st.groupsLabel, LIMITS.title),
    accent:      validColour(st.accent,      "#003153"),
    inkOnColour: validColour(st.inkOnColour, "#FFFFFF"),
    inkOnWhite:  validColour(st.inkOnWhite,  "#1A2129"),
    bg:      oneOf(st.bg,   ENUMS.bg,   "white"),
    ring:    oneOf(st.ring, ENUMS.ring, "none"),

    layout:  oneOf(st.layout, ENUMS.layout, "pyramid"),
    showGradeCode: typeof st.showGradeCode === "boolean" ? st.showGradeCode : true,
    showGradeName: typeof st.showGradeName === "boolean" ? st.showGradeName : false,
    nameLabelPosition: oneOf(st.nameLabelPosition, ENUMS.nameLabelPosition, "below"),
    nameBold: oneOf(st.nameBold, ENUMS.nameBold, "given"),
    font: oneOf(st.font, ENUMS.font, "open-sans"),
    showPersonName: typeof st.showPersonName === "boolean" ? st.showPersonName : true,
    showPersonGrade: typeof st.showPersonGrade === "boolean" ? st.showPersonGrade : true,
    showPersonGroup: typeof st.showPersonGroup === "boolean" ? st.showPersonGroup : true,
    page:    Object.prototype.hasOwnProperty.call(PAGES, st.page) ? st.page : "landscape",
    density: Object.prototype.hasOwnProperty.call(DENSITY, st.density) ? st.density : "balanced",
    angle: 2,
    tiers: [],
    people: []
  };
  noteChanged("title", "title");
  noteChanged("brand", "right-hand label");
  noteChanged("groupsLabel", "group-axis label");
  noteChanged("accent", "accent colour");
  noteChanged("inkOnColour", "text colour on the accent");
  noteChanged("inkOnWhite", "text colour on white");
  noteChanged("bg", "background");
  noteChanged("ring", "photo ring");
  noteChanged("page", "page size");
  noteChanged("density", "spacing");
  noteChanged("layout", "layout");
  noteChanged("showGradeCode", "grade-code label");
  noteChanged("showGradeName", "grade-name label");
  noteChanged("nameLabelPosition", "name-label position");
  noteChanged("nameBold", "name bolding");
  noteChanged("font", "font");
  noteChanged("showPersonName", "person-name display");
  noteChanged("showPersonGrade", "person-grade display");
  noteChanged("showPersonGroup", "person-group display");

  const angle = angleIndex(st.angle);
  if(!Number.isFinite(angle) || angle < 0 || angle > 4) return fail("the angle is unusable");
  out.angle = angle;
  if(typeof st.angle === "number" && st.angle !== angle) note("angle");

  const idMap = Object.create(null);
  st.tiers.forEach((t, i) => {
    const fresh = uid();
    idMap[String(t.id)] = fresh;
    const fill  = oneOf(t.fill,  ENUMS.fill,  "green");
    const align = oneOf(t.align, ENUMS.align, "center");

    if(had(t, "fill")  && fill  !== t.fill)  note("band fill");
    if(had(t, "align") && align !== t.align) note("alignment");
    if((had(t, "attach") && typeof t.attach !== "boolean")
       || (had(t, "merge") && typeof t.merge !== "boolean")) note("grade options");
    const code  = clampText(t.code, LIMITS.text);
    const label = clampText(t.label, LIMITS.text) || "Grade " + (i + 1);
    if(code !== t.code) note("grade code");
    if(label !== t.label) note("grade name");

    out.tiers.push({
      id: fresh,
      code:  code,
      label: label,
      fill: fill,
      attach: t.attach === true,

      merge: i > 0 && t.merge === true,
      align: align
    });
  });
  if(firstClaimedMerge) note("the first grade sharing a band");

  normalizeGradeLinks(out.tiers);

  out.groups = [];
  const groupIdMap = Object.create(null);
  if(stated("groups")){
    if(Array.isArray(doc.groups)){
      const overCap = doc.groups.length > LIMITS.people;
      const source = overCap ? doc.groups.slice(0, LIMITS.people) : doc.groups;
      const seenLabels = Object.create(null);
      source.forEach(g => {
        if(!isPlainObject(g)){ note("group"); return; }
        const label = clampText(g.label, LIMITS.text).trim();
        if(!label){ note("group"); return; }
        const norm = label.toLowerCase();
        if(Object.prototype.hasOwnProperty.call(seenLabels, norm)){

          groupIdMap[String(g.id)] = seenLabels[norm];
          note("group");
          return;
        }
        const fresh = uid();
        seenLabels[norm] = fresh;
        groupIdMap[String(g.id)] = fresh;
        out.groups.push({id: fresh, label: label});
      });
      if(overCap) note("group");
    } else {

      note("group");
    }
  }

  const statedGroupIds = new Set(out.groups.map(g => g.id));

  let totalPhotoBytes = 0;
  for(let i = 0; i < st.people.length; i++){
    const p = st.people[i];
    const tierId = idMap[String(p.tierId)];
    if(!tierId) return fail("person " + (i + 1)
      + (p.name ? " (" + clampText(String(p.name), 40) + ")" : "")
      + " belongs to a grade that is not in the file");

    const photo = validatePhoto(p.photo);
    if(p.photo && !photo) note("photo of " + (clampText(String(p.name), 40) || "person " + (i + 1)));
    if(photo){
      totalPhotoBytes += photo.length;
      if(totalPhotoBytes > LIMITS.totalPhotoBytes)
        return fail("the photos together are larger than the "
          + Math.round(LIMITS.totalPhotoBytes/1024/1024) + " MB limit");
    }

    let pw = 0, ph = 0, frame = null;
    if(photo){
      pw = Number(p.pw); ph = Number(p.ph);
      if(!Number.isFinite(pw) || !Number.isFinite(ph) || pw <= 0 || ph <= 0
         || pw > LIMITS.photoDim || ph > LIMITS.photoDim){
        pw = 240; ph = 240;
        note("photo size of " + (clampText(String(p.name), 40) || "person " + (i + 1)));
      }
      const f = isPlainObject(p.frame) ? p.frame : {};
      frame = {zoom: Number(f.zoom), ox: Number(f.ox), oy: Number(f.oy)};
      if(!Number.isFinite(frame.zoom)) frame.zoom = 1;
      if(!Number.isFinite(frame.ox))   frame.ox = 0;
      if(!Number.isFinite(frame.oy))   frame.oy = 0;
    }

    const name = clampText(p.name, LIMITS.text);
    const role = clampText(p.role, LIMITS.text);
    if(had(p, "name")   && name   !== p.name)   note("person name");
    if(had(p, "role")   && role   !== p.role)   note("person role");

    let groupId = null;
    if(had(p, "groupId")){
      if(p.groupId != null){
        const mapped = groupIdMap[String(p.groupId)];
        groupId = mapped || null;
        if(!mapped) note("person group");
      }
    }

    const person = {
      id: uid(),
      name:   name,
      tierId: tierId,
      groupId: groupId,
      role:   role,
      photo: photo, pw: pw, ph: ph, frame: frame
    };
    clampFrame(person);
    out.people.push(person);
  }

  const usedGroupIds = new Set();
  out.people.forEach(p => { if(p.groupId) usedGroupIds.add(p.groupId); });
  out.groups.forEach(g => {
    if(!usedGroupIds.has(g.id) && statedGroupIds.has(g.id)) note("group");
  });
  pruneGroups(out);

  return {ok:true, state:out, repaired:repaired};
}

async function decodeRosterPhotos(st, repaired, cancelled){
  const stop = cancelled || (() => false);
  const note = what => { if(repaired.indexOf(what) < 0) repaired.push(what); };
  for(let i = 0; i < st.people.length; i++){

    if(stop()) return false;
    const p = st.people[i];
    if(!p.photo) continue;
    const who = clampText(p.name, 40) || "person " + (i + 1);
    const dim = await decodeImage(p.photo, stop);

    if(dim === DECODE_CANCELLED || stop()) return false;
    if(!dim){
      applyPhoto(p, null);
      note("photo of " + who + " — the file is not a readable image");
      continue;
    }
    if(dim.problem){
      applyPhoto(p, null);
      note("photo of " + who + " — it " + dim.problem);
      continue;
    }

    if(p.pw !== dim.w || p.ph !== dim.h){
      note("photo size of " + who + " — the file said " + p.pw + "×" + p.ph
        + ", the image is " + dim.w + "×" + dim.h);
      p.pw = dim.w; p.ph = dim.h;
      clampFrame(p);
    }
  }

  return !stop();
}

async function openRoster(raw, options){
  const cancelled = (options && options.cancelled) || (() => false);
  const r = parseAndValidateRoster(raw);
  if(!r.ok) return r;
  if(cancelled()) return {ok:false, cancelled:true};
  const finished = await decodeRosterPhotos(r.state, r.repaired, cancelled);
  if(!finished) return {ok:false, cancelled:true};
  return r;
}

export { parseAndValidateRoster, decodeRosterPhotos, openRoster };
