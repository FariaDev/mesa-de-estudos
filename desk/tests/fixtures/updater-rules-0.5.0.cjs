'use strict';

/* Cópia de `normalizeRel`, `isProtected` e `isReplaceable` (e das constantes
   que elas usam) de `desk/updater.cjs` da tag v0.5.0 do repositório
   FariaDev/mesa-de-estudos, zip
   https://codeload.github.com/FariaDev/mesa-de-estudos/zip/refs/tags/v0.5.0.
   O teste não importa o zip: quem atualiza a partir da 0.5.0 aplica esta
   lista, que não conhece uma pasta nova ao lado de `src/` (#72). */

const CODE_DIRS=new Set(['src','assets','templates','scripts','tests']);
const CODE_ROOT_DIRS=new Set(['core','geogebra','visual-check','.githooks']);
const CODE_ROOT_FILES=new Set(['README.md','AGENTS.md','LICENSE','.gitignore']);

function normalizeRel(rel){
 return String(rel||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/,'');
}

/* O cinto de segurança do modo zip: mesmo que a lista de código erre, nada
   destes caminhos sai do zip para o disco do usuário. */
function isProtected(rel){
 const norm=normalizeRel(rel);
 if(!norm)return true;
 const parts=norm.split('/');
 if(parts.some(p=>p==='..'||p===''))return true;
 if(/^[a-zA-Z]:/.test(norm))return true;
 if(/(^|\/)(config\.json|desk\.json|install-source\.json|\.update-manifest\.json)$/i.test(norm))return true;
 if(/(^|\/)\.runtime(\/|$)/.test(norm))return true;
 if(/(^|\/)node_modules(\/|$)/.test(norm))return true;
 if(/\.(jsonl|xopp|pdf|log)$/i.test(norm))return true;
 if(/\.app(\/|$)/.test(norm))return true;
 return false;
}

/* Lista explícita do que o modo zip pode substituir: módulos de código e
   documentos de UI do desk (tests incluído — o manifesto apaga o órfão),
   o miolo de src/assets/templates/scripts/tests e as árvores de código do
   repo (core/geogebra/visual-check/.githooks + raiz).
   Nada fora desta lista é tocado — e a lista nunca inclui o protegido. */
function isReplaceable(rel){
 const norm=normalizeRel(rel);
 if(!norm||isProtected(norm))return false;
 const parts=norm.split('/');
 const [first,second]=parts;
 if(first==='desk'&&parts.length===2){
  return /\.(cjs|mjs|html|css|md|json)$/i.test(second)&&!/^(config|desk)\.json$/.test(second);
 }
 if(first==='desk'&&parts.length>2)return CODE_DIRS.has(second);
 if(parts.length>1)return CODE_ROOT_DIRS.has(first);
 return CODE_ROOT_FILES.has(norm);
}

module.exports={normalizeRel,isProtected,isReplaceable};
