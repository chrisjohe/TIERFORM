import { closeAddModal } from "../../ui/add-dialog.js";
import { askClose } from "../../ui/ask-dialog.js";
import { $ } from "../../ui/dom.js";
import { closeEditModal } from "../../ui/edit-dialog.js";
import { closeGroupModal } from "../../ui/group-dialog.js";
import { importClose } from "../../ui/import-dialog.js";
import { closeInfoModal } from "../../ui/info-dialog.js";
import { trapTab } from "../../ui/modal.js";
import { closePasteModal } from "../../ui/paste-dialog.js";

function bindModalsEvents(){
trapTab("#pasteModal");

trapTab("#askModal");

trapTab("#infoModal");

trapTab("#addModal");

trapTab("#importModal");

trapTab("#editModal");

trapTab("#groupModal");

trapTab("#tourCard");

for(const [id, close] of [
  ["#askModal",    ()=>askClose(null)],
  ["#importModal", ()=>importClose(null)],
  ["#addModal",    ()=>closeAddModal()],
  ["#editModal",   ()=>closeEditModal()],
  ["#pasteModal",  ()=>closePasteModal()],
  ["#infoModal",   ()=>closeInfoModal()],
  ["#groupModal",  ()=>closeGroupModal()],
]) $(id).querySelector(".modal-x").addEventListener("click", close);
}

export { bindModalsEvents };
