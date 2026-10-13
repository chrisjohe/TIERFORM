import { LIMITS } from "../model/settings.js";
import { $, clear, el } from "./dom.js";
import { focusables, modalClose, modalOpen } from "./modal.js";

const askDialogState = {
  askResolve: null
};

function askClose(value){
  const done = askDialogState.askResolve;
  askDialogState.askResolve = null;
  modalClose("#askModal");
  if(done) done(value);
}

function ask(opts){

  if(askDialogState.askResolve) return Promise.resolve(null);
  $("#askTitle").textContent = opts.title || "";

  const body = $("#askBody");
  clear(body);
  for(const line of [].concat(opts.message || [])) body.appendChild(el("p", {text:line}));

  const fields = opts.fields
    || (opts.input !== undefined
        ? [{key:null, label:opts.inputLabel || opts.title || "Value", value:opts.input}]
        : []);
  const inputs = [];
  const answer = ()=>{
    if(!opts.fields) return inputs.length ? inputs[0].node.value : null;
    const out = {};
    for(const x of inputs) out[x.key] = x.node.value;
    return out;
  };
  for(const f of fields){
    const node = el("input", {type:"text", cls:"ask-input", value:f.value || "", maxLength:LIMITS.text,
                              placeholder:f.placeholder || "", label:f.label});
    inputs.push({key:f.key, node:node});
    body.appendChild(el("label", {cls:"ask-field"}, [
      el("span", {cls: opts.fields ? "ask-label" : "sr-only", text:f.label}), node
    ]));

    node.addEventListener("keydown", e=>{
      if(e.key === "Enter"){ e.preventDefault(); askClose(answer()); }
    });
  }
  const input = inputs.length ? inputs[0].node : null;

  const actions = $("#askActions");
  clear(actions);

  for(const a of opts.actions){
    actions.appendChild(el("button", {
      cls: a.cls || "", text: a.label,

      title: a.title || ""
    })).addEventListener("click", ()=>{
      askClose(a.value === undefined ? null : (input && a.takesInput ? answer() : a.value));
    });
  }

  const primaryAction = actions.querySelector("button.primary");

  const p = new Promise(res => { askDialogState.askResolve = res; });

  modalOpen("#askModal", input || primaryAction || focusables($("#askActions"))[0]);
  return p;
}

function askConfirm(title, message, confirmLabel, cls){
  return ask({title:title, message:message, actions:[
    {label:confirmLabel, value:true, cls:cls || "primary"},

    {label:"Cancel", value:false, cls: cls === "danger" ? "primary" : undefined}
  ]}).then(v => v === true);
}

function askText(title, message, value, inputLabel, confirmLabel){
  return ask({title:title, message:message, input:value, inputLabel:inputLabel, actions:[
    {label:confirmLabel || "OK", value:"", takesInput:true, cls:"primary"},
    {label:"Cancel", value:undefined}
  ]});
}

function askFields(title, message, fields, confirmLabel){
  return ask({title:title, message:message, fields:fields, actions:[
    {label:confirmLabel || "Add", value:"", takesInput:true, cls:"primary"},
    {label:"Cancel", value:undefined}
  ]});
}

function bindAskDialog(){
$("#askModal").addEventListener("click", e=>{ if(e.target.id==="askModal") askClose(null); });
}

export { askDialogState, askClose, ask, askConfirm, askText, askFields, bindAskDialog };
