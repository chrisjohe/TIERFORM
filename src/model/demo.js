import { defaults } from "./defaults.js";
import { TEMPLATES, newGroup, normalizeGradeLinks, uid } from "./entities.js";

function demoDoc(){
  const tpl = TEMPLATES.find(t => t.id === "big4-green");

  const tiers = tpl.grades().filter(t => t.code !== "A" && t.code !== "JS");
  const assistant = tiers.find(t => t.code === "AS");
  assistant.code = "A";

  assistant.align = "center";
  tiers.find(t => t.code === "M").merge = true;
  tiers.find(t => t.code === "C").merge = true;
  normalizeGradeLinks(tiers);

  const groups = [newGroup("Litigation"), newGroup("Corporate"), newGroup("Operations")];
  const tierByCode  = code => tiers.find(t => t.code === code).id;
  const groupByName = name => groups.find(g => g.label === name).id;
  const person = (name, code, groupName, role) => ({
    id:uid(), name:name, tierId:tierByCode(code), groupId:groupByName(groupName),
    role:role || "", photo:null, pw:0, ph:0, frame:null
  });

  const people = [
    person("Jessica Pearson",   "P",  "Corporate",  "Managing Partner"),
    person("Harvey Specter",    "P",  "Litigation"),
    person("Louis Litt",        "P",  "Corporate"),
    person("Donna Paulsen",     "A",  "Operations"),
    person("Gretchen Bodinski", "A",  "Operations"),
    person("Samantha Wheeler",  "D",  "Litigation"),
    person("Alex Williams",     "D",  "Corporate"),
    person("Katrina Bennett",   "SM", "Corporate"),
    person("Mike Ross",         "M",  "Litigation"),
    person("Rachel Zane",       "SC", "Corporate"),
    person("Harold Gunderson",  "C",  "Litigation"),
    person("Brian Altman",      "C",  "Corporate")
  ];

  return Object.assign(defaults(), {
    title:"Pearson Specter Litt",
    groupsLabel:"Practice",
    layout:tpl.layout,
    accent:tpl.accent,
    inkOnColour:tpl.ink,
    nameLabelPosition:tpl.nameLabelPosition,
    tiers:tiers,
    groups:groups,
    people:people
  });
}

export { demoDoc };
