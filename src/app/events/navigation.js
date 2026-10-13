import { addPhotoIntoDialog } from "../add-person.js";
import { addFiles, photolessMatch } from "../photo-actions.js";
import { nameFromFile } from "../../io/filenames.js";
import { LIMITS } from "../../model/settings.js";
import { clampText } from "../../model/validation.js";
import { openAddModal } from "../../ui/add-dialog.js";
import { $ } from "../../ui/dom.js";
import { placeGradePanel } from "../../ui/grade-popover.js";
import { closeInfoModal } from "../../ui/info-dialog.js";
import { closeMenu } from "../../ui/menus.js";
import { placePersonMenu } from "../../ui/person-menu.js";
import { selectTab, syncRibbonOverflow } from "../../ui/ribbon.js";
import { placeTour } from "../../ui/tour.js";

function bindNavigationEvents(){
addEventListener("resize", ()=>{
  syncRibbonOverflow(); closeMenu(); placeGradePanel(); placePersonMenu(); placeTour();
});

document.addEventListener("scroll", ()=>{
  closeMenu(); placeGradePanel(); placePersonMenu(); placeTour();
}, true);

document.querySelectorAll(".rb-tab").forEach(b=>{
  b.addEventListener("click", ()=>selectTab(b.dataset.tab));
});

$(".rb-tabs").addEventListener("keydown", e=>{
  const tabs = [...document.querySelectorAll(".rb-tab")];
  const at = tabs.indexOf(document.activeElement);
  if(at < 0) return;
  let to = -1;
  if(e.key === "ArrowRight") to = (at + 1) % tabs.length;
  if(e.key === "ArrowLeft")  to = (at - 1 + tabs.length) % tabs.length;
  if(e.key === "Home") to = 0;
  if(e.key === "End")  to = tabs.length - 1;
  if(to < 0) return;
  e.preventDefault();
  selectTab(tabs[to].dataset.tab, true);
});

$("#drop").addEventListener("click", ()=>openAddModal());

[$("#drop"), $("#dropZone")].forEach(zone=>{
  ["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev, e=>{
    e.preventDefault(); zone.classList.add("hot");
  }));

  zone.addEventListener("dragleave", e=>{
    if(!zone.contains(e.relatedTarget)) zone.classList.remove("hot");
  });
  zone.addEventListener("drop", e=>{
    e.preventDefault();
    zone.classList.remove("hot");
    if(!(e.dataTransfer && e.dataTransfer.files)) return;
    const files = [...e.dataTransfer.files];

    const solo = files.length === 1 ? files[0] : null;
    const soloImg = solo && (solo.type === "image/jpeg" || solo.type === "image/png");
    if(soloImg && !photolessMatch(clampText(nameFromFile(solo.name), LIMITS.text))){
      openAddModal();

      return addPhotoIntoDialog(solo);
    }
    return addFiles(files);
  });
});

$("#infoCloseBtn").addEventListener("click", closeInfoModal);
}

export { bindNavigationEvents };
