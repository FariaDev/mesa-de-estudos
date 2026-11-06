/* Atalho de zoom do leitor (#111): ⌘/Ctrl + (=/+) aumenta e ⌘/Ctrl - diminui o
   zoom do leitor selecionado — o último em que a pessoa clicou ou rolou,
   enquanto ele continua visível e aberto. O zoom da janela não muda. Sem leitor
   selecionado o atalho não é consumido: o comportamento anterior continua
   valendo (a tecla segue para o menu/Chromium). */

export const ZOOM_STEP=.2;

let selected=null;

/**
 * Intenção de zoom de um keydown: 1 aumenta, -1 diminui, 0 não é o atalho.
 * @param {{key?: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean}} event evento de teclado
 * @returns {1|-1|0} passo pedido pela tecla
 * @example zoomIntent({key:'=',metaKey:true}) // 1
 */
export function zoomIntent(event){
 if(!event||event.altKey)return 0;
 if(!(event.metaKey||event.ctrlKey))return 0;
 const key=String(event.key||'');
 if(key==='='||key==='+')return 1;
 if(key==='-')return -1;
 return 0;
}

/**
 * Guarda o leitor usado por último (clique ou rolagem). `null` limpa.
 * @param {{el?: Element}|null} panel leitor a lembrar
 * @returns {void}
 * @example rememberPdfReader(panel)
 */
export function rememberPdfReader(panel){
 selected=panel||null;
}

/**
 * O último leitor usado, se ele ainda estiver visível.
 * @returns {{el?: Element, nudgeZoom: Function}|null} leitor alvo ou null
 * @example selectedPdfReader() // panel | null
 */
export function selectedPdfReader(){
 const panel=selected;
 if(!panel||panel.minimized)return null; /* Recolhido: o zoom mudaria sem a pessoa ver. */
 const el=panel.el;
 if(!el||el.isConnected===false||el.hidden)return null;
 const rect=el.getBoundingClientRect?.();
 if(rect&&!(rect.width>0&&rect.height>0))return null;
 return panel;
}

/**
 * Aplica o passo de zoom no leitor selecionado. Consome o evento (preventDefault)
 * apenas quando há alvo; sem alvo devolve false para o caminho de antes seguir.
 * @param {{preventDefault?: Function}} event keydown
 * @param {Array<{el?: Element, nudgeZoom: Function}>} panels leitores vivos
 * @returns {boolean} true quando o atalho foi consumido pelo leitor
 * @example handlePdfZoomKey(event,S.panels) // true
 */
export function handlePdfZoomKey(event,panels){
 const intent=zoomIntent(event);
 if(!intent)return false;
 const panel=selectedPdfReader();
 if(!panel||!Array.isArray(panels)||!panels.includes(panel))return false;
 event.preventDefault?.();
 panel.nudgeZoom(intent*ZOOM_STEP);
 return true;
}
