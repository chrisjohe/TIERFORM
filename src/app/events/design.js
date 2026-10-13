import { documentState } from "../../model/document.js";
import { commit, edit } from "../../model/history.js";
import { ENUMS, LIMITS } from "../../model/settings.js";
import { clampText, hexFieldValue, oneOf } from "../../model/validation.js";
import { checkContrast, syncStyleSummaries } from "../../ui/design.js";
import { $ } from "../../ui/dom.js";

function bindDesignEvents(){
for(const [id, label] of [
  ["title", "changed the title"], ["groupsLabel", "changed the group-axis label"],
  ["brand", "changed the right-hand label"]
]) $("#"+id).addEventListener("input", e=>edit(id, label,
  ()=>{ documentState.state[id] = clampText(e.target.value, LIMITS.title); }));

for(const [id, label] of [
  ["showGradeCode", "grade codes"], ["showGradeName", "grade names"],
  ["showPersonName", "person names"], ["showPersonGrade", "person grades"],
  ["showPersonGroup", "person groups"]
]) $("#"+id).addEventListener("change", e=>commit(
  (e.target.checked ? "showed " : "hid ")+label,
  ()=>{ documentState.state[id] = e.target.checked; }, {render:"chart"}));

for(const [id, fallback, label] of [
  ["nameLabelPosition", "below", value => value === "below"
    ? "put name labels below photos" : "put name labels next to photos"],
  ["nameBold", "given", ()=>"changed the name bolding"],
  ["font", "open-sans", ()=>"Font"]
]) $("#"+id).addEventListener("change", e=>{
  const value = oneOf(e.target.value, ENUMS[id], fallback);
  commit(label(value), ()=>{ documentState.state[id] = value; }, {render:"chart"});
  syncStyleSummaries();
});

$("#accent").addEventListener("input", e=>{
  edit("accent", "changed the accent colour", ()=>{ documentState.state.accent=e.target.value; });
  $("#accentHex").value = documentState.state.accent;
  syncStyleSummaries();
  checkContrast();
});

$("#accentHex").addEventListener("input", e=>{
  const v = hexFieldValue(e.target.value);
  if(v === null || v === documentState.state.accent) return;
  edit("accent", "changed the accent colour", ()=>{ documentState.state.accent = v; });
  $("#accent").value = v;
  syncStyleSummaries();
  checkContrast();
});

$("#accentHex").addEventListener("blur", ()=>{ $("#accentHex").value = documentState.state.accent; });

for(const [id, label] of [
  ["inkOnColour", "changed the colour on the accent"],
  ["inkOnWhite", "changed the colour on white"]
]) $("#"+id).addEventListener("input", e=>{
  edit(id, label, ()=>{ documentState.state[id] = e.target.value; });
  checkContrast();
});

for(const [id, label] of [
  ["bg", "changed the background"], ["ring", "changed the photo ring"],
  ["page", "changed the page size"], ["density", "changed the spacing"]
]) $("#"+id).addEventListener("change", e=>{
  commit(label, ()=>{ documentState.state[id] = e.target.value; }, {render:"chart"});
  syncStyleSummaries();
});

$("#angle").addEventListener("input", e=>{
  edit("angle", "changed the angle", ()=>{ documentState.state.angle = +e.target.value; });
});

$("#layout").addEventListener("change", e=>commit("changed the layout",
  ()=>{ documentState.state.layout = oneOf(e.target.value, ENUMS.layout, "pyramid"); }, {render:"all"}));

}

export { bindDesignEvents };
