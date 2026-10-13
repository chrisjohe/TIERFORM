import { LIMITS } from "../../model/settings.js";
import { clampText } from "../../model/validation.js";
import { $ } from "../../ui/dom.js";
import { importClose } from "../../ui/import-dialog.js";
import { firstTierId } from "../../ui/options.js";

function bindImportEvents(){
$("#importConfirmBtn").addEventListener("click", ()=>importClose({
  tierId: $("#importTier").value || firstTierId(),
  groupText: clampText($("#importGroup").value.trim(), LIMITS.text)
}));

$("#importCancelBtn").addEventListener("click", ()=>importClose(null));
}

export { bindImportEvents };
