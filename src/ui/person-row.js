import { moveTarget } from "../app/person-actions.js";
import { gradeName, initials } from "../model/labels.js";
import { validatePhoto } from "../model/validation.js";
import { el, icon } from "./dom.js";
import { rosterFiltered } from "./roster.js";

function moveAffordance(p, dir, who){
  const word = dir < 0 ? "up" : "down";

  if(rosterFiltered()){
    return {disabled:true,
            title:"Not available while searching — clear the search to reorder",
            label:"Move " + who + " " + word};
  }
  const want = moveTarget(p.id, dir);
  if(want && want.kind === "grade"){
    const dest = gradeName(want.tier);
    return {disabled:false,
            title:"Move " + word + " — to " + dest,
            label:"Move " + who + " " + word + ", to " + dest};
  }
  return {disabled: !want, title:"Move " + word, label:"Move " + who + " " + word};
}

function personLabel(p){ return (p.name && p.name.trim()) || "the unnamed person"; }

function personRowName(p){ return (p.name && p.name.trim()) || "Unnamed"; }

function firstName(p, fallback){ return (p && p.name) ? p.name.split(" ")[0] : fallback; }

function personRow(p){
  const src  = p.photo ? validatePhoto(p.photo) : null;
  const who  = personLabel(p);

  const thumb = el("span", {cls:"thumb", did:p.id, draggable:true,
                            attrs:{"aria-hidden":"true"}});
  if(src){
    const im = el("img", {attrs:{alt:"", draggable:"false"}});
    im.src = src;
    thumb.appendChild(im);
  }else{
    thumb.textContent = initials(p.name);
  }

  return el("div", {cls:"p-row", did:p.id}, [
    thumb,
    el("span", {cls:"p-name" + (p.name && p.name.trim() ? "" : " none"), did:p.id,
                draggable:true, text:personRowName(p)}),

    el("button", {cls:"ghost p-menu", act:"menu", did:p.id, title:"Actions",
                  label:"Actions for " + who,
                  attrs:{"aria-haspopup":"menu", "aria-expanded":"false",
                         "aria-controls":"personMenu"}},
      [icon("#i-caret")])
  ]);
}

function personMenuBody(p){
  const who = personLabel(p);
  const upMove = moveAffordance(p, -1, who), downMove = moveAffordance(p, 1, who);
  return el("div", null, [
    el("button", {act:"edit", did:p.id, label:"Edit details for " + who,
                  attrs:{role:"menuitem"}}, [icon("#i-person-edit"), "Edit details"]),
    el("button", {act:"up", did:p.id, disabled:upMove.disabled,
                  title:upMove.title, label:upMove.label,
                  attrs:{role:"menuitem"}}, [icon("#i-up"), "Move up"]),
    el("button", {act:"down", did:p.id, disabled:downMove.disabled,
                  title:downMove.title, label:downMove.label,
                  attrs:{role:"menuitem"}}, [icon("#i-down"), "Move down"]),

    el("button", {cls:"danger", act:"del", did:p.id,
                  label:"Remove " + who + " from the roster",
                  attrs:{role:"menuitem"}}, [icon("#i-delete"), "Remove"])
  ]);
}

function syncRowIdentity(p){
  if(!document.querySelector) return;
  const who  = personLabel(p);
  const src  = p.photo ? validatePhoto(p.photo) : null;
  const mine = '[data-id="' + p.id + '"]';
  const one  = sel => document.querySelector(sel + mine);
  const act  = a => one('[data-act="'  + a + '"]');
  const fact = f => one('[data-fact="' + f + '"]');
  const put  = (n, text) => { if(n) n.setAttribute("aria-label", text); };

  const thumb = one(".thumb");
  if(thumb && !src) thumb.textContent = initials(p.name);
  const line = one(".p-name");
  if(line){
    line.textContent = personRowName(p);
    line.className = "p-name" + (p.name && p.name.trim() ? "" : " none");
  }
  put(act("menu"), "Actions for " + who);

  put(act("edit"), "Edit details for " + who);
  put(act("up"),   moveAffordance(p, -1, who).label);
  put(act("down"), moveAffordance(p,  1, who).label);
  put(act("del"),  "Remove " + who + " from the roster");

  put(act("photo"),    "Add a photo for " + who);
  put(fact("pan"),     "Position " + who + "'s photo — drag, or use the arrow keys to nudge it");
  put(fact("zoom"),    "Zoom on " + who + "'s photo");
  put(fact("reset"),   "Reset the framing of " + who + "'s photo");
  put(fact("replace"), "Replace " + who + "'s photo");
  put(fact("remove"),  "Remove " + who + "'s photo, leaving " + who + "'s initials");
}

export { moveAffordance, personLabel, personRowName, firstName, personRow, personMenuBody, syncRowIdentity };
