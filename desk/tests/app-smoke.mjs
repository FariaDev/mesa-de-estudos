// npm run test:app — sanity do bundle instalado + o mesmo ui-smoke contra o executável dele.
// Opt-in e determinístico: (a) sem bundle → exit 0 com instrução; (b) arquivos-chave presentes
// e idênticos ao código atual (bundle obsoleto → aviso + exit 1 com instrução); (c) smoke
// completo apontando DESK_ELECTRON_BIN para o executável do bundle.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bundle=path.resolve(desk,'..','Mesa de Estudos.app');
const dest=path.join(bundle,'Contents','Resources','app');
const bin=path.join(bundle,'Contents','MacOS','Electron');

if(!fs.existsSync(bundle)){
 console.log('test:app: bundle não encontrado — instale primeiro: npm run install-app');
 process.exit(0);
}

/* A lista conferida é a mesma varredura do install-app (módulos de topo, os
   arquivos nomeados, os diretórios e o próprio install-app), não uma lista à mão:
   foi uma lista à mão que deixou o `state-adapter.cjs` fora do bundle e o app
   morria no primeiro require, sem nenhum teste que visse. */
function walk(dir,base=dir){
 const out=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...walk(full,base));
  else if(entry.isFile())out.push(path.relative(base,full));
 }
 return out.sort();
}
const modules=fs.readdirSync(desk).filter(f=>/\.(cjs|mjs)$/.test(f)&&fs.statSync(path.join(desk,f)).isFile());
const named=['index.html','ggb.html','style.css','package.json','config.example.json'].filter(f=>fs.existsSync(path.join(desk,f)));
const dirs=['src','assets','templates'].filter(d=>fs.existsSync(path.join(desk,d)));
const keyFiles=[...modules,...named,...dirs.flatMap(d=>walk(path.join(desk,d)).map(f=>path.join(d,f))),path.join('scripts','install-app.mjs')];

const stale=[];
const missing=[];
for(const file of keyFiles){
 const source=path.join(desk,file);
 const target=path.join(dest,file);
 if(!fs.existsSync(target)){missing.push(file);continue;}
 const same=fs.readFileSync(source).equals(fs.readFileSync(target));
 const installTime=fs.statSync(bundle).mtimeMs;
 const tooOld=!same&&fs.statSync(target).mtimeMs<installTime-5000;
 if(!same||tooOld)stale.push(file);
}
/* Dependências de runtime: o install-app as copia para o node_modules do bundle, e o
   index.html/renderer as importa de lá (KaTeX/marked/DOMPurify/pdf.js). Sem esta
   conferência, um payload sem elas passa como "atual" e só quebra abrindo o app. */
const deps=Object.keys(JSON.parse(fs.readFileSync(path.join(desk,'package.json'),'utf8')).dependencies||{}).filter(d=>d!=='electron');
for(const dep of deps){
 if(!fs.existsSync(path.join(dest,'node_modules',dep)))missing.push('node_modules/'+dep);
}
if(missing.length||stale.length){
 if(missing.length)console.error(`test:app: arquivos ausentes no bundle: ${missing.join(', ')}`);
 if(stale.length)console.error(`test:app: bundle desatualizado em relação ao código atual: ${stale.join(', ')}`);
 console.error('test:app: atualize o bundle com npm run install-app (o teste não roda install-app sozinho).');
 process.exit(1);
}
if(!fs.existsSync(bin)){
 console.error('test:app: executável não encontrado no bundle: '+bin);
 process.exit(1);
}

const run=spawnSync(process.execPath,['tests/ui-smoke.mjs'],{cwd:desk,stdio:'inherit',env:{...process.env,DESK_ELECTRON_BIN:bin}});
if(run.status){
 console.error('test:app: o smoke contra o bundle instalado falhou.');
 process.exit(run.status||1);
}
console.log('APP PASSED: bundle atual (sanity de arquivos) e smoke completo contra o executável instalado.');
