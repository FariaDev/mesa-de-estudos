import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
const {validateDroppedPdf}=createRequire(import.meta.url)('../pdf-drop-host.cjs');
test('arquivo solto precisa ser PDF local real antes de entrar na biblioteca',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-pdf-drop-'));
 try{
  const pdf=path.join(dir,'Livro.PDF');fs.writeFileSync(pdf,'\n%PDF-1.7\nsynthetic');
  assert.deepEqual(validateDroppedPdf(pdf),{name:'Livro.PDF',path:pdf});
  const fake=path.join(dir,'texto.pdf');fs.writeFileSync(fake,'texto sem PDF');
  assert.throws(()=>validateDroppedPdf(fake),ptMatches(/cabeçalho PDF/));
  const folder=path.join(dir,'pasta.pdf');fs.mkdirSync(folder);
  assert.throws(()=>validateDroppedPdf(folder),ptMatches(/pasta/));
  for(const input of [null,{},'livro.pdf',pdf.replace(/PDF$/,'txt')])assert.throws(()=>validateDroppedPdf(input),ptMatches(/PDF local/));
  assert.throws(()=>validateDroppedPdf(path.join(dir,'ausente.pdf')),/ENOENT/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
