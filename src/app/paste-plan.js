import { splitPasteRow } from "../io/csv.js";
import { documentState } from "../model/document.js";
import { LIMITS } from "../model/settings.js";
import { clampText } from "../model/validation.js";

function matchTierByGrade(grade){
  const g = grade.trim().toLowerCase();
  if(!g) return null;
  return documentState.state.tiers.find(t=>(t.code||"").trim().toLowerCase()===g)
      || documentState.state.tiers.find(t=>(t.label||"").trim().toLowerCase()===g)
      || null;
}

const PASTE_NEW       = "\u0000new";

const PASTE_NEW_CODE  = "NEW";

const PASTE_NEW_LABEL = "New grade";

function pasteNewTier(){ return matchTierByGrade(PASTE_NEW_CODE); }

function pasteGradePlan(rows){
  const distinct = [];
  const seen = new Set();
  let anyEmpty = false;
  for(const r of (rows || [])){
    const raw = r && r.gradeRaw;
    if(!raw){ anyEmpty = true; continue; }
    const norm = raw.trim().toLowerCase();
    if(!seen.has(norm)){ seen.add(norm); distinct.push(raw); }
  }
  const hasNew = distinct.some(v => v.trim().toLowerCase() === "new");
  const needed = distinct.length + (anyEmpty && !hasNew ? 1 : 0);
  return {distinct, anyEmpty, hasNew, needed};
}

function parsePasteText(text, fallbackTierId){
  const rows = [];

  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  let checkedHeader = false;

  for(const raw of text.split(/\r\n|\r|\n/)){
    const line = raw.trim();
    if(!line) continue;
    const parts = splitPasteRow(line).map(s=>s.trim());

    if(!checkedHeader){
      checkedHeader = true;
      if(parts[0].toLowerCase() === "name" && (parts[1]||"").toLowerCase() === "grade") continue;
    }
    const name = clampText(parts[0] || "", LIMITS.text);
    if(!name) continue;

    const gradeRaw = clampText(parts[1] || "", LIMITS.text);
    const pasted = clampText(parts[2] || "", LIMITS.text);
    const group = pasted;
    const role = clampText(parts[3] || "", LIMITS.text);
    const matchedTier = gradeRaw ? matchTierByGrade(gradeRaw) : null;
    rows.push({name, group, gradeRaw, role,
               tierId: matchedTier ? matchedTier.id : fallbackTierId,
               unmatched: !!gradeRaw && !matchedTier});
    if(rows.length > LIMITS.people) break;
  }
  return rows;
}

export { matchTierByGrade, PASTE_NEW, PASTE_NEW_CODE, PASTE_NEW_LABEL, pasteNewTier, pasteGradePlan, parsePasteText };
