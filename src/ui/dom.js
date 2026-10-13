

const $ = s => document.querySelector(s);

const SVGNS = "http://www.w3.org/2000/svg";

function el(tag, o, kids){
  const n = document.createElement(tag);
  if(o){
    if(o.cls)  n.className = o.cls;
    if(o.type) n.type = o.type;
    if(o.text != null)  n.textContent = o.text;
    if(o.value != null) n.value = o.value;
    if(o.maxLength != null) n.maxLength = o.maxLength;
    if(o.placeholder != null) n.placeholder = o.placeholder;
    if(o.title)    n.title = o.title;
    if(o.disabled) n.disabled = true;
    if(o.draggable) n.draggable = true;

    if(o.act)  n.dataset.act  = o.act;
    if(o.tact) n.dataset.tact = o.tact;
    if(o.fact) n.dataset.fact = o.fact;
    if(o.did)  n.dataset.id   = o.did;

    if(o.label) n.setAttribute("aria-label", o.label);
    if(o.attrs) for(const k in o.attrs) n.setAttribute(k, o.attrs[k]);
  }
  if(kids) for(const k of kids){
    if(k == null || k === false) continue;
    n.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  }
  return n;
}

function icon(href){
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "ic");
  const use = document.createElementNS(SVGNS, "use");
  use.setAttribute("href", href);
  svg.appendChild(use);
  return svg;
}

function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }

function fill(node, kids){
  clear(node);
  for(const k of kids){ if(k) node.appendChild(k); }
  return node;
}

export { $, SVGNS, el, icon, clear, fill };
