import { groupLabel } from "../model/entities.js";

function toCSV(st){
  function csvField(v){
    const s = String(v==null ? "" : v);
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }
  const rows = [["Name","Grade","Group","Role"]];
  for(const p of st.people){
    const t = st.tiers.find(t => t.id === p.tierId);
    const grade = t ? (t.code || t.label) : "";
    rows.push([p.name, grade, groupLabel(st, p), p.role]);
  }
  return rows.map(r => r.map(csvField).join(";")).join("\r\n");
}

function splitCsvLine(line, sep){
  sep = sep || ",";
  const out = [];
  let field = "", quoted = false, i = 0;
  while(i < line.length){
    const ch = line[i];
    if(quoted){
      if(ch === '"'){
        if(line[i+1] === '"'){ field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if(ch === '"' && field.trim() === ""){ quoted = true; field = ""; i++; continue; }
    if(ch === sep){ out.push(field); field = ""; i++; continue; }
    field += ch; i++;
  }
  out.push(field);
  return out;
}

function splitPasteRow(line){
  if(line.indexOf("\t")>=0) return line.split("\t");
  if(line.indexOf(";")>=0) return splitCsvLine(line, ";");
  return splitCsvLine(line);
}

export { toCSV, splitCsvLine, splitPasteRow };
