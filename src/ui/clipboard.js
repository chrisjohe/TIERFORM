import { canCopyImage } from "../app/exports.js";

function applyClipboardSupport(){
  if(canCopyImage()) return;
  for(const el of document.querySelectorAll('[data-cmd="copyPng"]')){
    el.disabled = true;
    el.title = "Copying to the clipboard is not available in this browser when the "
             + "page is opened from a file — use Export ▸ Export PNG instead";
  }
}

export { applyClipboardSupport };
