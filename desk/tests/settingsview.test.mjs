import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/settingsview.core.js';
import {ptText} from './pt-text.mjs';

/* Contrato do artefato `settingsview.core.js` (gerado de core/settingsview.bend):
   as cinco seções das Configurações (ticket #20), a árvore da navegação lateral
   e a validação das matérias. As leis fixam a forma; aqui se confere o que o
   aplicador (`src/settings.mjs`) recebe. */

const nodes=(l)=>{const out=[];for(let c=l;c&&c.$==='Con';c=c.tail)out.push(c.head);return out;};
const attrs=(node)=>{const out={};for(let a=node.attrs;a&&a.$==='Con';a=a.tail)if(!(a.head.name in out))out[a.head.name]=a.head.value;return out;};
const text=(node)=>node.$==='ViewText'?node.text:nodes(node.kids).map(text).join('');
const list=(xs)=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});
const row=(id,name,path)=>({$:'SettingsRow',id,name,path});
const issues=(rows)=>nodes(core.settingsIssues(list(rows)));

const ORDER=['materias','leitores','mesa','avisos','pastas'];
const LABELS=['Matérias','Leitores','Recursos da mesa','Aparência e avisos','Pastas e programas'];

test('as cinco seções, na ordem da lateral, e Matérias abre primeiro',()=>{
 assert.deepEqual(nodes(core.sectionIds()),ORDER);
 assert.equal(core.firstSection(),'materias');
 assert.deepEqual(ORDER.map(id=>ptText(core.sectionLabel(id))),LABELS);
});

test('navegação sem seção válida marca a primeira',()=>{
 const buttons=nodes(core.navChildren('???'));
 assert.equal(attrs(buttons[0])['aria-current'],'page');
 assert.equal(buttons.filter(b=>'aria-current' in attrs(b)).length,1);
});

test('validação: linha em branco não é erro; matéria completa também não',()=>{
 assert.deepEqual(issues([]),[]);
 assert.deepEqual(issues([row('','',''),row('A','Cálculo','/pdfs/a')]),[]);
});

test('validação: nome sem pasta pede a pasta, na seção Matérias, no campo path',()=>{
 const [one,...rest]=issues([row('','Física','')]);
 assert.equal(rest.length,0);
 assert.equal(one.section,'materias');
 assert.equal(Number(one.row),0);
 assert.equal(one.field,'path');
 assert.equal(one.message,core.missingFolderText());
 assert.equal(core.issueSection(core.settingsIssues(list([row('','Física','')]))),'materias');
});

test('validação: nome repetido acusa a segunda linha, no campo name',()=>{
 const found=issues([row('','Cálculo','/a'),row('','Cálculo','/b')]);
 assert.equal(found.length,1);
 assert.equal(Number(found[0].row),1);
 assert.equal(found[0].field,'name');
 assert.equal(found[0].message,core.duplicateText());
});

test('validação: sem erro não leva a seção nenhuma',()=>{
 assert.equal(core.issueSection(core.settingsIssues(list([row('A','Cálculo','/a')]))),'');
});

test('aviso de erro: parágrafo role=alert com o id que o campo aponta',()=>{
 const node=core.errorNode('course-0','Escolha a pasta.');
 assert.equal(node.tag,'p');
 assert.equal(attrs(node).id,core.errorId('course-0'));
 assert.equal(attrs(node).class,'cfg-error');
 assert.equal(attrs(node).role,'alert');
 assert.equal(text(node),'Escolha a pasta.');
});
