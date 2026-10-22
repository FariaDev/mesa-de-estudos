/* Microinterações da #61 (docs/design/identidade/animados-r2.html): copiar,
   guardar e conferir tocam uma vez, no sucesso da ação. Só animam traço,
   recorte e cor (nada escala, então nada treme; o conferir acende o fundo do
   botão desde a #63), e o CSS base de icon-motion.css já é o estado final:
   com movimento reduzido a duração é 0s e o desenho aparece pronto. */

const MARK_ATTRS='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const BOOKMARK='M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1z';
/* O tempo do chip com a marca, igual ao "Copiado" que o bloco de código já usava. */
export const MARK_MS=1200;
let clipSequence=0;

/** Visto desenhado de uma ponta à outra (pathLength=1 deixa o traço inteiro).
 * @returns {string} SVG da marca de copiado
 * @example button.innerHTML=copiedMark()+'<span>Copiado</span>' */
export function copiedMark(){
 return `<svg class="icon motion-mark motion-copied" ${MARK_ATTRS}><path pathLength="1" d="M6 12.5l4 4 8-9"/></svg>`;
}

/** Marcador que enche de baixo para cima dentro de um recorte com a forma dele,
 * para o cheio nunca passar da borda. Cada marca leva um id de recorte próprio.
 * @returns {string} SVG da marca de guardado
 * @example button.innerHTML=savedMark()+'<span>Guardado</span>' */
export function savedMark(){
 const id=`motion-clip-${++clipSequence}`;
 return `<svg class="icon motion-mark motion-saved" ${MARK_ATTRS}><clipPath id="${id}"><path d="${BOOKMARK}"/></clipPath><g clip-path="url(#${id})"><rect class="motion-level" x="4" y="2" width="16" height="20"/></g><path d="${BOOKMARK}"/></svg>`;
}

/** Troca o conteúdo do chip pela marca e um rótulo, e devolve o original depois.
 * Um segundo clique durante a marca só reinicia o relógio, sem perder o original.
 * @param {HTMLElement} button chip de ação (Copiar, Guardar)
 * @param {string} mark SVG de copiedMark() ou savedMark()
 * @param {string} label texto que acompanha a marca
 * @param {{ms?: number, setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout}} [clock]
 * @example flashMark(button,copiedMark(),t('talk.copied')) */
export function flashMark(button,mark,label,{ms=MARK_MS,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(!button)return;
 if(button._motionTimer===undefined)button._motionOriginal=button.innerHTML;
 else clearTimer(button._motionTimer);
 button.classList.add('ok');
 button.innerHTML=`${mark}<span>${escapeText(label)}</span>`;
 button._motionTimer=setTimer(()=>{
  button.classList.remove('ok');
  button.innerHTML=button._motionOriginal;
  button._motionTimer=undefined;
 },ms);
}

/** Acende o fundo de um botão (Conferir) uma vez, reiniciando se já tocava.
 * @param {HTMLElement} button botão de ação
 * @example playShutter($('#check')) */
export function playShutter(button){
 if(!button)return;
 button.classList.remove('motion-shot');
 void button.offsetWidth; // reinicia a animação CSS no mesmo elemento
 button.classList.add('motion-shot');
}

function escapeText(text){
 return String(text??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[char]);
}
