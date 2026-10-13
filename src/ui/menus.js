import { endEdit } from "../model/history.js";
import { syncFontAvailability } from "./design.js";
import { $ } from "./dom.js";
import { closePersonMenu } from "./person-menu.js";

const RIBBON_MENUS = [
  {menu:"#saveMenu",   btn:"#saveMenuBtn"},

  {menu:"#exportMenu", btn:"#exportMenuBtn", anchor:"#exportMenuBtn"},
  {menu:"#addMenu",    btn:"#addMenuBtn"},
  {menu:"#templatesMenu", btn:"#templatesBtn", anchor:"#templatesBtn"},
  {menu:"#layoutMenu",  btn:"#layoutBtn",  anchor:"#layoutBtn"},
  {menu:"#densityMenu", btn:"#densityBtn", anchor:"#densityBtn"},
  {menu:"#pageMenu",    btn:"#pageBtn",    anchor:"#pageBtn"},
  {menu:"#accentPop",   btn:"#accentBtn",  anchor:"#accentBtn"},
  {menu:"#bgMenu",      btn:"#bgBtn",      anchor:"#bgBtn"},
  {menu:"#ringMenu",    btn:"#ringBtn",    anchor:"#ringBtn"},
  {menu:"#nameLabelsMenu", btn:"#nameLabelsBtn", anchor:"#nameLabelsBtn"},
  {menu:"#headerPop",   btn:"#headerBtn",  anchor:"#headerBtn"},
  {menu:"#labelsPop",   btn:"#labelsBtn",  anchor:"#labelsBtn"},
  {menu:"#anglePop",    btn:"#angleBtn",   anchor:"#angleBtn"},
  {menu:"#textPop",     btn:"#textBtn",    anchor:"#textBtn"},
  {menu:"#fontMenu",    btn:"#fontBtn",    anchor:"#fontBtn"}
];

function menuOpen(){
  return RIBBON_MENUS.some(s => { const m = $(s.menu); return m && !m.hidden; });
}

function openMenu(id){
  const spec = RIBBON_MENUS.find(s => s.menu === id);
  if(!spec) return;
  closeMenu();
  closePersonMenu();
  const m = $(spec.menu), anchor = spec.anchor ? $(spec.anchor) : m.parentElement;

  if(id === "#fontMenu") syncFontAvailability();
  m.hidden = false;

  const r = anchor.getBoundingClientRect();
  m.style.top  = (r.bottom + 3) + "px";
  m.style.left = Math.max(6, Math.min(r.left, innerWidth - m.offsetWidth - 6)) + "px";
  $(spec.btn).setAttribute("aria-expanded", "true");

  const first = m.querySelector('button:not([disabled]),input:not([disabled])');
  if(first) first.focus();
}

function closeMenu(refocus){
  for(const spec of RIBBON_MENUS){
    const m = $(spec.menu);
    if(!m || m.hidden) continue;
    m.hidden = true;
    $(spec.btn).setAttribute("aria-expanded", "false");

    if(refocus) $(spec.btn).focus();
  }
  endEdit();
}

export { RIBBON_MENUS, menuOpen, openMenu, closeMenu };
