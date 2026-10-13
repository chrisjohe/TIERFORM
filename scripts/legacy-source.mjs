import fs from 'node:fs/promises';
import path from 'node:path';

// Existing suites isolate functions with hand-built dependency stubs. This adapter
// removes only module wiring; module and browser tests exercise the real wiring.
export async function writeLegacySource(){
  const entries=await fs.readdir('src',{recursive:true});
  const files=entries.filter(n=>n.endsWith('.js')).sort();
  let source=(await Promise.all(files.map(n=>fs.readFile(path.join('src',n),'utf8')))).join('\n');
  source=source.replace(/^import .*;\n/gm,'').replace(/^export .*;\n/gm,'');
  const states=[];
  source=source.replace(/const (\w+State) = \{\n([\s\S]*?)\n\};/g,(_,name,properties)=>{
    states.push(name);
    return properties.split(/,\n/).map(p=>p.trim().replace(/^(\w+): /,'let $1 = ')+';').join('\n');
  });
  for(const name of states)source=source.replace(new RegExp('\\b'+name+'\\.(\\w+)','g'),'$1');
  source=source.replace(/\b(state|history|hIndex|historyPending|docName|dirtyDoc): \1\b/g,'$1');
  source=source.replace(/historyEvents\.changed\(\)/g,'updateHistoryButtons()')
    .replace(/historyEvents\.render\("all"\)/g,'renderAll()')
    .replace(/historyEvents\.render\(/g,'render(')
    .replace(/historyEvents\.message\(/g,'toast(')
    .replace(/documentChanged\(\)/g,'updateDocLabel()');
  await fs.mkdir('_test',{recursive:true});
  await fs.writeFile('_test/source.js',source);
}
