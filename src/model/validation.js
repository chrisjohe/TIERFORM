import { ENUMS, LIMITS } from "./settings.js";

const ANCHORS = ["start","middle","end"];

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function validatePhoto(src){
  if(typeof src !== "string") return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src.trim());
  if(!m) return null;
  if(src.length > LIMITS.photoBytes) return null;
  if(m[2].length % 4 !== 0) return null;
  return src.trim();
}

function encodedPhotoBytes(st){
  return (st.people || []).reduce((sum, p) =>
    sum + (typeof p.photo === "string" ? p.photo.length : 0), 0);
}

function photoBudgetExceeded(st, addedBytes, removedBytes){
  return encodedPhotoBytes(st) - (removedBytes||0) + addedBytes > LIMITS.totalPhotoBytes;
}

function stateLimitProblem(st){
  if(!st || !Array.isArray(st.tiers) || !Array.isArray(st.people) || !Array.isArray(st.groups))
    return "the document structure is incomplete";
  if(!st.tiers.length) return "the roster has no grades";
  if(st.tiers.length > LIMITS.tiers) return "the roster has more than " + LIMITS.tiers + " grades";
  if(st.people.length > LIMITS.people) return "the roster has more than " + LIMITS.people + " people";
  if(st.groups.length > LIMITS.people) return "the roster has more than " + LIMITS.people + " groups";
  if(encodedPhotoBytes(st) > LIMITS.totalPhotoBytes)
    return "the photos exceed the " + Math.round(LIMITS.totalPhotoBytes/1024/1024) + " MB limit";

  if(st.layout !== undefined && ENUMS.layout.indexOf(st.layout) < 0)
    return "the document uses a layout this version cannot draw";
  if(st.showGradeCode !== undefined && typeof st.showGradeCode !== "boolean")
    return "the grade-code display setting is unusable";
  if(st.showGradeName !== undefined && typeof st.showGradeName !== "boolean")
    return "the grade-name display setting is unusable";
  if(st.nameLabelPosition !== undefined
     && ENUMS.nameLabelPosition.indexOf(st.nameLabelPosition) < 0)
    return "the name-label position is unusable";
  if(st.nameBold !== undefined && ENUMS.nameBold.indexOf(st.nameBold) < 0)
    return "the name-bolding setting is unusable";
  if(st.font !== undefined && ENUMS.font.indexOf(st.font) < 0)
    return "the font setting is unusable";
  for(const field of ["showPersonName","showPersonGrade","showPersonGroup"]){
    if(st[field] !== undefined && typeof st[field] !== "boolean")
      return "the person-label display setting is unusable";
  }

  const tooLong = (v, max) => typeof v !== "string" || v.length > max;
  if(tooLong(st.title, LIMITS.title) || tooLong(st.brand, LIMITS.title) || tooLong(st.groupsLabel, LIMITS.title))
    return "a document label is longer than " + LIMITS.title + " characters";
  if(st.tiers.some(t => tooLong(t.code, LIMITS.text) || tooLong(t.label, LIMITS.text)))
    return "a grade field is longer than " + LIMITS.text + " characters";
  if(st.groups.some(g => !g || tooLong(g.label, LIMITS.text)))
    return "a group label is longer than " + LIMITS.text + " characters";
  if(st.people.some(p => tooLong(p.name, LIMITS.text) || tooLong(p.role, LIMITS.text)))
    return "a person field is longer than " + LIMITS.text + " characters";
  return null;
}

function isPlainObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function clampText(v, max){
  return typeof v === "string" ? v.slice(0, max) : "";
}

function oneOf(v, allowed, fallback){
  return allowed.indexOf(v) >= 0 ? v : fallback;
}

function validColour(v, fallback){
  return (typeof v === "string" && HEX6.test(v.trim())) ? v.trim().toUpperCase() : fallback;
}

function hexFieldValue(raw){
  const s = String(raw == null ? "" : raw).trim();
  return validColour(s.charAt(0) === "#" ? s : "#" + s, null);
}

export { ANCHORS, HEX6, validatePhoto, encodedPhotoBytes, photoBudgetExceeded, stateLimitProblem, isPlainObject, clampText, oneOf, validColour, hexFieldValue };
