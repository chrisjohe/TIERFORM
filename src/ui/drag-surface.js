import { $, el } from "./dom.js";

function makeDragSurface(cfg){
  const root = $(cfg.root);
  const sizeProp = cfg.axis === "x" ? "width" : "height";
  function coordOf(e){ return cfg.axis === "x" ? e.clientX : e.clientY; }
  let dragId = null;
  let dragSize = 0;
  let drop = null;
  let pointer = null;
  let suppressClick = false;
  function itemFor(id){
    return root.querySelector(cfg.itemSelector + '[data-id="' + id + '"]');
  }

  function begin(item){
    dragId = item.dataset.id;
    dragSize = cfg.axis === "x" ? item.getBoundingClientRect().width
                                 : item.getBoundingClientRect().height;
    drop = null;
    cfg.onBegin();
  }

  function dropSlot(){
    const slot = root.querySelector("." + cfg.slotClass)
              || el("div", {cls:cfg.slotClass, attrs:{"aria-hidden":"true"}});
    slot.style[sizeProp] = dragSize + "px";
    return slot;
  }
  function hideDragItem(){
    const item = dragId && itemFor(dragId);
    if(item) item.classList.add("dragging");
  }
  function clearDropMarkers(){
    const slot = root.querySelector("." + cfg.slotClass);
    if(slot) slot.remove();
    root.querySelectorAll(".dragging").forEach(item=>item.classList.remove("dragging"));
  }
  function clearDrag(){

    dragId = null;
    dragSize = 0;
    drop = null;
    clearDropMarkers();
  }

  function overSlot(client){
    const slot = root.querySelector("." + cfg.slotClass);
    if(!slot) return false;
    const r = slot.getBoundingClientRect();
    return cfg.axis === "x" ? (client >= r.left && client <= r.right)
                             : (client >= r.top  && client <= r.bottom);
  }
  function markDrop(node, client){
    const aim = cfg.resolveAim(node);
    if(!aim || aim.item.dataset.id === dragId){
      if(drop && overSlot(client)) return;
      clearDropMarkers();
      drop = null;
      return;
    }

    const r = aim.item.getBoundingClientRect();
    const after = aim.after === null
      ? (cfg.axis === "x" ? client >= r.left + r.width/2 : client >= r.top + r.height/2)
      : aim.after;
    drop = {id:aim.item.dataset.id, after};

    hideDragItem();
    aim.item.parentNode.insertBefore(dropSlot(), after ? aim.item.nextSibling : aim.item);
  }
  root.addEventListener("dragstart", e=>{

    if(pointer && pointer.dragging){ e.preventDefault(); return; }
    const item = e.target.closest(cfg.itemSelector);
    if(!item) return;

    if(cfg.allowed && !cfg.allowed()) return;
    begin(item);

    setTimeout(hideDragItem, 0);
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
    }
  });
  root.addEventListener("dragover", e=>{

    if(!dragId) return;
    markDrop(e.target, coordOf(e));

    e.preventDefault();
    if(e.dataTransfer) e.dataTransfer.dropEffect = "move";
  });
  root.addEventListener("dragleave", e=>{
    if(!root.contains(e.relatedTarget)){
      clearDropMarkers();
      drop = null;
    }
  });
  root.addEventListener("drop", e=>{
    if(!dragId || !drop) return;
    e.preventDefault();
    const sourceId = dragId, target = drop;
    clearDrag();
    cfg.onDrop(sourceId, target.id, target.after);
  });

  root.addEventListener("dragend", ()=>{
    pointer = null;
    clearDrag();
  });

  root.addEventListener("pointerdown", e=>{
    if(e.button !== 0 || e.pointerType === "touch") return;

    if(e.target.closest(cfg.excludePress)) return;
    const item = e.target.closest(cfg.itemSelector);
    if(!item) return;
    if(cfg.allowed && !cfg.allowed()) return;
    pointer = {id:item.dataset.id, x:e.clientX, y:e.clientY,
               pointerId:e.pointerId, item, dragging:false};
  });
  root.addEventListener("pointermove", e=>{
    if(!pointer || e.pointerId !== pointer.pointerId) return;

    if(dragId && !pointer.dragging) return;

    if(!e.buttons){ finish(e, true); return; }
    if(!pointer.dragging){
      if(Math.hypot(e.clientX-pointer.x, e.clientY-pointer.y) < 6) return;
      pointer.dragging = true;
      begin(pointer.item);

      if(root.setPointerCapture) root.setPointerCapture(e.pointerId);
      hideDragItem();
    }
    e.preventDefault();
    markDrop(document.elementFromPoint(e.clientX, e.clientY), coordOf(e));
  });
  function finish(e, cancelled){
    if(!pointer || e.pointerId !== pointer.pointerId) return;

    if(dragId && !pointer.dragging){ pointer = null; return; }
    const wasDragging = pointer.dragging;
    const sourceId = pointer.id, target = drop;
    pointer = null;
    clearDrag();
    if(cancelled || !wasDragging || !target) return;
    e.preventDefault();
    suppressClick = true;
    setTimeout(()=>{ suppressClick = false; }, 0);
    cfg.onDrop(sourceId, target.id, target.after);
  }
  root.addEventListener("pointerup", e=>finish(e, false));
  root.addEventListener("pointercancel", e=>finish(e, true));
  return {

    clickSuppressed(){ const s = suppressClick; suppressClick = false; return s; },
    dragId(){ return dragId; },
    dragSize(){ return dragSize; },
    pendingDrop(){ return drop; },
    pointerDragging(){ return !!(pointer && pointer.dragging); },
    hasPointer(){ return !!pointer; }
  };
}

export { makeDragSurface };
