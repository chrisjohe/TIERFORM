

function xmlText(s){
  return String(s == null ? "" : s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlAttr(s){
  return xmlText(s).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export { xmlText, xmlAttr };
