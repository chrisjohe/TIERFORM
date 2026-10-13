import { $ } from "../../ui/dom.js";
import { endTour, tourGoto, tourState } from "../../ui/tour.js";

function bindTourEvents(){
$("#tourBack").addEventListener("click", ()=>{ if(tourState.tourStep > 0) tourGoto(tourState.tourStep - 1); });

$("#tourNext").addEventListener("click", ()=>{
  if(tourState.tourStep + 1 < tourState.tourCount) tourGoto(tourState.tourStep + 1); else endTour();
});

$("#tourX").addEventListener("click", ()=>{ endTour(); });
}

export { bindTourEvents };
