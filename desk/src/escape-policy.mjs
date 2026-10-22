import escapeCore from './generated/mesaqolescape.core.js';

/* ---------------------------------------------------------------------------
   Esc da Mesa — política do renderer.

   O núcleo (`core/mesaqolescape.bend` → `mesaqolescape.core.js`) decide a
   PRIMEIRA camada aberta; aqui ficam só a leitura dos fatos no DOM/estado e a
   tradução do resultado. Regra que nunca pode quebrar: Esc que fecha uma
   camada (diálogo, paleta, menu, popover, citação, busca) NÃO cancela o turno;
   o cancelamento (desk-stop + abort) só acontece quando nada dismissível está
   aberto e o tutor está ocupado.

   Fonte dos fatos (o main.mjs é quem chama no handler de keydown):
     dialog    qualquer <dialog open> (nativo fecha sozinho)
     palette   #command-palette visível
     menu      #course-menu/#study-menu/#settings-menu com .open
     popover   contexto de estudo (Editar), Foto do celular, Mais opções da aba Livre, sessões, modelo e esforço, sessão nova e Mais opções do tutor, Mais opções e contexto do chat lateral, navegação e Mais opções do leitor
     citation  #quote-btn visível (seleção de texto)
     search    busca do PDF aberta ou com termo ativo
     tutor     S.busy (turno aberto)
   --------------------------------------------------------------------------- */

export const ESCAPE_ACTIONS = Object.freeze(['modal', 'palette', 'menu', 'popover', 'citation', 'search', 'tutor', 'none']);
export const ESCAPE_LAYERS = Object.freeze(['dialog', 'palette', 'menu', 'popover', 'citation', 'search', 'tutor']);

/* Fatos → nó do núcleo. Bool ausente vale `false`; só `tutor` vem do estado. */
function factsNode(facts) {
  const f = facts && typeof facts === 'object' ? facts : {};
  return {
    $: 'EscapeFacts',
    dialog: f.dialog === true,
    palette: f.palette === true,
    menu: f.menu === true,
    popover: f.popover === true,
    citation: f.citation === true,
    search: f.search === true,
    tutor: f.tutor === true,
  };
}

/** Decisão pura: fatos → 'modal'|'palette'|'menu'|'popover'|'citation'|'search'|'tutor'|'none'. */
export function decideEscape(facts) {
  return escapeCore.escapeAction(factsNode(facts));
}

/** Só 'tutor' para o turno; qualquer outra ação é fechar uma camada. */
export function stopsTutor(action) {
  return escapeCore.stopsTutor(String(action || ''));
}

function visible(doc, selector) {
  return !!doc.querySelector(`${selector}:not([hidden])`);
}

/** Lê os fatos no DOM/estado vivos (sem inferência: cada camada tem seletor próprio). */
export function collectEscapeFacts(doc = globalThis.document, state = {}) {
  const panels = Array.isArray(state?.panels) ? state.panels : [];
  const pdfFind = visible(doc, '.pdf-find') || panels.some((panel) => !!panel?.findTerm);
  return {
    dialog: !!doc.querySelector('dialog[open]'),
    palette: !!doc.querySelector('#command-palette:not([hidden])'),
    menu: !!doc.querySelector('#course-menu.open, #study-menu.open, #settings-menu.open'),
    popover: visible(doc, '#context-pop') || visible(doc, '#phone-pop') || visible(doc, '#check-note') || visible(doc, '#free-more-pop') || visible(doc, '#conversations-pop') || visible(doc, '#model-pop') || visible(doc, '#new-session-pop') || visible(doc, '#chat-more-pop') || visible(doc, '#sidechat-more-pop') || visible(doc, '#sidechat-context-pop') || visible(doc, '.pdf-nav-pop') || visible(doc, '.pdf-more-pop'),
    citation: visible(doc, '#quote-btn'),
    search: pdfFind,
    tutor: !!state?.busy,
  };
}
