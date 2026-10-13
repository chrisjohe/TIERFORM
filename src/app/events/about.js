import { VERSION } from "../../model/settings.js";
import { $ } from "../../ui/dom.js";

function bindAboutEvents(){
$(".about-version").textContent = "Version " + VERSION;
}

export { bindAboutEvents };
