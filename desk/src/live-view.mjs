import {build,childrenOf,preserveFocus,renderChildren} from './view-host.mjs';

/* Aplicadores de árvore do núcleo em nós vivos do index.html (#43 fase 2:
   saíram de state.mjs para o medidor de contexto usar sem ciclo). */

/* Attrs que o núcleo decidiu aplicados num elemento vivo (na saída só as
   classes mudam, no mesmo nó). O que o nó novo não traz sai do elemento — por
   padrão `class` e `hidden`, o que permite aplicar `#ctx-tip` sem recriá-lo.
   Controles com estado de host (`#status-dot`) passam uma
   lista maior: sem ela, um `data-tip`/`disabled` velho sobreviveria ao estado
   novo. */
export function applyAttrs(el,node,drop=['class','hidden']){
 const built=build(node);
 for(const attr of built.attributes)el.setAttribute(attr.name,attr.value);
 for(const name of drop)if(!built.hasAttribute(name))el.removeAttribute(name);
 return built;
}
/* Aplica os atributos de um nó de controle vivo: os filhos são do index.html
   (texto, ícone injetado e handlers), então só os attrs entram. */
export function applyAttrsOn(selector,node){
 const el=document.querySelector(selector);
 if(el)applyAttrs(el,node);
}
/* Aplica a árvore da faixa no contêiner fixo do index.html: attrs + filhos.
   Não troca o elemento — o mount tem id/role do HTML e o host guarda estado
   nele (o `_tipText` do medidor, o foco). */
export function applyView(mount,node){
 applyAttrs(mount,node);
 preserveFocus(mount,()=>renderChildren(mount,childrenOf(node.kids)));
}
