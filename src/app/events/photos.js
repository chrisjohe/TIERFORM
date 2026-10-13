import { processImage } from "../../io/photo-import.js";
import { documentState, staleWrite } from "../../model/document.js";
import { commit } from "../../model/history.js";
import { applyPhoto } from "../../model/photos.js";
import { LIMITS } from "../../model/settings.js";
import { photoBudgetExceeded } from "../../model/validation.js";
import { openAddModal } from "../../ui/add-dialog.js";
import { $ } from "../../ui/dom.js";
import { rowDragSurface } from "../../ui/drag-bindings.js";
import { openEditModal } from "../../ui/edit-dialog.js";
import { alertMsg } from "../../ui/notifications.js";
import { closePersonMenu, focusPersonMenuItem, openPersonMenu, personMenuState } from "../../ui/person-menu.js";
import { firstName } from "../../ui/person-row.js";
import { moveLabel, movePerson, removePerson } from "../person-actions.js";

const photosState = {
  swapId: null
};

function bindPhotosEvents(){
$("#roster").addEventListener("click", e=>{

  if(rowDragSurface.clickSuppressed()) return;
  const el=e.target.closest("[data-act]"); if(!el) return;
  const act=el.dataset.act, id=el.dataset.id;

  if(act==="addTo") openAddModal(id);
  if(act==="menu"){
    if(personMenuState.personOpen===id) closePersonMenu(true); else openPersonMenu(id);
  }
});

$("#personMenu").addEventListener("click", e=>{
  const el=e.target.closest("[data-act]"); if(!el || el.disabled) return;
  const act=el.dataset.act, id=el.dataset.id;
  if(act==="edit"){

    closePersonMenu(true);
    openEditModal(id);
  }
  if(act==="up"||act==="down"){
    const dir = act==="up"?-1:1;

    commit(moveLabel(id, dir), ()=>movePerson(id, dir));

    focusPersonMenuItem(act, id);
  }
  if(act==="del"){ closePersonMenu(); removePerson(id); }
});
$("#fileSwap").addEventListener("change", async e=>{
  const f=e.target.files[0]; e.target.value="";
  if(!f||!photosState.swapId) return;
  const p=documentState.state.people.find(x=>x.id===photosState.swapId); if(!p) return;
  const gen = documentState.docGen;
  try{
    const r = await processImage(f);

    const blocked = staleWrite(gen, {person: p});
    if(blocked){ alertMsg("That photo was not applied — " + blocked); return; }
    if(photoBudgetExceeded(documentState.state, r.data.length, p.photo ? p.photo.length : 0)){
      alertMsg("That photo was not applied — the roster's photos would exceed the "
        + Math.round(LIMITS.totalPhotoBytes/1024/1024) + " MB limit");
      return;
    }

    commit("replaced "+firstName(p,"the")+(p.name?"'s":"")+" photo",
      ()=>applyPhoto(p, r));
  }
  catch(err){ alertMsg("That photo could not be replaced — " + ((err && err.message) || "unreadable image")); }
});
}

export { photosState, bindPhotosEvents };
