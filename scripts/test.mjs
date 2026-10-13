import {spawnSync} from 'node:child_process';
for(const file of ['harness.js','dom.js','document.js','fixtures.js','import.js','modules.mjs','artifacts.mjs']){
  const run=spawnSync(process.execPath,['test/'+file],{encoding:'utf8'});
  process.stdout.write(run.stdout);process.stderr.write(run.stderr);
  if(run.status!==0 || /FAILURES|\d+ FAILED/.test(run.stdout)){process.exitCode=1;break;}
}
