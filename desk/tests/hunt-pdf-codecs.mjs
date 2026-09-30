// Regressão de conteúdo que sumia: imagem JBIG2 sintética, sem material de curso.
// Executar em desk/: node tests/hunt-pdf-codecs.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,newRuntime,seedCourse,writeConfigJson,writeDeskJson} from './helpers.mjs';

// Dois segmentos JBIG2: página 16×16 e região genérica MMR com quadrado
// central 8×8. Os dados MMR foram gerados de um bitmap original via TIFF G4.
const image=Buffer.from('AAAAATAAAQAAABMAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAiYAAQAAAB8AAAAQAAAAEAAAAAAAAAAAAAEmoL/y5/////j/ABAB','base64');
function fixture(){
 const content=Buffer.from('q 160 0 0 160 0 0 cm /Im0 Do Q');
 const objects=[
  Buffer.from('<</Type /Catalog /Pages 2 0 R>>'),
  Buffer.from('<</Type /Pages /Kids [3 0 R] /Count 1>>'),
  Buffer.from('<</Type /Page /Parent 2 0 R /MediaBox [0 0 160 160] /Resources <</XObject <</Im0 5 0 R>>>> /Contents 4 0 R>>'),
  Buffer.concat([Buffer.from(`<</Length ${content.length}>>\nstream\n`),content,Buffer.from('\nendstream')]),
  Buffer.concat([Buffer.from(`<</Type /XObject /Subtype /Image /Width 16 /Height 16 /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /JBIG2Decode /Length ${image.length}>>\nstream\n`),image,Buffer.from('\nendstream')])
 ];
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[];
 let length=parts[0].length;
 objects.forEach((obj,i)=>{offsets.push(length);const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);parts.push(part);length+=part.length;});
 parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${length}\n%%EOF\n`));
 return Buffer.concat(parts);
}

await withArtifacts('pdf-codecs',async ctx=>{
 const runtime=ctx.runtime=newRuntime('pdf-codecs'),course=seedCourse(runtime,'A');
 const file=path.join(course,'codec.pdf');fs.writeFileSync(file,fixture());
 writeConfigJson(runtime,{vaultPath:path.join(runtime,'learning'),courses:[{id:'A',name:'Teste',path:course}],desk:{panels:[{label:'PDF',prefer:['codec']}]}});
 writeDeskJson(runtime,{courseId:'A',pdfs:[{path:file,page:1}]});
 const app=ctx.app=await launchDesk({runtime}),page=await app.firstWindow();
 const warnings=[];page.on('console',msg=>{if(/warn|error/.test(msg.type()))warnings.push(msg.text());});
 await page.waitForFunction(()=>document.querySelector('.pdf-page[data-rendered] canvas'),undefined,{timeout:30000});
 const pixels=await page.locator('.pdf-panel canvas').first().evaluate(canvas=>{
  const c=canvas.getContext('2d');
  const sample=(x,y)=>[...c.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data];
  return {center:sample(.5,.5),corner:sample(.1,.1)};
 });
 assert.ok(Math.abs(pixels.center[0]-pixels.corner[0])>200,`JBIG2 deve aparecer com contraste: ${JSON.stringify(pixels)}`);
 assert.equal(pixels.center[3],255);assert.equal(pixels.corner[3],255);
 assert.deepEqual(warnings.filter(s=>/wasm|jbig2|ignoring errors|Content Security Policy/i.test(s)),[],'decodificador deve carregar sob a CSP da Mesa');
 console.log('PDF CODECS PASSED: imagem JBIG2 renderizada no canvas real, sem erro de decodificador/CSP.');
});
