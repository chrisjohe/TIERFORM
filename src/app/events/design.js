import { documentState } from "../../model/document.js";
import { commit, edit } from "../../model/history.js";
import { ENUMS, LIMITS } from "../../model/settings.js";
import { clampText, hexFieldValue, oneOf } from "../../model/validation.js";
import { checkContrast, syncStyleSummaries } from "../../ui/design.js";
import { $ } from "../../ui/dom.js";

function bindDesignEvents(){
$("#title").addEventListener("input", e=>edit("title", "changed the title", ()=>{ documentState.state.title=clampText(e.target.value,LIMITS.title); }));

$("#groupsLabel").addEventListener("input", e=>edit("groupsLabel", "changed the group-axis label", ()=>{ documentState.state.groupsLabel=clampText(e.target.value,LIMITS.title); }));

$("#brand").addEventListener("input", e=>edit("brand", "changed the right-hand label", ()=>{ documentState.state.brand=clampText(e.target.value,LIMITS.title); }));

$("#showGradeCode").addEventListener("change", e=>commit(
  e.target.checked ? "showed grade codes" : "hid grade codes",
  ()=>{ documentState.state.showGradeCode = e.target.checked; }, {render:"chart"}));

$("#showGradeName").addEventListener("change", e=>commit(
  e.target.checked ? "showed grade names" : "hid grade names",
  ()=>{ documentState.state.showGradeName = e.target.checked; }, {render:"chart"}));

$("#nameLabelPosition").addEventListener("change", e=>{
  const value = oneOf(e.target.value, ENUMS.nameLabelPosition, "below");
  commit(value === "below" ? "put name labels below photos" : "put name labels next to photos",
    ()=>{ documentState.state.nameLabelPosition = value; }, {render:"chart"});
  syncStyleSummaries();
});

$("#nameBold").addEventListener("change", e=>{
  const value = oneOf(e.target.value, ENUMS.nameBold, "given");
  commit("changed the name bolding",
    ()=>{ documentState.state.nameBold = value; }, {render:"chart"});
  syncStyleSummaries();
});

$("#font").addEventListener("change", e=>{
  const value = oneOf(e.target.value, ENUMS.font, "open-sans");
  commit("Font",
    ()=>{ documentState.state.font = value; }, {render:"chart"});
  syncStyleSummaries();
});

$("#showPersonName").addEventListener("change", e=>commit(
  e.target.checked ? "showed person names" : "hid person names",
  ()=>{ documentState.state.showPersonName = e.target.checked; }, {render:"chart"}));

$("#showPersonGrade").addEventListener("change", e=>commit(
  e.target.checked ? "showed person grades" : "hid person grades",
  ()=>{ documentState.state.showPersonGrade = e.target.checked; }, {render:"chart"}));

$("#showPersonGroup").addEventListener("change", e=>commit(
  e.target.checked ? "showed person groups" : "hid person groups",
  ()=>{ documentState.state.showPersonGroup = e.target.checked; }, {render:"chart"}));

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

$("#inkOnColour").addEventListener("input", e=>{
  edit("inkOnColour", "changed the colour on the accent", ()=>{ documentState.state.inkOnColour=e.target.value; });
  checkContrast();
});

$("#inkOnWhite").addEventListener("input", e=>{
  edit("inkOnWhite", "changed the colour on white", ()=>{ documentState.state.inkOnWhite =e.target.value; });
  checkContrast();
});

$("#bg").addEventListener("change", e=>{ commit("changed the background", ()=>{ documentState.state.bg=e.target.value; }, {render:"chart"}); syncStyleSummaries(); });

$("#ring").addEventListener("change", e=>{ commit("changed the photo ring", ()=>{ documentState.state.ring=e.target.value; }, {render:"chart"}); syncStyleSummaries(); });

$("#angle").addEventListener("input", e=>{
  edit("angle", "changed the angle", ()=>{ documentState.state.angle = +e.target.value; });
});

$("#layout").addEventListener("change", e=>commit("changed the layout",
  ()=>{ documentState.state.layout = oneOf(e.target.value, ENUMS.layout, "pyramid"); }, {render:"all"}));

$("#page").addEventListener("change", e=>{ commit("changed the page size", ()=>{ documentState.state.page=e.target.value; }, {render:"chart"}); syncStyleSummaries(); });

$("#density").addEventListener("change", e=>{ commit("changed the spacing", ()=>{ documentState.state.density=e.target.value; }, {render:"chart"}); syncStyleSummaries(); });
}

export { bindDesignEvents };
