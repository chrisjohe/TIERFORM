import { LIMITS } from "./settings.js";
import { clampText } from "./validation.js";

const uid = () => Math.random().toString(36).slice(2,9);

function normalizeGradeLinks(tiers){
  if(!Array.isArray(tiers)) return tiers;
  tiers.forEach((t, i) => {
    if(!t || typeof t !== "object") return;
    if(i === 0){ t.attach = false; t.merge = false; return; }
    t.merge  = t.merge === true;
    t.attach = t.merge || t.attach === true;
  });
  return tiers;
}

function newTier(code, label, o){
  o = o||{}; return {id:uid(), code, label,
      fill:o.fill||"green", attach:!!o.attach, merge:!!o.merge, align:o.align||"center"};
}

function newGroup(label){ return {id:uid(), label:label}; }

function resolveGroupId(st, text){
  const trimmed = clampText(text, LIMITS.text).trim();
  if(!trimmed) return null;
  if(!Array.isArray(st.groups)) st.groups = [];
  const norm = trimmed.toLowerCase();
  const hit = st.groups.find(g => g && typeof g.label === "string"
    && g.label.toLowerCase() === norm);
  if(hit) return hit.id;
  const g = newGroup(trimmed);
  st.groups.push(g);
  return g.id;
}

function groupLabel(st, p){
  const id = p && p.groupId;
  if(!id) return "";
  const g = (st && Array.isArray(st.groups) ? st.groups : []).find(g => g && g.id === id);
  return (g && g.label) || "";
}

function pruneGroups(st){
  if(!st || !Array.isArray(st.groups)) return;
  const used = new Set();
  (Array.isArray(st.people) ? st.people : []).forEach(p => { if(p && p.groupId) used.add(p.groupId); });
  st.groups = st.groups.filter(g => g && used.has(g.id));
}

const TEMPLATES = [
  {
    id:"big4-green", name:"Big 4 green", layout:"pyramid",
    accent:"#004225", ink:"#FFFFFF", nameLabelPosition:"next",
    grades:()=>normalizeGradeLinks([
      newTier("P","Partner"),
      newTier("AS","Assistant",         {fill:"white", attach:true, align:"right"}),
      newTier("D","Director"),
      newTier("SM","Senior Manager"),
      newTier("M","Manager"),
      newTier("SC","Senior Consultant"),
      newTier("C","Consultant"),
      newTier("A","Analyst"),
      newTier("JS","Junior Staff")
    ])
  },
  {
    id:"big4-orange", name:"Big 4 orange", layout:"swimlanes",

    accent:"#FF4F00", ink:"#000000", nameLabelPosition:"below",
    grades:()=>normalizeGradeLinks([
      newTier("P","Partner"),
      newTier("D","Director"),
      newTier("SM","Senior Manager"),
      newTier("M","Manager"),
      newTier("SA","Senior Associate"),
      newTier("A","Associate")
    ])
  },
  {
    id:"mbb-blue", name:"MBB blue", layout:"hive",
    accent:"#003153", ink:"#FFFFFF", nameLabelPosition:"below",
    grades:()=>normalizeGradeLinks([
      newTier("SP","Senior Partner"),

      newTier("AP","Associate Partner", {merge:true}),
      newTier("EM","Engagement Manager"),
      newTier("A","Associate"),
      newTier("F","Fellow"),
      newTier("JF","Junior Fellow")
    ])
  }
];

export { uid, normalizeGradeLinks, newTier, newGroup, resolveGroupId, groupLabel, pruneGroups, TEMPLATES };
