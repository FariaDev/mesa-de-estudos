// @ts-check
import {sparkTargets} from './mascote-humor.mjs';

/* O trio de amigos da #64 — ∫ Integral, Σ Sigma e ∇ Nabla — no estilo da
   rodada 6 da identidade (docs/design/identidade/mascote-r6.html): braços e
   pernas finos em violeta, o mesmo lápis âmbar, olhos contornados e o filtro
   de pincel. O Σ vem da rodada 2 (mascote-r2.html, `<symbol id="sigma">`) e,
   como a ∫, fica em pé sobre a barra de baixo, sem pernas.

   Só o desenho, sem DOM: quem põe na tela é `mascote.mjs`. Contrato com o
   componente: `.mascote-tilt` > `.mascote-jump` (pula), `.mascote-look`
   (pupilas) e `.mascote-sparks` (faíscas). Tudo o que muda por humor é um
   grupo `tr-*` que o `trio.css` mostra ou anima por `data-humor`; o quadro de
   descanso é o que aparece sem animação (movimento reduzido). */

const MEMBRO = '#5a3fc4', TINTA = '#1a1033', SINAL = '#3f2a9e';
/** O âmbar do lápis e do ✓ do Σ; a página do celular (#66) usa o mesmo no ✓ das fotos. */
export const AMBAR = '#e8862a';

/**
 * @typedef {[number, number]} Ponto
 * @typedef {object} Desenho
 * @property {string} corpo o símbolo, já pintado
 * @property {[Ponto, Ponto]} ombro esquerdo e direito
 * @property {Ponto[]} quadril sem pernas, vazio
 * @property {Array<[number, number, number]>} olhos x, y, raio
 * @property {Ponto} boca
 * @property {string} palpebra cor do corpo atrás dos olhos (piscar)
 * @property {Ponto} sinal onde nascem "?", "✓" e o "z"
 */

/** @type {Record<'integral'|'sigma'|'nabla', Desenho>} */
export const TRIO = {
  /* ∫: calma, alta e inclinada; a curva de cima é a cabeça. Lê o material junto. */
  integral: {
    corpo: '<path d="M176 64Q166 26 136 36Q112 46 112 88V184Q112 226 86 230Q66 232 60 212" fill="none" stroke="#6d4fd8" stroke-width="34" stroke-linecap="round"/>',
    ombro: [[98, 132], [126, 140]], quadril: [], olhos: [[118, 50, 24], [162, 46, 26]], boca: [112, 106], palpebra: '#6d4fd8', sinal: [196, 18],
  },
  /* Σ: organizado, soma o que a pessoa fez; em pé sobre a barra de baixo. */
  sigma: {
    corpo: '<path d="M190 62H58L134 140 58 218H190" fill="none" stroke="#6d4fd8" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>',
    ombro: [[80, 104], [146, 140]], quadril: [], olhos: [[98, 50, 25], [148, 46, 27]], boca: [102, 112], palpebra: '#6d4fd8', sinal: [204, 24],
  },
  /* ∇: curioso, aponta para onde ir e dá a dica. */
  nabla: {
    corpo: '<path d="M42 50H198L120 192Z" fill="#8b74ec" stroke="#6d4fd8" stroke-width="28" stroke-linejoin="round"/>',
    ombro: [[52, 94], [188, 94]], quadril: [[110, 192], [132, 192]], olhos: [[97, 94, 25], [145, 92, 27]], boca: [121, 140], palpebra: '#8b74ec', sinal: [200, 24],
  },
};

/* As poses dos braços (mão a partir do ombro, ângulo do lápis). Cada uma é um
   grupo; o CSS mostra a do humor. `descanso` é a de quem não tem pose própria. */
const POSES = {
  descanso: {maoE: [-24, 36], maoD: [22, 28], lapis: 100},
  pensando: {maoE: [-18, 40], maoD: 'queixo', lapis: -112},
  dica: {maoE: [-16, -66], maoD: [22, 28], lapis: 100, dedo: true},
  festa: {maoE: [-30, -56], maoD: [30, -56], lapis: -78},
  escrevendo: {maoE: [-24, 36], maoD: [6, 44], lapis: 116},
};

