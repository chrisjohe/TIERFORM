import { $ } from "./dom.js";
import { modalClose, modalOpen } from "./modal.js";

const INFO_DOCS = {
  privacy: {title:"Privacy",     doc:"#infoPrivacyDoc"},
  tips:    {title:"Tips",        doc:"#infoTipsDoc"},
  bug:     {title:"Bug report",  doc:"#infoBugDoc"},
  apps:    {title:"The FORM apps", doc:"#infoAppsDoc"},
  about:   {title:"About", doc:"#infoAboutDoc"}
};

function openInfo(name){
  const want = INFO_DOCS[name];
  if(!want) return;
  $("#infoTitle").textContent = want.title;
  for(const key of Object.keys(INFO_DOCS)) $(INFO_DOCS[key].doc).hidden = (key !== name);
  const box = $("#infoModal").firstElementChild;
  if(box) box.classList.toggle("about-open", name === "about");
  modalOpen("#infoModal", $("#infoCloseBtn"));

  if(box) box.scrollTop = 0;
}

function closeInfoModal(){ modalClose("#infoModal"); }

export { INFO_DOCS, openInfo, closeInfoModal };
