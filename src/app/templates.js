import { documentState, newGeneration } from "../model/document.js";
import { TEMPLATES } from "../model/entities.js";
import { commit } from "../model/history.js";
import { askConfirm } from "../ui/ask-dialog.js";
import { alertMsg, toast } from "../ui/notifications.js";

async function applyTemplate(id){
  const tpl = TEMPLATES.find(t => t.id === id);
  if(!tpl) return;
  if(documentState.state.people.length){
    alertMsg("Remove all people before replacing the complete grade structure");
    return;
  }
  const gen = documentState.docGen;
  if(documentState.state.tiers.length){
    const yes = await askConfirm("Apply the " + tpl.name + " template?",
      ["This replaces the current grade structure with the " + tpl.name
        + " template, and sets the layout, colours and name label position it uses.",
       "You can undo this change."],
      "Apply template");
    if(!yes) return;
    if(gen !== documentState.docGen){
      alertMsg("The template was not applied — the document changed while the question was open");
      return;
    }
    if(documentState.state.people.length){
      alertMsg("The template was not applied — remove all people first");
      return;
    }
  }

  newGeneration();
  commit("applied the " + tpl.name + " template", ()=>{
    documentState.state.tiers = tpl.grades();
    documentState.state.layout = tpl.layout;
    documentState.state.accent = tpl.accent;
    documentState.state.inkOnColour = tpl.ink;
    documentState.state.nameLabelPosition = tpl.nameLabelPosition;
  }, {render:"all"});
  toast(tpl.name + " template applied");
}

export { applyTemplate };
