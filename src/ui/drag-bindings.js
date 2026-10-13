import { reorderGroupRow } from "../app/group-actions.js";
import { reorderPerson } from "../app/person-actions.js";
import { makeDragSurface } from "./drag-surface.js";
import { closePersonMenu } from "./person-menu.js";
import { rosterFiltered } from "./roster.js";

const rowDragSurface = makeDragSurface({
  root: "#roster",
  itemSelector: ".p-row",
  slotClass: "p-drop-slot",
  axis: "y",
  excludePress: ".p-menu",

  allowed: ()=> !rosterFiltered(),

  resolveAim(node){
    if(!node || !node.closest) return null;
    const row = node.closest(".p-row");
    if(row) return {item:row, after:null};
    const head = node.closest(".th");
    if(!head || !head.parentNode) return null;
    const rows = head.parentNode.querySelectorAll(".p-row:not(.dragging)");
    return rows.length ? {item:rows[rows.length-1], after:true} : null;
  },
  onBegin: closePersonMenu,
  onDrop: reorderPerson
});

const groupDragSurface = makeDragSurface({
  root: "#groupList",
  itemSelector: ".grp-row",
  slotClass: "p-drop-slot",
  axis: "y",
  excludePress: "button",
  resolveAim(node){
    if(!node || !node.closest) return null;
    const row = node.closest(".grp-row");
    return row ? {item:row, after:null} : null;
  },
  onBegin(){},
  onDrop: reorderGroupRow
});

export { rowDragSurface, groupDragSurface };
