import fs from 'node:fs';import path from 'node:path';
export function makeFixture(){const vault=path.resolve('.reference-fixture-vault');const course=path.join(vault,'Courses','Calculus I');const source=path.join(course,'Sources');fs.mkdirSync(source,{recursive:true});
const content='BT /F1 24 Tf 50 720 Td (FORMULARIO ARTIFICIAL) Tj 0 -60 Td (ALFA-8421) Tj 0 -60 Td (BETA-7319) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;fs.writeFileSync(path.join(source,'Formulario de teste.pdf'),pdf);
fs.writeFileSync(path.join(course,'_state.md'),`---\ncourse: Calculus I\nkind: theory\nsource_roots:\n  - ${source}\n---\n`);
fs.writeFileSync(path.join(vault,'LEARNER.md'),'Test fixture learner. No personal information.\n');
fs.writeFileSync(path.join(vault,'TUTOR.md'),'Read the synthetic source when asked.\n');
const templates=path.resolve('templates');
for(const name of ['TUTOR.md','LEARNER.md']){
 const src=path.join(templates,name);
 if(fs.existsSync(src))fs.copyFileSync(src,path.join(vault,name));
}
return vault;}
