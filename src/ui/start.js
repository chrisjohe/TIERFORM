import { TEMPLATES } from "../model/entities.js";
import { LAYOUTS } from "../model/settings.js";
import { $, el, icon } from "./dom.js";
import { layoutIcon } from "./layout-icons.js";

function fillTemplatesMenu(){
  const menu = $("#templatesMenu");
  TEMPLATES.forEach(tpl=>{
    menu.appendChild(el("button", {
      attrs:{role:"menuitem", "data-tpl":tpl.id, style:"--swatch:" + tpl.accent}
    }, [
      el("span", {cls:"accent-dot", attrs:{"aria-hidden":"true"}}),
      layoutIcon(tpl.layout),
      tpl.name
    ]));
  });

  const note = el("span", {cls:"warn-chip",
    text:"Templates replace the whole grade structure, so they need an empty "
       + "roster — remove all people to apply one.",
    attrs:{id:"templatesNote", role:"status"}});
  note.hidden = true;
  menu.appendChild(note);
}

function startView(){
  const cards = TEMPLATES.map(tpl => {
    const cap = LAYOUTS[tpl.layout] || LAYOUTS.pyramid;
    const svgIcon = layoutIcon(tpl.layout);
    svgIcon.setAttribute("role", "img");
    svgIcon.setAttribute("aria-label", cap.label + " layout");
    return el("button", {cls:"start-card",
        attrs:{"data-tpl":tpl.id, style:"--swatch:" + tpl.accent}}, [
      el("span", {cls:"start-card-top"}, [
        el("span", {cls:"accent-dot", attrs:{"aria-hidden":"true"}}),
        svgIcon
      ]),
      el("span", {cls:"start-card-name", text:tpl.name}),
      el("span", {cls:"start-card-desc",
        text: cap.label + " · " + tpl.grades().length + " grades"})
    ]);
  });
  cards.push(el("button", {cls:"start-card start-card-open", attrs:{"data-cmd":"open"}}, [
    icon("#i-open"),
    el("span", {cls:"start-card-name", text:"Open…"}),
    el("span", {cls:"start-card-desc", text:"Continue from a roster file"})
  ]));
  return el("div", {cls:"sheet-empty"}, [
    el("h2", {cls:"start-heading", text:"Start your chart"}),
    el("p", {cls:"start-lead",
      text:"Open a roster file, or begin with a template."}),
    el("div", {cls:"start-cards"}, cards),
    el("div", {cls:"start-foot"}, [
      el("button", {cls:"start-foot-btn start-foot-tour primary",
        title:"A short guided tour on a sample roster. Your document is set aside and comes back untouched.",
        attrs:{"data-cmd":"tour"}}, [icon("#i-animated-images"), "Tour"]),
      el("span", {text:"Everything processed offline on your device · nothing uploaded"}),
      el("button", {cls:"start-foot-btn",
        title:"Where your data lives, and how to handle roster files",
        attrs:{"data-cmd":"infoPrivacy"}}, [icon("#i-privacy"), "Privacy"])
    ])
  ]);
}

export { fillTemplatesMenu, startView };
