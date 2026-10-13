import { alertMsg, toast } from "../ui/notifications.js";

const exportsState = {
  exportBusy: false
};

function exportWrap(cmd, fn){
  if(exportsState.exportBusy) return;
  exportsState.exportBusy = true;
  const els = [...document.querySelectorAll('[data-cmd="'+cmd+'"]')];
  const was = els.map(el => el.disabled);
  els.forEach(el => { el.disabled = true; });
  Promise.resolve()
    .then(fn)
    .then(msg => { if(msg) toast(msg); })
    .catch(e => {
      alertMsg("That export did not finish — " + ((e && e.message) || "unknown error"));
    })
    .finally(() => {
      exportsState.exportBusy = false;
      els.forEach((el, i) => { el.disabled = was[i]; });
    });
}

function canCopyImage(){
  return typeof ClipboardItem !== "undefined"
      && !!(navigator.clipboard && navigator.clipboard.write);
}

export { exportsState, exportWrap, canCopyImage };
