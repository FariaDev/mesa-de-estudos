/* PDFs sintéticos para os testes que precisam de muitas páginas (sem material
   de curso, WinAnsi para o acento). Saiu do hunt-pdf-retention na #67, quando a
   sonda de desempenho passou a usar o mesmo gerador. */

function pdfBytes(objects){
 const chunks=[Buffer.from('%PDF-1.4\n','latin1')];const offsets=[];let length=chunks[0].length;
 objects.forEach((obj,i)=>{
  const body=Buffer.isBuffer(obj)?obj:Buffer.from(String(obj),'latin1');
  const head=Buffer.from(`${i+1} 0 obj\n`,'latin1'),tail=Buffer.from('\nendobj\n','latin1');
  offsets.push(length);
  chunks.push(head,body,tail);
  length+=head.length+body.length+tail.length;
 });
 const startxref=length;
 const xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 chunks.push(Buffer.from(xref,'latin1'));
 return Buffer.concat(chunks);
}

const escapeText = (text) => String(text).replace(/([\\()])/g, '\\$1');

/** Várias linhas de `Tj`: uma só string longa o pdf.js corta na extração. */
function textOps(text, size = 16, maxChars = 100) {
 const raw = String(text);
 const chunks = [];
 for (let at = 0; at < raw.length; at += maxChars) chunks.push(raw.slice(at, at + maxChars));
 if (chunks.length === 0) return '';
 return chunks.map((chunk, index) => `${index === 0 ? '' : `0 -${Math.ceil(size * 1.4)} Td `}(${escapeText(chunk)}) Tj`).join(' ');
}

/**
 * PDF de `count` páginas Carta, cada uma com a linha que `line(n, total)` devolve.
 * @param {number} count
 * @param {(n: number, total: number) => string} line
 * @returns {Buffer}
 * @example multiPagePdf(3, (n, total) => `Página ${n} de ${total}`)
 */
export function multiPagePdf(count,line){
 const objects=['<</Type/Catalog/Pages 2 0 R>>',`<</Type/Pages/Kids[${Array.from({length:count},(_,i)=>`${4+i} 0 R`).join(' ')}]/Count ${count}>>`,'<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'];
 for(let i=0;i<count;i++)objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${4+count+i} 0 R>>`);
 for(let i=0;i<count;i++){
  const contents=`BT /F1 16 Tf 72 720 Td ${textOps(line(i+1,count), 16)} ET`;
  objects.push(`<</Length ${Buffer.byteLength(contents,'latin1')}>>\nstream\n${contents}\nendstream`);
 }
 return pdfBytes(objects);
}

/**
 * PDF de `count` páginas com texto e imagens: `images[page]` lista
 * `{width, height, x, y}` em pontos. Uma imagem de 48×48 é um logo (0,5% da
 * folha) e uma de 350×300 é uma figura (21,7%).
 * @param {number} count
 * @param {(n: number, total: number) => string} line
 * @param {Record<number, Array<{width: number, height: number, x: number, y: number}>>} [images]
 * @returns {Buffer}
 * @example imagePagesPdf(2, () => 'texto', {1: [{width: 48, height: 48, x: 520, y: 30}]})
 */
export function imagePagesPdf(count,line,images={}){
 const imageId=4+2*count;
 const objects=['<</Type/Catalog/Pages 2 0 R>>',`<</Type/Pages/Kids[${Array.from({length:count},(_,i)=>`${4+i} 0 R`).join(' ')}]/Count ${count}>>`,'<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'];
 for(let i=0;i<count;i++)objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>/XObject<</Im0 ${imageId} 0 R>>>>/Contents ${4+count+i} 0 R>>`);
 for(let i=0;i<count;i++){
  const draws=(images[i+1]||[]).map(({width,height,x,y})=>`q ${width} 0 0 ${height} ${x} ${y} cm /Im0 Do Q`).join('\n');
  const contents=`BT /F1 4 Tf 40 760 Td ${textOps(line(i+1,count), 4, 200)} ET\n${draws}`;
  objects.push(`<</Length ${Buffer.byteLength(contents,'latin1')}>>\nstream\n${contents}\nendstream`);
 }
 objects.push('<</Type/XObject/Subtype/Image/Width 1/Height 1/ColorSpace/DeviceRGB/BitsPerComponent 8/Length 3>>\nstream\n\xff\x00\x00\nendstream');
 return pdfBytes(objects);
}

/**
 * Página quadrada com quatro retângulos coloridos, um por quadrante, para os
 * testes de giro e recorte compararem pixels em posição conhecida.
 * Cores na página sem giro: canto superior esquerdo vermelho, superior direito
 * verde, inferior esquerdo azul e inferior direito amarelo.
 * @param {number} [size] lado da página em pontos
 * @returns {Buffer}
 * @example quadrantsPdf(400) // página 400×400 com os quatro quadrantes
 */
export function quadrantsPdf(size=400){
 const half=size/2;
 const contents=`1 0 0 rg 0 ${half} ${half} ${half} re f\n0 1 0 rg ${half} ${half} ${half} ${half} re f\n0 0 1 rg 0 0 ${half} ${half} re f\n1 1 0 rg ${half} 0 ${half} ${half} re f`;
 const objects=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${size} ${size}]/Contents 4 0 R>>`,`<</Length ${Buffer.byteLength(contents,'latin1')}>>\nstream\n${contents}\nendstream`];
 return pdfBytes(objects);
}

/* Ruído determinístico: o PNG de uma página assim não comprime e serve para
   provar que o teto de tamanho reduz a imagem em vez de falhar calado. */
function noiseBytes(width,height,seed){
 let state=seed>>>0;
 const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
 const pixels=Buffer.alloc(width*height*3);
 for(let i=0;i<pixels.length;i+=1)pixels[i]=next()&0xff;
 return pixels;
}

/**
 * Página com uma imagem de ruído cobrindo a folha inteira.
 * @param {{pageSize?: number, width?: number, height?: number, seed?: number}} [options]
 * @returns {Buffer}
 * @example noisePdf({width: 600, height: 600}) // PNG grande em qualquer ampliação
 */
export function noisePdf({pageSize=400,width=600,height=600,seed=7}={}){
 const pixels=noiseBytes(width,height,seed);
 const contents=`q ${pageSize} 0 0 ${pageSize} 0 0 cm /Im0 Do Q`;
 const image=Buffer.concat([
  Buffer.from(`<</Type/XObject/Subtype/Image/Width ${width}/Height ${height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Length ${pixels.length}>>\nstream\n`,'latin1'),
  pixels,
  Buffer.from('\nendstream','latin1'),
 ]);
 const objects=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageSize} ${pageSize}]/Resources<</XObject<</Im0 5 0 R>>>>/Contents 4 0 R>>`,`<</Length ${Buffer.byteLength(contents,'latin1')}>>\nstream\n${contents}\nendstream`,image];
 return pdfBytes(objects);
}
