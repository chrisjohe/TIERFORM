import { renderAll } from "../render.js";
import { fontsReady } from "../../render/fonts.js";
import { applyClipboardSupport } from "../../ui/clipboard.js";
import { rosterToggleMQ, selectTab, syncRosterToggle } from "../../ui/ribbon.js";

function bindBootEvents(){
fontsReady.then(()=>{
  renderAll();
  applyClipboardSupport();

  selectTab("file", false);

  if(rosterToggleMQ.matches) document.body.classList.add("roster-hidden");
  syncRosterToggle();
});
}

export { bindBootEvents };
