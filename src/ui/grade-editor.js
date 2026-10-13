import { documentState } from "../model/document.js";
import { ENUMS, LAYOUTS, LIMITS, notAvailableIn } from "../model/settings.js";
import { oneOf } from "../model/validation.js";
import { $, el, icon } from "./dom.js";

function gradeChip(t){
  const name = t.label || t.code || "this grade";
  const dragHelp = $("#gradeDragHelp");

  return el("div", {cls:"g-chip", did:t.id}, [
    el("div", {cls:"big g-chip-face", draggable:true, title:"Drag to reorder"}, [
      el("span", {cls:"g-code", text:t.code}),
      el("span", {cls:"g-name", text:t.label})
    ]),
    el("button", {cls:"split-toggle g-chip-toggle", type:"button", tact:"open", did:t.id,
                  title:"Grade settings",
                  label:"Grade " + name + " — open settings",
                  attrs:{"aria-describedby":dragHelp ? dragHelp.id : "gradeDragHelp",
                         "aria-haspopup":"dialog", "aria-expanded":"false"}},
      [icon("#i-caret")])
  ]);
}

function gradePanelBody(t, i){
  const name = t.label || t.code || "this grade";

  const fillNow = t.fill === "white" ? "white" : "green";
  const fillOpt = (value, art, text, title) =>
    el("button", {cls:"gopt", type:"button", tact:"fill", did:t.id, title:title,
                  attrs:{role:"radio", "aria-checked":String(value === fillNow),
                         "data-value":value}}, [art, el("span", {text:text})]);

  const alignNow = oneOf(t.align, ENUMS.align, "center");
  const alignOpt = (value, art, text, title, disabled) =>
    el("button", {cls:"gopt", type:"button", tact:"align", did:t.id, title:title,
                  disabled:disabled,
                  attrs:{role:"radio", "aria-checked":String(value === alignNow),
                         "data-value":value}}, [art, el("span", {text:text})]);

  const first = i === 0;
  const cap = LAYOUTS[documentState.state.layout] || LAYOUTS.pyramid;
  const surface = cap.surface;
  const swim = surface === "lane";
  const gapSide = swim ? "before it" : "above it";
  const gapPlace = swim ? "before " + name : "above " + name;
  const above = first ? "" : (documentState.state.tiers[i-1].label || documentState.state.tiers[i-1].code
                               || (swim ? "the previous grade" : "the grade above"));

  const fills = el("div", {cls:"gopts", attrs:{role:"radiogroup",
                    "aria-label":(swim ? "Lane" : "Band") + " fill for " + name}}, [
    fillOpt("green", icon("#i-colors"), "Accent",      "Fill the " + surface + " with the accent colour"),
    fillOpt("white", icon("#i-square"), "Border only", "Draw the " + surface + " as an outline only")
  ]);

  const alignDisabled = !cap.align;
  const alignTitle = alignDisabled ? notAvailableIn(cap) : null;
  const aligns = el("div", {cls:"gopts", attrs:{role:"radiogroup",
                     "aria-label":"Where people sit in the " + surface + ", for " + name
                                  + (alignDisabled ? " — " + notAvailableIn(cap).charAt(0).toLowerCase()
                                                        + notAvailableIn(cap).slice(1) : "")}}, [
    alignOpt("left",   icon("#i-align-left"),   "Left",
             alignTitle || "Push the people to the left", alignDisabled),
    alignOpt("center", icon("#i-align-center"), "Centre",
             alignTitle || "Centre the people in the band", alignDisabled),
    alignOpt("right",  icon("#i-align-right"),  "Right",
             alignTitle || "Push the people to the right", alignDisabled)
  ]);

  const last = i === documentState.state.tiers.length - 1;
  return el("div", {}, [

    el("span", {cls:"style-menu-group-title", text:"Label"}),
    el("label", {cls:"gf"}, [
      el("span", {text:"Code"}),
      el("input", {type:"text", tact:"code", did:t.id, value:t.code, maxLength:LIMITS.text,
                   title:"Short code shown on the chart",
                   label:"Short code for " + name})
    ]),
    el("label", {cls:"gf"}, [
      el("span", {text:"Name"}),
      el("input", {type:"text", tact:"label", did:t.id, value:t.label, maxLength:LIMITS.text,
                   title:"Grade name — shown in the roster, and the default role under its people",
                   label:"Name of grade " + name})
    ]),

    el("span", {cls:"style-menu-group-title", text:"Fill"}),
    fills,
    el("span", {cls:"style-menu-group-title", text:"People"}),
    aligns,
    el("hr"),

    el("div", {cls:"gopts"}, [
      el("button", {cls:"gopt", type:"button", tact:"attach", did:t.id, disabled:first,
                    title: first ? "The first grade has nothing " + (swim ? "before" : "above") + " it to attach to"
                                 : "Remove the gap " + gapPlace,
                    label: first ? "Attach to previous grade — unavailable for the first grade"
                                 : "Attach " + name + " to " + above + ", removing the gap " + gapSide
                                   + (t.merge ? ". Turning this off also stops sharing the " + surface : ""),
                    attrs:{"aria-pressed":String(!!t.attach)}},
        [icon("#i-link"), el("span", {text:"Attach to left"})]),
      el("button", {cls:"gopt", type:"button", tact:"merge", did:t.id, disabled:first,
                    title: first ? "The first grade has nothing " + (swim ? "before" : "above") + " it to share a " + surface + " with"
                                 : (t.attach ? "Show " + name + " in the same " + surface + " as " + above
                                             : "Show " + name + " in the same " + surface + " as " + above
                                               + " — this attaches it too"),
                    label: first ? "Share " + surface + " with previous grade — unavailable for the first grade"
                                 : "Show " + name + " in the same " + surface + " as " + above
                                   + (t.attach ? "" : ", which also attaches it"),
                    attrs:{"aria-pressed":String(!!t.merge)}},
        [icon("#i-share"), el("span", {text:"Share band"})])
    ]),
    el("hr"),

    el("div", {cls:"acts"}, [
      el("button", {cls:"ghost", tact:"up", did:t.id,
                    title: first ? "Already the first grade"
                                 : (swim ? "Move one lane left" : "Move towards the top of the chart"),
                    disabled:first,
                    label: swim ? "Move " + name + " one lane left"
                                : "Move " + name + " left, towards the top of the chart"},
        [icon("#i-left"), "Left"]),
      el("button", {cls:"ghost", tact:"down", did:t.id,
                    title: last ? "Already the last grade"
                                : (swim ? "Move one lane right" : "Move towards the bottom of the chart"),
                    disabled:last,
                    label: swim ? "Move " + name + " one lane right"
                                : "Move " + name + " right, towards the bottom of the chart"},
        [icon("#i-right"), "Right"]),
      el("button", {cls:"ghost danger", tact:"del", did:t.id, title:"Delete grade",
                    label:"Delete grade " + name}, [icon("#i-delete"), "Delete"])
    ])
  ]);
}

export { gradeChip, gradePanelBody };
