import { documentState } from "../model/document.js";
import { syncAddAvailability } from "./add-dialog.js";
import { $ } from "./dom.js";

function setCommandDisabled(cmd, disabled, reason){
  if(!document.querySelectorAll) return;
  for(const button of document.querySelectorAll('[data-cmd="'+cmd+'"]')){
    if(!Object.prototype.hasOwnProperty.call(button.dataset, "enabledTitle"))
      button.dataset.enabledTitle = button.title || "";
    button.disabled = disabled;
    button.title = disabled ? reason : button.dataset.enabledTitle;
  }
}

function syncStructureAvailability(){
  const hasPeople = documentState.state.people.length > 0;
  const noGrades = documentState.state.tiers.length === 0;
  const occupied = "Remove all people before replacing the complete grade structure";

  if(document.querySelectorAll){
    for(const item of document.querySelectorAll("#templatesMenu [data-tpl]")){
      if(!Object.prototype.hasOwnProperty.call(item.dataset, "enabledTitle"))
        item.dataset.enabledTitle = item.title || "";
      item.disabled = hasPeople;
      item.title = hasPeople ? occupied : item.dataset.enabledTitle;
    }
    const note = $("#templatesNote");
    if(note) note.hidden = !hasPeople;
  }
  setCommandDisabled("clearGrades", hasPeople || noGrades,
    hasPeople ? occupied : "There are no grades to clear");

  setCommandDisabled("clearRoster", !hasPeople, "There is nobody in the roster");
  syncAddAvailability();

}

export { setCommandDisabled, syncStructureAvailability };
