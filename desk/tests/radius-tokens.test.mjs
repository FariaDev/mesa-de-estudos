import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/* #90, polimento: o raio do app encolheu. Botão, chip, campo e item de menu vão
   até --r-sm (7px); menu/popover/composer/cartão até --r-md/--r-lg (8/10px);
   diálogo até --r-xl (12px). Cápsula e cartão grande saem do CSS — só continuam
   redondos os círculos e trilhos por natureza (as exceções abaixo, cada uma com
   o motivo). Este teste varre as folhas da Mesa e recusa os quatro tokens
   aposentados fora da lista; a definição em `style.css` não conta (não é uso). */

const DESK=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FORBIDDEN=['--r-pill','--r-card','--r-2xl','--r-3xl'];

/* Exceções conscientes: o elemento é círculo/trilho por natureza, não um
   controle que ganhou canto redondo. A lista é fechada e conferida: exceção que
   deixou de existir no CSS quebra o teste. */
const EXCEPTIONS=[
 {file:'src/tutor-chat.css',selector:'#ctx-meter .bar',token:'--r-pill',reason:'barra de progresso: trilho por natureza'},
 {file:'src/conversations-dividers.css',selector:'#review-tab #review-count',token:'--r-pill',reason:'contador numérico pequeno: cápsula por natureza'}
];

/** Todas as folhas de estilo do app (sem node_modules, runtime e gerados). @returns {string[]} */
function cssFiles(){
 const out=[];
 const walk=dir=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   if(['node_modules','.runtime'].includes(entry.name))continue;
   const full=path.join(dir,entry.name);
   if(entry.isDirectory()){if(entry.name!=='generated')walk(full);}
   else if(entry.name.endsWith('.css'))out.push(full);
  }
 };
 walk(DESK);
 return out.sort();
}

/** Seletores que embrulham uma declaração (a última regra antes da chave). @param {string} css @param {number} index @returns {string} */
function selectorAt(css,index){
 const open=css.lastIndexOf('{',index);
 if(open<0)return '';
 const close=css.lastIndexOf('}',open);
 return css.slice(close+1,open).replace(/\s+/g,' ').trim();
}

test('raios: --r-pill/--r-card/--r-2xl/--r-3xl só nas exceções documentadas',()=>{
 const fate=EXCEPTIONS.map(()=>false);
 const offenses=[];
 for(const file of cssFiles()){
  const rel=path.relative(DESK,file).split(path.sep).join('/');
  const css=fs.readFileSync(file,'utf8');
  for(const match of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)){
   const value=match[1];
   const token=FORBIDDEN.find(name=>value.includes(`var(${name})`));
   if(!token)continue;
   const selector=selectorAt(css,match.index);
   const exception=EXCEPTIONS.findIndex(item=>item.file===rel&&item.selector===selector&&item.token===token);
   if(exception>=0){fate[exception]=true;continue;}
   const line=css.slice(0,match.index).split('\n').length;
   offenses.push(`${rel}:${line} ${selector} usa ${token}`);
  }
 }
 assert.deepEqual(offenses,[],`raio grande fora da lista de exceções:\n${offenses.join('\n')}`);
 for(const [index,exception] of EXCEPTIONS.entries()){
  assert.ok(fate[index],`exceção sem uso: ${exception.file} ${exception.selector} ${exception.token} (${exception.reason}) — remova da lista ou devolva o uso`);
 }
});
