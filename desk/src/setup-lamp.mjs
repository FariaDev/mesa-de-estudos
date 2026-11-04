// @ts-check
/* A cena da luminária na primeira abertura (#101): uma folha, a cúpula parada
   e só a luz se movendo (posição, tamanho e intensidade). O desenho vem do
   mockup do ticket; os valores de cada passo são os da sequência de 12 cenas.
   A regra de qual estado aparece é pura e tem teste; o DOM só recebe
   `data-lamp` e a largura da linha do nome. */

export const LAMP_STATES = /** @type {const} */ ([
  'welcome', 'material', 'escrita', 'tutor', 'onde', 'nome',
  'pasta-esperando', 'pasta-arrastando', 'pasta-achada',
  'tutor-ligando', 'tutor-ligado', 'tutor-instalando', 'tutor-falha',
  'tutor-sem-motor', 'pronto',
]);

const hasEngine = (/** @type {any} */ facts) => {
  const visible = facts?.visibleEngines || ['pi', 'claude', 'opencode'];
  return (!!facts?.piFound && visible.includes('pi'))
    || (!!facts?.claudeFound && visible.includes('claude'))
    || (!!facts?.opencodeFound && visible.includes('opencode'));
};

/**
 * O estado da luz para o passo atual. O tutor sem motor, instalando ou com
 * falha fica com luz fraca e estável, sem alarme; ligando pulsa e ligado fica
 * estável (#101).
 * @param {import('./setup-flow.mjs').SetupState} state
 * @param {any} [facts]
 * @param {{state?: string}} [install]
 * @returns {typeof LAMP_STATES[number]}
 * @example lampStateOf({...initialSetup('setup'), step: 1, frame: 0}) // 'material'
 */
export function lampStateOf(state, facts = {}, install = {}) {
  const step = /** @type {const} */ (['welcome', 'tour', 'name', 'folder', 'tutor', 'ready'])[state.step];
  if (step === 'welcome') return 'welcome';
  if (step === 'tour') return /** @type {const} */ (['material', 'escrita', 'tutor', 'onde'])[state.frame] || 'material';
  if (step === 'name') return 'nome';
  if (step === 'folder') {
    if (state.alert) return 'pasta-arrastando';
    return state.folder && state.pdfCount ? 'pasta-achada' : 'pasta-esperando';
  }
  if (step === 'tutor') return tutorLamp(state, facts, install);
  return 'pronto';
}

/** @param {import('./setup-flow.mjs').SetupState} state @param {any} facts @param {{state?: string}} install */
function tutorLamp(state, facts, install) {
  if (state.online) return 'tutor-ligado';
  if (install.state === 'installing') return 'tutor-instalando';
  if (install.state === 'error') return 'tutor-falha';
  if (hasEngine(facts) || install.state === 'done') return 'tutor-ligando';
  return 'tutor-sem-motor';
}

/**
 * A largura da linha que acompanha a digitação, de 0,05 a 1.
 * @param {string} name
 * @returns {number}
 * @example nameLineScale('') // 0.05
 * @example nameLineScale('Cálculo I') // 1
 */
export function nameLineScale(name) {
  const length = String(name ?? '').trim().length;
  return Math.min(1, Math.max(0.05, length / 8));
}

