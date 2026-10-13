import { groupLabel } from "./entities.js";

function splitName(full){
  const parts = String(full||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return {bold:"",rest:""};
  if(parts.length===1) return {bold:parts[0],rest:""};

  let cut = parts.length - 1;
  while(cut > 1 && parts[cut-1] === parts[cut-1].toLowerCase()) cut--;
  return {bold:parts.slice(0,cut).join(" "), rest:parts.slice(cut).join(" ")};
}

function nameSegs(st, full){
  const nm = splitName(full);
  const trail = nm.rest ? " " + nm.rest : "";
  if(st.nameBold === "family") return [{t:nm.bold, w:400}, {t:trail, w:600}];
  if(st.nameBold === "all")    return [{t:nm.bold + trail, w:600}];
  if(st.nameBold === "none")   return [{t:nm.bold + trail, w:400}];
  return [{t:nm.bold, w:600}, {t:trail, w:400}];
}

function initials(full){
  const p = String(full||"").trim().split(/\s+/).filter(Boolean);
  if(!p.length) return "?";
  return ((p[0][0]||"") + (p.length>1 ? p[p.length-1][0] : "")).toUpperCase();
}

function tierRole(t){ return t ? (t.label || "") : ""; }

function subline(st, p, lookup){
  const t = (lookup ? lookup.tiers.get(p.tierId) : st.tiers.find(t => t.id === p.tierId)) || st.tiers[0];
  const role = (p.role && p.role.trim()) || tierRole(t);
  const parts = [];
  if(st.showPersonGrade !== false && role) parts.push(role);
  const g = groupLabel(st, p, lookup);
  if(st.showPersonGroup !== false && g) parts.push(g);
  return parts.join("  |  ");
}

function gradeName(t){ return t ? (t.label || t.code || "this grade") : "this grade"; }

export { splitName, nameSegs, initials, tierRole, subline, gradeName };
