import {$,updateContextSummary} from './state.mjs';
import {t} from './ui-text.mjs';

/* O que vai junto com a mensagem e a edição do contexto de estudo moram em
   Mais opções → Contexto (#123). O núcleo do cabeçalho monta o submenu e este
   módulo devolve os nós vivos do `#context-live` para dentro dele a cada
   render — a mesma técnica do medidor de contexto em `#more-context-slot`.
   A linha saiu do composer para o menu; a matéria, o PDF e a página continuam
   à vista na aba e no leitor, e o livro (`#include-refs`) segue no composer. */

let live=null;

/* Referências aos nós vivos, tomadas uma vez: quando o submenu é re-renderizado
   (troca de idioma, estado do tutor), os nós ficam soltos até voltarem ao
   lugar — `document.querySelector` não os acharia nesse intervalo. */
function liveNodes(){
 if(live)return live;
 const source=$('#context-live');
 live={
  summary:$('#context-summary'),
  study:$('#study-context'),
  refs:$('#context-pop-refs'),
  guide:source?.querySelector('.guide-link')
 };
 return live;
}

function ensureSection(menu,id,className,label,where){
 let section=$(`#${id}`);
 if(section)return section;
 section=document.createElement('div');
 section.id=id;
 section.className=className;
 section.setAttribute('role','group');
 section.setAttribute('aria-label',label);
 if(where==='start')menu.prepend(section);else menu.append(section);
 return section;
}

/* Leva o resumo e a edição para dentro do submenu. Chamado depois de cada
   `renderChildren` do Mais opções, então o menu recém-montado recebe os nós
   vivos do estado (`updateContextSummary` repinta o resumo no lugar). */
export function mountContextSection(){
 const menu=$('#more-context-menu');
 if(!menu)return;
 const nodes=liveNodes();
 const what=ensureSection(menu,'more-context-what','more-context-what',t('header.context'),'start');
 const edit=ensureSection(menu,'more-context-edit','more-context-edit',t('composer.studyAria'),'end');
 if(nodes.summary&&nodes.summary.parentElement!==what)what.append(nodes.summary);
 if(nodes.study&&nodes.study.parentElement!==edit)edit.append(nodes.study);
 if(nodes.refs&&nodes.refs.parentElement!==edit)edit.append(nodes.refs);
 if(nodes.guide&&nodes.guide.parentElement!==edit)edit.append(nodes.guide);
 updateContextSummary();
}
