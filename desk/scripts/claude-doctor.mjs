import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {inspectClaude}=require('../src/agents/claude-environment.cjs');
const {userDataDirectory}=require('../user-data.cjs');
let configuredPath=process.env.LEARNING_DESK_CLAUDE||'';
const configDir=userDataDirectory();
try{configuredPath||=JSON.parse(fs.readFileSync(path.join(configDir,'config.json'),'utf8')).claudePath||'';}catch{}
const result=await inspectClaude({configuredPath});
// Deliberately show only installation/auth diagnostics, never personal fields.
console.log(JSON.stringify(result,null,2));