const soma = (/** @type {Ponto} */ [x, y], /** @type {Ponto} */ [dx, dy]) => /** @type {Ponto} */ ([x + dx, y + dy]);
const n = (/** @type {number} */ v) => Number(v.toFixed(1));
const traco = (/** @type {string} */ d, /** @type {string} */ cor, /** @type {number} */ w, cls = '') =>
  `<path${cls ? ` class="${cls}"` : ''} d="${d}" fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* Braço com cotovelo: o ponto de controle sai para fora do corpo. */
function braco(/** @type {Ponto} */ o, /** @type {Ponto} */ m) {
  const lado = o[0] < m[0] ? 1 : -1;
  const c = [n((o[0] + m[0]) / 2 - 10 * lado), n((o[1] + m[1]) / 2 + 8)];
  return traco(`M${o[0]} ${o[1]}Q${c[0]} ${c[1]} ${m[0]} ${m[1]}`, MEMBRO, 11);
}

const perna = (/** @type {Ponto} */ [x, y]) => traco(`M${x} ${y}L${x + 6 * (x < 120 ? -1 : 1)} 232h${12 * (x < 120 ? -1 : 1)}`, MEMBRO, 11);

/* Lápis atravessando a mão; `ang` aponta para a ponta (grafite escuro). O
   rabisco só gira, com a ponta como pivô (regra de docs/design/movimento.md). */
function lapis(/** @type {Ponto} */ [x, y], /** @type {number} */ ang) {
  const r = ang * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r);
  const p = (/** @type {number} */ k) => `${n(x + dx * k)} ${n(y + dy * k)}`;
  return `<g class="tr-pencil" style="transform-origin:${n(x + dx * 23)}px ${n(y + dy * 23)}px">${traco(`M${p(-18)}L${p(16)}`, AMBAR, 10)}${traco(`M${p(16)}L${p(23)}`, '#3f3f46', 6)}</g>`;
}

/** @param {Desenho} d @param {keyof typeof POSES} id */
function pose(d, id) {
  const p = POSES[id];
  const [oE, oD] = d.ombro;
  const mE = soma(oE, /** @type {Ponto} */ (p.maoE));
  const mD = p.maoD === 'queixo' ? /** @type {Ponto} */ ([d.boca[0] + 30, d.boca[1] + 8]) : soma(oD, /** @type {Ponto} */ (p.maoD));
  const dedo = 'dedo' in p ? `<circle cx="${mE[0]}" cy="${mE[1]}" r="7" fill="${MEMBRO}"/>` : '';
  /* O "!" fica do lado de fora da mão levantada, longe da cabeça. */
  const bx = mE[0] - 20, by = Math.max(mE[1] - 40, 0);
  const bang = 'dedo' in p ? `<g class="tr-bang">${traco(`M${bx} ${by}v30`, SINAL, 8)}<circle cx="${bx}" cy="${by + 44}" r="5.5" fill="${SINAL}"/></g>` : '';
  return `<g class="tr-pose tr-pose-${id}"><g class="tr-arm-left">${braco(oE, mE)}${dedo}</g><g class="tr-arm-right">${braco(oD, mD)}${lapis(mD, p.lapis)}</g>${bang}</g>`;
}

/** @param {Desenho} d */
function olhos(d) {
  const abertos = d.olhos.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${TINTA}" stroke-width="3.5"/>`
    + `<g class="mascote-look"><g class="tr-scan"><circle cx="${x + 3}" cy="${y - 3}" r="${n(r * 0.46)}" fill="${TINTA}"/><circle cx="${x + 6}" cy="${y - 7}" r="3.5" fill="#fff"/></g></g>`).join('');
  const palpebra = `<g class="tr-lid" fill="${d.palpebra}">${d.olhos.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2}"/>`).join('')}</g>`;
  const felizes = d.olhos.map(([x, y, r]) => traco(`M${n(x - r * 0.6)} ${y + 3}q${n(r * 0.6)} ${n(-r * 0.8)} ${n(r * 1.2)} 0`, TINTA, 5)).join('');
  const fechados = d.olhos.map(([x, y, r]) => traco(`M${n(x - r * 0.6)} ${y}q${n(r * 0.6)} ${n(r * 0.5)} ${n(r * 1.2)} 0`, TINTA, 5)).join('');
  const aflitas = d.olhos.map(([x, y, r], i) => traco(`M${n(x - r * 0.7)} ${y - r - (i ? 4 : 12)}L${n(x + r * 0.7)} ${y - r - (i ? 12 : 4)}`, TINTA, 4)).join('');
  const atentas = d.olhos.map(([x, y, r]) => traco(`M${n(x - r * 0.7)} ${y - r - 8}q${n(r * 0.7)} -9 ${n(r * 1.4)} 0`, TINTA, 4)).join('');
  return `<g class="tr-eyes-open">${abertos}${palpebra}</g><g class="tr-eyes-happy">${felizes}</g><g class="tr-eyes-closed">${fechados}</g>`
    + `<g class="tr-brow-worried">${aflitas}</g><g class="tr-brow-alert">${atentas}</g>`;
}

/** @param {Desenho} d */
function bocas(d) {
  const [x, y] = d.boca;
  return traco(`M${x - 10} ${y}q10 7 20 0`, TINTA, 4.5, 'tr-mouth-smile')
    + `<path class="tr-mouth-big" d="M${x - 15} ${y - 2}q15 18 30 0z" fill="${TINTA}"/>`
    + traco(`M${x - 7} ${y + 2}q7-3 14 0`, TINTA, 4.5, 'tr-mouth-hmm')
    + traco(`M${x - 9} ${y + 6}q9-8 18 0`, TINTA, 4.5, 'tr-mouth-worried')
    + `<ellipse class="tr-mouth-o" cx="${x}" cy="${y + 2}" rx="6.5" ry="8" fill="${TINTA}"/>`;
}

/* Sinais: "?" pensando, "✓" do feliz e da soma do Σ, "z" do sono. */
function sinais(/** @type {Desenho} */ d) {
  const [x, y] = d.sinal;
  return `<g class="tr-question">${traco(`M${x - 16} ${y + 8}q0-16 16-16q16 0 16 16q0 10-14 14v8`, SINAL, 8)}<circle cx="${x + 2}" cy="${y + 43}" r="5.5" fill="${SINAL}"/></g>`
    + `<g class="tr-check">${traco(`M${x - 20} ${y + 14}l10 10 24-28`, AMBAR, 10)}</g>`
    + `<g class="tr-z"><text class="tr-z1" x="${x - 12}" y="${y + 22}">z</text><text class="tr-z2" x="${x + 2}" y="${y + 6}">z</text></g>`;
}

/* O livrinho aberto que a ∫ lê no "lendo"; os outros dois só varrem com os olhos. */
const livro = (/** @type {Desenho} */ d) => {
  const [x, y] = soma(d.ombro[0], [-34, 30]);
  return `<g class="tr-book"><path d="M${x} ${y}l26 6v34l-26-6zM${x + 26} ${y + 6}l26-6v34l-26 6z" fill="#fffbf0" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>`
    + traco(`M${x + 6} ${y + 12}l14 3M${x + 6} ${y + 20}l14 3M${x + 32} ${y + 15}l14-3M${x + 32} ${y + 23}l14-3`, '#b9b2a3', 2.5) + '</g>';
};

/* O pincel da rodada 2: borda trêmula e um grão por dentro. Um por SVG, com o `uid`. */
const pincel = (/** @type {string} */ uid) => `<defs><filter id="${uid}p" x="-10%" y="-10%" width="120%" height="120%">`
  + '<feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="7" result="onda"/>'
  + '<feDisplacementMap in="SourceGraphic" in2="onda" scale="6" xChannelSelector="R" yChannelSelector="G" result="borda"/>'
  + '<feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="3" result="ruido"/>'
  + '<feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .6 0 0 0 -.38" result="grao"/>'
  + '<feComposite in="grao" in2="borda" operator="in" result="graoDentro"/>'
  + '<feMerge><feMergeNode in="borda"/><feMergeNode in="graoDentro"/></feMerge></filter></defs>';

const sparks = () => `<g class="mascote-sparks">${sparkTargets().map(({x, y, amber}) =>
  `<path class="tr-spark${amber ? ' tr-spark-amber' : ''}" style="--fx:${x}px;--fy:${y}px" d="M0 -7Q1.2 -1.2 7 0Q1.2 1.2 0 7Q-1.2 1.2 -7 0Q-1.2 -1.2 0 -7Z"/>`).join('')}</g>`;

/**
 * O SVG de um dos três, sem animação embutida (o `trio.css` anima).
 * @param {'integral'|'sigma'|'nabla'} id
 * @param {string} uid prefixo único na página (o filtro do pincel)
 * @returns {string}
 * @example trioSvg('nabla', 'm1').includes('mascote-look') // true
 */
export function trioSvg(id, uid) {
  const d = TRIO[id];
  if (!d) throw new Error(`desenho do trio desconhecido: ${JSON.stringify(id)}; esperado "integral", "sigma" ou "nabla"`);
  const poses = /** @type {Array<keyof typeof POSES>} */ (Object.keys(POSES)).map((p) => pose(d, p)).join('');
  const livroDela = id === 'integral' ? livro(d) : '';
  return `<svg viewBox="0 -10 240 260" aria-hidden="true">${pincel(uid)}`
    + `<ellipse class="tr-shadow" cx="122" cy="238" rx="64" ry="7" fill="#000" opacity=".18"/>`
    + `<g class="mascote-tilt"><g class="mascote-jump"><g class="tr-breathe">`
    + `<g filter="url(#${uid}p)">${d.quadril.map(perna).join('')}${d.corpo}${poses}${livroDela}</g>`
    + `<g filter="url(#${uid}p)">${olhos(d)}${bocas(d)}</g>`
    + `${sinais(d)}</g></g></g>${sparks()}</svg>`;
}
