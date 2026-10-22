import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {guardChildren} from './proc-tree.mjs';

// Window tests never reach the user's real Claude Code: unless a test passes
// its own, the home where `~/.local/bin/claude` is looked up holds a guard
// Claude that only answers `--version` with 0.0.0, below the accepted range.
// The Mesa still finds a launcher (boot connects with the synthetic SDK, as it
// did when the real one was found), and any detection refuses it before
// `auth status` — the real one, inside the range since #51, would get there.
// An empty string lets the test use its own HOME instead.
const GUARD_CLAUDE_HOME=path.join(os.tmpdir(),'mesa-claude-de-guarda');

function guardClaudeHome(){
 const file=path.join(GUARD_CLAUDE_HOME,'.local','bin','claude');
 const body='#!/bin/sh\nif [ "$1" = "--version" ]; then echo "0.0.0 (Claude Code de guarda dos testes)"; exit 0; fi\nexit 1\n';
 fs.mkdirSync(path.dirname(file),{recursive:true});
 if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==body)fs.writeFileSync(file,body,{mode:0o755});
 return GUARD_CLAUDE_HOME;
}

export function testEnv(extra={}){
 /* Todo teste que sobe um Electron passa por aqui: a guarda mata o que ele
    subiu quando o processo sai ou recebe SIGTERM/SIGINT/SIGHUP. */
 guardChildren();
 const env={...process.env,...extra};
 env.DESK_TEST='1';
 /* O idioma do sistema decide o da interface quando ninguém escolheu (#41): o teste fixa pt-BR, que é o que as asserções esperam. */
 if(!Object.hasOwn(extra,'LEARNING_DESK_LOCALE'))env.LEARNING_DESK_LOCALE='pt-BR';
 if(!Object.hasOwn(extra,'LEARNING_DESK_CLAUDE_HOME'))env.LEARNING_DESK_CLAUDE_HOME=guardClaudeHome();
 delete env.LEARNING_DESK_CLAUDE_SDK_BINARY;
 delete env.ELECTRON_RUN_AS_NODE;
 return env;
}
