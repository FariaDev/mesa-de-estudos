// Atribui cada arquivo de desk/tests/ a exatamente uma raia (dono de produção). Uso: node lanes.mjs
import fs from 'node:fs';
import path from 'node:path';
const dir='desk/tests';
const rules=[
 ['agentes-claude-a',/^claude-/],
 ['agentes-claude-b',/^(activity-|agent-|conversations|native-|bundle-|tutor-materials|tutor-pdf-ui|mesa-|mcp-policy|descriptor-cache|run-claude-ui|hunt-activity|live-pi|turn-identity|timeline-adapter)/],
 ['sidechat',/^sidechat/],
 ['pi-bilhete',/^(handoff|send\.test|rpc|framing-parity|pi\.test|pi-contract|pi-prompt|appcontract|hunt-handoff|hunt-pi|fake-pi|menu-conferir|capture-win|capture-new|session-switch)/],
 ['fila-timeline-worklog',/^(pending|queue-retry|send-offline|hunt-queue|resume|timeline|worklog|hunt-timeline|capture-lock|talkview|attachview|hunt-chat|settled-ui)/],
 ['updater-infra',/^(updater|updateflow|gitreal|components|coregate|profiles|syntax-check|parity|installed-smoke|performance-smoke|smoke-x3|electron-env|run-hunts|helpers|layout-measure|zipkit|reference|design-check|watchdog-ui|fixtures|\.gitignore)/],
 ['estudo-backup',/^(study-(backup|git|packages|restore|notes-portable|review-fixes|history|activity|integration|core)|undo-core|deletion)/],
 ['estudo-resto',/^(study-|undo-|pdf-notes|review|bookmarks|chat-library|chat-state|course-materials|studycontext|hunt-review|hunt-study|hunt-qol|material-preview|study\.test)/],
 ['livre-materia',/^(free-|freeworkspaces|material-template|course-drop|first-run-drop|subjects|course-pdf|hunt-pdf-drop|pdf-drop)/],
 ['leitor-pdf',/^(pdf|find-parity|readersheet|reader-|hunt-pdf|hunt-bench|hunt-nav)/],
 ['calc-estado-config',/^(calc|calculator|core\.test|cores-parity|hunt-calc|state-parity|accent|config|layout-|lib|snapshot|color-roles|responsive|settings|wheel)/],
 ['visoes-a',/^(dialogsview|firstrun|tabsview|tutorheader|tutorstate|composerbox|deskflags|statusview|slashview|toast|shortcutview|auxview|escape|view-host)/],
 ['visoes-b',/^(first-run-ui|dialog-standard|tutor-|composer-box|model-indicator|topbar|splitter|improvements|qol-actions|app-smoke|ui-smoke|hunt-shell|hunt-chaos|capture)/],
];
const out={};
for(const f of fs.readdirSync(dir).sort()){
 const name=fs.statSync(path.join(dir,f)).isDirectory()?f+'/':f;
 const hit=rules.find(([,re])=>re.test(f));
 (out[hit?hit[0]:'??']??=[]).push(name);
}
fs.writeFileSync('docs/reviews/issue-30/lanes.json',JSON.stringify(out,null,1));
for(const [k,v] of Object.entries(out)){
 if(k==='??'){console.log('SEM RAIA:',v);continue;}
 fs.writeFileSync(`docs/reviews/issue-30/lane-${k}.txt`,v.map(f=>`desk/tests/${f}`).join('\n')+'\n');
 console.log(k,v.length);
}
