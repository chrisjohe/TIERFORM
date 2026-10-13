import { $ } from "./dom.js";

const modalState = {
  modalReturn: null
};

function focusables(root){
  return [...root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
    + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

function modalOpen(id, focusEl){
  modalState.modalReturn = document.activeElement;
  $(id).hidden = false;
  const shell = $("#shell");
  shell.setAttribute("aria-hidden", "true");
  if("inert" in shell) shell.inert = true;
  const target = focusEl || focusables($(id))[0];

  if(target) target.focus({preventScroll:true});
}

function modalClose(id){
  if($(id).hidden) return;
  $(id).hidden = true;
  const shell = $("#shell");
  shell.removeAttribute("aria-hidden");
  if("inert" in shell) shell.inert = false;

  if(modalState.modalReturn && document.contains(modalState.modalReturn)) modalState.modalReturn.focus();
  modalState.modalReturn = null;
}

function trapTab(id){
  $(id).addEventListener("keydown", e=>{
    if(e.key !== "Tab") return;
    const els = focusables($(id));
    if(!els.length) return;
    const first = els[0], last = els[els.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}

export { modalState, focusables, modalOpen, modalClose, trapTab };
