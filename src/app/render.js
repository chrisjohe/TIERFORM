import { angleIndex } from "../engine/helpers.js";
import { documentState } from "../model/document.js";
import { ENUMS } from "../model/settings.js";
import { oneOf } from "../model/validation.js";
import { drawChart } from "../ui/chart.js";
import { checkContrast, syncStyleSummaries } from "../ui/design.js";
import { updateDocLabel, updateHistoryButtons } from "../ui/document-status.js";
import { $ } from "../ui/dom.js";
import { renderRoster } from "../ui/roster.js";

function render(what){
  if(what === "all"){ renderAll(); return; }
  if(what === "roster") renderRoster();
  drawChart();
}

function renderAll(){
  updateDocLabel();
  renderRoster();
  $("#title").value  = documentState.state.title;
  $("#brand").value  = documentState.state.brand;
  $("#accent").value     = documentState.state.accent;
  $("#accentHex").value  = documentState.state.accent;
  $("#inkOnColour").value = documentState.state.inkOnColour || "#FFFFFF";
  $("#inkOnWhite").value  = documentState.state.inkOnWhite  || "#1A2129";
  $("#ring").value    = documentState.state.ring;
  $("#bg").value      = documentState.state.bg || "white";
  $("#layout").value  = oneOf(documentState.state.layout, ENUMS.layout, "pyramid");
  $("#showGradeCode").checked = documentState.state.showGradeCode !== false;
  $("#showGradeName").checked = documentState.state.showGradeName === true;
  $("#nameLabelPosition").value = oneOf(documentState.state.nameLabelPosition, ENUMS.nameLabelPosition, "below");
  $("#nameBold").value = oneOf(documentState.state.nameBold, ENUMS.nameBold, "given");
  $("#font").value = oneOf(documentState.state.font, ENUMS.font, "open-sans");
  $("#showPersonName").checked = documentState.state.showPersonName !== false;
  $("#showPersonGrade").checked = documentState.state.showPersonGrade !== false;
  $("#showPersonGroup").checked = documentState.state.showPersonGroup !== false;
  $("#angle").value = angleIndex(documentState.state.angle);
  $("#page").value    = documentState.state.page || "landscape";
  $("#density").value = documentState.state.density || "balanced";

  syncStyleSummaries();
  checkContrast();
  drawChart();
  updateHistoryButtons();
}

export { render, renderAll };