const CONTENT = `
<g class="sl-top">
<rect x="70" y="268" width="440" height="28" rx="7" fill="#fbf8f1"/>
<rect x="80" y="276" width="70" height="12" rx="6" fill="var(--sl-ink)"/>
<rect x="158" y="276" width="44" height="12" rx="6" fill="var(--sl-ink)" fill-opacity=".3"/>
</g>
<g class="sl-readers">
<rect x="70" y="306" width="127" height="174" rx="7" fill="#fbf8f1"/>
<rect x="83" y="324" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="83" y="342" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="83" y="360" width="60" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="83" y="378" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="83" y="396" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="83" y="414" width="60" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="205" y="306" width="127" height="174" rx="7" fill="#fbf8f1"/>
<rect x="218" y="324" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="218" y="342" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="218" y="360" width="60" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="218" y="378" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="218" y="396" width="100" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="218" y="414" width="60" height="6" rx="3" fill="var(--sl-ink)"/>
</g>
<g class="sl-tutor">
<rect x="342" y="306" width="168" height="174" rx="7" fill="#fbf8f1"/>
<rect x="392" y="322" width="104" height="24" rx="10" fill="var(--sl-ink)"/>
<rect x="356" y="362" width="130" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="356" y="380" width="130" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="356" y="398" width="78" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="356" y="416" width="130" height="6" rx="3" fill="var(--sl-ink)"/>
<rect x="356" y="434" width="130" height="6" rx="3" fill="var(--sl-ink)"/>
</g>
<g class="sl-writer">
<rect x="70" y="490" width="440" height="146" rx="7" fill="#fbf8f1"/>
<path d="M96 570C124 520 140 616 170 566S214 524 240 572 290 610 318 556 362 530 392 572 440 590 480 548" fill="none" stroke="var(--sl-ink)" stroke-width="7" stroke-linecap="round"/>
</g>
<g class="sl-name" style="transform:translate(178px,436px) scaleX(var(--lamp-name-scale,.05));transform-origin:0 0">
<rect width="240" height="10" rx="5" fill="#fbf8f1"/>
<rect y="20" width="280" height="4" rx="2" fill="#fbf8f1" fill-opacity=".55"/>
</g>
<g class="sl-frame-wait"><rect x="223" y="330" width="190" height="230" rx="12" fill="none" stroke="#fbf8f1" stroke-width="6" stroke-dasharray="20 14"/></g>
<g class="sl-frame-drag"><rect x="223" y="330" width="190" height="230" rx="12" fill="#fbf8f1" fill-opacity=".16" stroke="#fbf8f1" stroke-width="7"/></g>
<g class="sl-sheets">
<g transform="rotate(-7 318 450)"><rect x="233" y="340" width="170" height="220" rx="9" fill="#e8e1d0"/></g>
<g transform="rotate(5 318 450)"><rect x="233" y="340" width="170" height="220" rx="9" fill="#e8e1d0"/></g>
<rect x="233" y="340" width="170" height="220" rx="9" fill="#fbf8f1"/>
<g fill="var(--sl-ink)">
<rect x="253" y="368" width="130" height="6" rx="3"/><rect x="253" y="388" width="130" height="6" rx="3"/>
<rect x="253" y="408" width="78" height="6" rx="3"/><rect x="253" y="428" width="130" height="6" rx="3"/>
<rect x="253" y="448" width="130" height="6" rx="3"/><rect x="253" y="468" width="78" height="6" rx="3"/>
<rect x="253" y="488" width="130" height="6" rx="3"/><rect x="253" y="508" width="130" height="6" rx="3"/>
</g>
</g>
<g class="sl-bubble">
<path d="M198 360H438Q454 360 454 376V488Q454 504 438 504H282L246 538V504H198Q182 504 182 488V376Q182 360 198 360Z" fill="#fbf8f1"/>
<g fill="var(--sl-ink)">
<rect x="206" y="392" width="206" height="6" rx="3"/><rect x="206" y="412" width="206" height="6" rx="3"/>
<rect x="206" y="432" width="124" height="6" rx="3"/><rect x="206" y="452" width="206" height="6" rx="3"/>
<rect x="206" y="472" width="206" height="6" rx="3"/>
</g>
</g>`;

