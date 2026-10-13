import { icon } from "./dom.js";

function layoutIcon(id){
  switch(id){
    case "pyramid":   return icon("#i-pyramid");
    case "tornado":   return icon("#i-tornado");
    case "histogram": return icon("#i-histogram");
    case "swimlanes": return icon("#i-swimlanes");
    case "hive":      return icon("#i-hive");
    case "matrix":    return icon("#i-matrix");
    default:          return icon("#i-pyramid");
  }
}

export { layoutIcon };
