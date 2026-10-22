/* PDFs sintéticos para os testes que precisam de muitas páginas (sem material
   de curso, WinAnsi para o acento). Saiu do hunt-pdf-retention na #67, quando a
   sonda de desempenho passou a usar o mesmo gerador. */

function pdfBytes(objects){
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 const startxref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(off=>`${String(off).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length+1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
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
  const contents=`BT /F1 16 Tf 72 720 Td (${String(line(i+1,count)).replace(/([\\()])/g,'\\$1')}) Tj ET`;
  objects.push(`<</Length ${Buffer.byteLength(contents,'latin1')}>>\nstream\n${contents}\nendstream`);
 }
 return pdfBytes(objects);
}