/** A cena inteira, em SVG; o conteúdo aparece apagado e de novo sob a luz. */
export const LAMP_SCENE = `
<svg viewBox="0 0 580 700" role="presentation" focusable="false">
<defs>
<clipPath id="sl-fl"><rect width="580" height="700" rx="40"/></clipPath>
<linearGradient id="sl-dim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sl-dim-top)"/><stop offset="1" style="stop-color:var(--sl-dim-base)"/></linearGradient>
<linearGradient id="sl-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sl-top)"/><stop offset="1" style="stop-color:var(--sl-base)"/></linearGradient>
<linearGradient id="sl-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c9" stop-opacity=".6"/><stop offset="1" stop-color="#fff1c9" stop-opacity=".04"/></linearGradient>
<linearGradient id="sl-shade" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="120" y2="0"><stop offset=".35" stop-color="#fffbf0"/><stop offset="1" stop-color="#d9d1bf"/></linearGradient>
<filter id="sl-mb" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="900"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="sl-bb" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="900"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="sl-sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000" flood-opacity=".22"/></filter>
<mask id="sl-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="580" height="700">
<g class="sl-on" filter="url(#sl-mb)"><circle class="sl-pool" r="1" fill="#fff"/><path class="sl-beam-shape" d="M-.44 0L.44 0L1 1L-1 1Z" fill="#fff" fill-opacity=".55"/></g>
</mask>
</defs>
<g clip-path="url(#sl-fl)">
<rect width="580" height="700" fill="url(#sl-dim)"/>
<g fill="#fff" fill-opacity=".05">
<rect x="46" y="0" width="4" height="700"/><rect x="116" y="0" width="4" height="700"/><rect x="186" y="0" width="4" height="700"/><rect x="256" y="0" width="4" height="700"/><rect x="326" y="0" width="4" height="700"/><rect x="396" y="0" width="4" height="700"/><rect x="466" y="0" width="4" height="700"/><rect x="536" y="0" width="4" height="700"/>
<rect x="0" y="36" width="580" height="4"/><rect x="0" y="106" width="580" height="4"/><rect x="0" y="176" width="580" height="4"/><rect x="0" y="246" width="580" height="4"/><rect x="0" y="316" width="580" height="4"/><rect x="0" y="386" width="580" height="4"/><rect x="0" y="456" width="580" height="4"/><rect x="0" y="526" width="580" height="4"/><rect x="0" y="596" width="580" height="4"/><rect x="0" y="666" width="580" height="4"/>
</g>
<g opacity=".14">${CONTENT}</g>
<g mask="url(#sl-mask)">
<rect width="580" height="700" fill="url(#sl-lit)"/>
<g fill="#fff" fill-opacity=".16">
<rect x="46" y="0" width="4" height="700"/><rect x="116" y="0" width="4" height="700"/><rect x="186" y="0" width="4" height="700"/><rect x="256" y="0" width="4" height="700"/><rect x="326" y="0" width="4" height="700"/><rect x="396" y="0" width="4" height="700"/><rect x="466" y="0" width="4" height="700"/><rect x="536" y="0" width="4" height="700"/>
<rect x="0" y="36" width="580" height="4"/><rect x="0" y="106" width="580" height="4"/><rect x="0" y="176" width="580" height="4"/><rect x="0" y="246" width="580" height="4"/><rect x="0" y="316" width="580" height="4"/><rect x="0" y="386" width="580" height="4"/><rect x="0" y="456" width="580" height="4"/><rect x="0" y="526" width="580" height="4"/><rect x="0" y="596" width="580" height="4"/><rect x="0" y="666" width="580" height="4"/>
</g>
${CONTENT}
</g>
<g class="sl-on" filter="url(#sl-bb)"><path class="sl-beam-shape" d="M-.44 0L.44 0L1 1L-1 1Z" fill="url(#sl-beam)"/></g>
<rect y="656" width="580" height="12" fill="#fbf8f1"/>
<rect y="668" width="580" height="32" fill="#e0d8c6"/>
<g filter="url(#sl-sh)">
<path d="M-20 360L115 100L300 150" fill="none" stroke="#d9d1bf" stroke-width="46" stroke-linejoin="round"/>
<path d="M-20 360L115 100L300 150" fill="none" stroke="#fffbf0" stroke-width="34" stroke-linejoin="round" transform="translate(-2 -4)"/>
<g transform="translate(300 150) rotate(-10)">
<ellipse class="sl-rim" cx="0" cy="92" rx="100" ry="13" fill="#ffd978"/>
<circle class="sl-rim" cx="0" cy="76" r="26" fill="#fff8e2"/>
<rect x="-22" y="-48" width="44" height="26" rx="8" fill="#d9d1bf"/>
<path d="M-112 82C-108 12 -54 -26 0 -26C54 -26 108 12 112 82Q0 98 -112 82Z" fill="url(#sl-shade)" stroke="url(#sl-shade)" stroke-width="16" stroke-linejoin="round"/>
</g>
<circle cx="115" cy="100" r="36" fill="var(--sl-ink)"/>
<circle cx="115" cy="100" r="12" fill="#fffbf0"/>
</g>
</g>
</svg>`;
