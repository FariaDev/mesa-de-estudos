/* Mutação manual por área do Map (#30): aplica UMA troca de texto na fonte de
   produção, roda o guardião, registra pegou/não pegou e restaura com
   `git checkout -- <arquivo>`. Uso (da raiz): node docs/reviews/issue-30/mutacoes.mjs [filtro] */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../../../',import.meta.url).pathname;
const proof='node core/proof.mjs';
const T=(...f)=>`cd desk && node --test ${f.map(x=>'tests/'+x).join(' ')}`;
const M=[
 // área, arquivo, de, para, comando
 ['Diálogos/estado do tutor (tutorstate)','core/tutorstate.bend','V.viewText("Chamando o tutor")','V.viewText("Chamando")',proof],
 ['Cabeçalho do tutor (tutorheader)','core/tutorheader.bend','"Encerrar por hoje"','"Encerrar hoje"',proof],
 ['Chat/Conferir anexo (attachview)','core/attachview.bend','"Remover citação"','"Remover cita"',proof],
 ['Chat lateral (sidechat)','core/sidechat.bend','"Atualizar contexto"','"Atualizar"',proof],
 ['Caixa de mensagem (composerbox)','core/composerbox.bend','"Vai junto: só a mensagem"','"Vai junto: mensagem"',proof],
 ['Calculadora/flags (deskflags)','core/deskflags.bend','V.attrId("calc-divider")','V.attrId("calc-divisor")',proof],
 ['Slash (slashview)','core/slashview.bend','String.append("slash-opt-", Nat.show(i))','String.append("slash-op-", Nat.show(i))',proof],
 ['Navegação PDF (pdfnav)','core/pdfnav.bend','"Voltar à página anterior"','"Voltar"',proof],
 ['Capacidades do agente (agentcaps canSend)','core/agentcaps.bend','Bool.or(Bool.not(busy), steer)','Bool.or(busy, steer)',proof],
 ['Fila guardada (pending keptWhileOff)','core/pending.bend',"case True{}:\n      False{}\n    case False{}:\n      usable","case True{}:\n      usable\n    case False{}:\n      usable",proof],
 ['Desfazer (undoview isExpired)','core/undoview.bend','Nat.is_ge(now, expiresAt)','Nat.is_ge(expiresAt, now)',proof],
 ['Envio: recusa × dúvida (send.cjs)','desk/send.cjs',"error?.notSent === true ? 'refused' : 'ambiguous'","error?.notSent === true ? 'ambiguous' : 'refused'",T('send.test.mjs','handoff.test.mjs')],
 ['Bilhete: recoverClaims enviando-* (handoff.cjs)','desk/handoff.cjs',"names.filter((n) => n.startsWith(SENDING_PREFIX) && n.endsWith('.json'))","names.filter((n) => n.startsWith('enviando-nunca-') && n.endsWith('.json'))",T('handoff.test.mjs','send.test.mjs')],
 ['Updater: git pull só ff (updater.cjs)','desk/updater.cjs',"['pull','--ff-only']","['pull']",T('updater.test.mjs','updateflow.test.mjs','gitreal.test.mjs')],
 ['Ponte RPC: framing (rpc.cjs)','desk/rpc.cjs',"String(joined).split('\\n')","String(joined).split('\\n\\n')",T('rpc.test.mjs')],
 ['Calculadora: secante (calculator.mjs)','desk/calculator.mjs','sec:x=>cosOf(x)===0?undef():1/cosOf(x),','sec:x=>cosOf(x)===0?undef():cosOf(x),',T('core.test.mjs','calcview.test.mjs')],
 ['Favoritos: teto (bookmarks.cjs)','desk/bookmarks.cjs','if (out.length >= coreLimit()) break;','if (out.length >= coreLimit() + 1000) break;',T('bookmarks.test.mjs')],
 ['Fila em disco: __proto__ (pending.cjs)','desk/pending.cjs',"key === '__proto__' || ","",T('pending.test.mjs')],
 ['Retomada: sem matéria (resume.cjs)','desk/resume.cjs',"if (!key) throw Error('Sem matéria ativa","if (false) throw Error('Sem matéria ativa",T('resume.test.mjs')],
 ['Caminho de imagem fora da raiz (lib.cjs)','desk/lib.cjs','!candidate.startsWith(base+path.sep)','false',T('lib.test.mjs','lib-limits.test.mjs')],
 ['Desfazer: poda (deletion-undo.cjs)','desk/deletion-undo.cjs','if (core().isExpired(BigInt(at), BigInt(entry.expiresAt))) entries.delete(token);','',T('review-undo.test.mjs','pdf-notes-undo.test.mjs')],
];
const only=process.argv[2];
const out=[];
for(const [area,file,de,para,cmd] of M){
  if(only&&!area.includes(only)&&!file.includes(only))continue;
  const p=root+file;const src=fs.readFileSync(p,'utf8');
  const n=src.split(de).length-1;
  if(n!==1){out.push({area,file,res:`SEM-ALVO (${n} ocorrências)`});console.log(area,'→ alvo',n);continue;}
  fs.writeFileSync(p,src.replace(de,()=>para));
  const t0=Date.now();
  const r=spawnSync('sh',['-c',cmd],{cwd:root,encoding:'utf8',timeout:300000});
  spawnSync('git',['checkout','--',file],{cwd:root});
  const caught=r.status!==0;
  const txt=(r.stdout+r.stderr);
  const who=[...new Set([...txt.matchAll(/^\s*✖ (.+?)(?: \(|$)/gm)].map(m=>m[1].trim()))].slice(0,3);
  const lawFail=[...txt.matchAll(/(?:FAIL|✗|falhou)[^\n]*/gi)].map(m=>m[0]).slice(0,2);
  out.push({area,file,res:caught?'PEGOU':'NÃO PEGO',por:who.length?who:lawFail,s:Math.round((Date.now()-t0)/1000)});
  console.log(area,'→',out.at(-1).res,JSON.stringify(out.at(-1).por));
}
const d=spawnSync('git',['diff','--stat'],{cwd:root,encoding:'utf8'}).stdout.trim();
console.log('git diff após restaurar:',d||'(vazio)');
fs.writeFileSync(root+'docs/reviews/issue-30/mutacoes.json',JSON.stringify(out,null,1));
