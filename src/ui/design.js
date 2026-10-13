import { meas } from "../app/layout.js";
import { PAGES } from "../engine/constants.js";
import { documentState } from "../model/document.js";
import { FONTS, LAYOUTS, notAvailableIn } from "../model/settings.js";
import { CONTRAST_MIN, contrastRatio } from "../render/colour.js";
import { $ } from "./dom.js";

function checkContrast(){
  const chip = $("#contrastWarn");
  if(!chip) return;
  const badge = $("#textWarnBadge");
  const pairs = [
    {ratio: contrastRatio(documentState.state.accent, documentState.state.inkOnColour), what: "on the accent"},
    {ratio: contrastRatio("#ffffff", documentState.state.inkOnWhite),     what: "on white bands"}
  ].filter(p => p.ratio !== null && p.ratio < CONTRAST_MIN);

  if(!pairs.length){
    chip.hidden = true; chip.textContent = "";
    if(badge) badge.hidden = true;
    return;
  }
  chip.hidden = false;
  if(badge) badge.hidden = false;
  chip.textContent = pairs
    .map(p => "Text " + p.what + " is below the recommended " + CONTRAST_MIN
      + ":1 contrast (currently " + p.ratio.toFixed(1) + ":1)")
    .join(" · ");
}

function syncStyleSummaries(){
  const labels = {
    layout:Object.fromEntries(Object.entries(LAYOUTS).map(([id, c]) => [id, c.label])),
    density:{tight:"Tight",balanced:"Balanced",airy:"Airy"},
    page:Object.fromEntries(Object.entries(PAGES).map(([id, p]) => [id, p.label])),
    bg:{white:"White",transparent:"Transparent"},
    ring:{none:"None",accent:"Accent",white:"White"},
    nameLabelPosition:{below:"Below photo",next:"Next to photo"},
    nameBold:{given:"First names",family:"Last name",all:"Whole name",none:"None"},
    font:{"open-sans":"Open Sans","segoe-ui":"Segoe UI",roboto:"Roboto",helvetica:"Helvetica",arial:"Arial"}
  };
  const faces = {layout:$("#layoutBtn"), density:$("#densityBtn"),
                 page:$("#pageBtn"), bg:$("#bgBtn"), ring:$("#ringBtn"),
                 nameLabelPosition:$("#nameLabelsBtn"), nameBold:$("#nameLabelsBtn"),
                 font:$("#fontBtn")};
  const names = {layout:"Layout",density:"Spacing",page:"Page",
                 bg:"Background",ring:"Photo ring",nameLabelPosition:"Name labels",
                 nameBold:"Name labels", font:"Font"};
  for(const id of Object.keys(labels)){
    const control = $("#"+id), value = labels[id][control.value] || control.value;
    faces[id].setAttribute("aria-label", names[id] + ": " + value);
    document.querySelectorAll('[data-style-select="'+id+'"]').forEach(b=>
      b.setAttribute("aria-checked", String(b.dataset.value === control.value)));
  }

  $("#accentSwatch").style.setProperty("--swatch", $("#accent").value);
  $("#inkAccentDot").style.setProperty("--swatch", $("#accent").value);
  $("#accentBtn").setAttribute("aria-label", "Accent: " + $("#accent").value);
  const cap = LAYOUTS[$("#layout").value] || LAYOUTS.pyramid;
  const lane = !cap.angle;
  const angleReason = notAvailableIn(cap);
  $("#angleBtn").disabled = lane;
  $("#angleBtn").title = lane ? angleReason : "Angle";
  $("#angleBtn").setAttribute("aria-label", lane
    ? "Angle — " + angleReason.charAt(0).toLowerCase() + angleReason.slice(1)
    : "Angle");
  $("#angle").disabled = lane;

  $("#nameLabelsBtn").disabled = false;
  $("#nameLabelsBtn").title = "";
  $("#nameLabelsBtn").setAttribute("aria-label", "Name labels");
  document.querySelectorAll('[data-style-select="nameLabelPosition"]').forEach(b=>{
    b.disabled = false;
    b.title = "";
  });
}

function fontInstalled(family){
  const probe = "mmmwwwil10";
  meas.font = "16px " + family + ",monospace";
  const wMono = meas.measureText(probe).width;
  meas.font = "16px monospace";
  const generic1 = meas.measureText(probe).width;
  meas.font = "16px " + family + ",serif";
  const wSerif = meas.measureText(probe).width;
  meas.font = "16px serif";
  const generic2 = meas.measureText(probe).width;
  return wMono !== generic1 || wSerif !== generic2;
}

function syncFontAvailability(){
  let anyMissing = false;
  document.querySelectorAll('#fontMenu [data-style-select="font"]').forEach(row=>{

    const stack = FONTS[row.dataset.value];
    const family = (stack.split(",")[0] || "").trim();
    const installed = fontInstalled(family);
    if(!installed) anyMissing = true;
    const badge = row.querySelector(".style-warn");
    if(badge) badge.hidden = installed;
    if(installed) row.removeAttribute("title");
    else row.setAttribute("title",
      "Not installed on this machine — the chart is drawn with a fallback font.");
  });

  const legend = $("#fontMenu .font-legend");
  if(legend) legend.hidden = !anyMissing;
}

export { checkContrast, syncStyleSummaries, fontInstalled, syncFontAvailability };
