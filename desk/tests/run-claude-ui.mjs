// Sequential synthetic Electron regressions; each harness owns a temp runtime.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const test of ['claude-ui-smoke.mjs','claude-controls-ui.mjs','claude-lifecycle-ui.mjs','claude-host-recovery.mjs']){
 console.log(`Claude Electron: ${test}`);
 const result=spawnSync(process.execPath,[fileURLToPath(new URL(test,import.meta.url))],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0){process.exitCode=result.status||1;break;}
}
