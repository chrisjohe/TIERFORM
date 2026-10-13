import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'tierform-parity-mutations-'));
const mutations=[
['src/engine/constants.js','margin:34','margin:35','geometry or SVG changed from frozen TIERFORM 2026.8b'],
['src/engine/constants.js','margin:34','margin:NaN','must have finite geometry'],
['src/engine/index.js','function computeLayout(st){','function computeLayout(st){ st.title = "MUTATED";','must preserve input'],
['test/fixtures/current.json','"title":','"mutation": 1, "title":','parity fixture differs from the frozen original'],
['src/render/svg.js',"width=\"'+PW+'pt\"","width=\"'+PW+'px\"",'geometry or SVG changed from frozen TIERFORM 2026.8b']
];
try{
  for(const name of ['src','test/reference','test/fixtures'])await fs.cp(name,path.join(scratch,name),{recursive:true});
  await fs.copyFile('test/engine-parity.mjs',path.join(scratch,'test/engine-parity.mjs'));
  for(const [relative,from,to,message] of mutations){
    const filename=path.join(scratch,relative),original=await fs.readFile(filename,'utf8');
    const changed=original.replace(from,to);if(changed===original)throw new Error('Mutation did not apply: '+relative);
    try{
      await fs.writeFile(filename,changed);
      const run=spawnSync(process.execPath,['test/engine-parity.mjs'],{cwd:scratch,encoding:'utf8'}),output=run.stdout+run.stderr;
      if(run.status===0||!output.includes('AssertionError')||!output.includes(message)){process.stdout.write(output);throw new Error('Parity mutation did not fail its assertion: '+relative);}
      console.log('RED: '+relative+' — '+message);
    }finally{await fs.writeFile(filename,original);}
  }
  console.log('5/5 frozen-baseline mutations caught by assertions; repository source untouched');
}finally{await fs.rm(scratch,{recursive:true,force:true});}
