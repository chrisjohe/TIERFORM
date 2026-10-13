import { $ } from "./dom.js";

function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("on");
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("on"),2200);
}

function alertMsg(msg){
  toast(msg);
  const el = $("#alerts");
  if(!el) return;
  el.textContent = "";
  setTimeout(()=>{ el.textContent = msg; }, 60);
  clearTimeout(el._t); el._t = setTimeout(()=>{ el.textContent = ""; }, 6000);
}

export { toast, alertMsg };
