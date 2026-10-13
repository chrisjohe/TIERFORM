

function placePopover(pop, anchor){
  const r = anchor.getBoundingClientRect(), h = pop.offsetHeight;
  pop.style.top  = (r.bottom + 4 + h <= innerHeight - 6 || r.top - 4 - h < 6)
    ? (r.bottom + 4) + "px" : (r.top - 4 - h) + "px";
  pop.style.left = Math.max(6, Math.min(r.left, innerWidth - pop.offsetWidth - 6)) + "px";
}

export { placePopover };
