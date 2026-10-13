import { applyTemplate } from "../templates.js";
import { $ } from "../../ui/dom.js";

function bindRosterEvents(){
$("#sheet").addEventListener("click", e=>{
  const card = e.target.closest("[data-tpl]");
  if(!card) return;
  applyTemplate(card.dataset.tpl);
});
}

export { bindRosterEvents };
