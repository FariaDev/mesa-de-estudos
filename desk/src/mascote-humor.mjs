// @ts-check
/* As mascotes do trio ∫ Σ ∇ (#64; o protótipo de humores é docs/design/setup-guia-r1/Folhinha.dc.html):
   a parte sem DOM, por nome de humor e não pelo desenho. Decide qual rosto
   vale, para onde as pupilas olham, a inclinação, as faíscas do "feliz" e a
   cutucada. Quem a põe na tela é `mascote.mjs`; aqui só a regra, para dar para
   testar sem janela. */

/** @typedef {'normal'|'feliz'|'pensando'|'aflita'} MascoteMood */
/** @typedef {'normal'|'feliz'|'pensando'|'aflita'|'sono'|'escrevendo'|'atento'|'lendo'} MascoteHumor */

/**
 * @typedef {object} MascoteFlags
 * @property {MascoteMood} [mood] humor de base que a tela pede
 * @property {boolean} [sleepy] parada há um tempo (sono)
 * @property {boolean} [writing] alguém está digitando (lápis rabiscando)
 * @property {boolean} [alert] algo vai ser solto nela ("!")
 * @property {boolean} [reading] olhos varrendo a página
 * @property {boolean} [laughing] acabou de ser cutucada
 * @property {boolean} [dizzy] cutucada demais
 */

/** O olhar não sai do olho: raio máximo do deslocamento da pupila, em unidades do desenho. */
export const EYE_REACH = 8;

/* Humores que ditam o olhar sozinhos (o mouse não manda). */
const FIXED_LOOK = /** @type {Record<string, [number, number]>} */ ({
  pensando: [4, -8],
  escrevendo: [-7, 5],
  sono: [0, 6],
  lendo: [0, 0],
});

/**
 * O rosto que vale agora. A ordem é a do protótipo: tonta e rindo (cutucadas)
 * vencem tudo; o "feliz" pedido pela tela vence o resto; depois sono,
 * escrevendo, atento, lendo e, por fim, o humor de base.
 * @param {MascoteFlags} flags
 * @returns {MascoteHumor}
 * @example mascoteHumor({mood:'normal',writing:true}) // 'escrevendo'
 */
export function mascoteHumor(flags) {
  const base = flags.mood || 'normal';
  if (flags.dizzy) return 'aflita';
  if (flags.laughing || base === 'feliz') return 'feliz';
  if (flags.sleepy) return 'sono';
  if (flags.writing) return 'escrevendo';
  if (flags.alert) return 'atento';
  if (flags.reading) return 'lendo';
  return base;
}

/**
 * Para onde as pupilas vão: o humor pode fixar o olhar; senão segue o ponto
 * pedido, cortado no alcance do olho.
 * @param {MascoteHumor} humor
 * @param {number} dx
 * @param {number} dy
 * @returns {[number, number]}
 * @example mascoteLook('normal', 30, 40) // [4.8, 6.4]
 */
export function mascoteLook(humor, dx, dy) {
  const fixed = FIXED_LOOK[humor];
  const [x, y] = fixed || [Number(dx) || 0, Number(dy) || 0];
  const length = Math.hypot(x, y);
  if (length <= EYE_REACH) return [x, y];
  return [(x / length) * EYE_REACH, (y / length) * EYE_REACH];
}

/**
 * O olhar a partir do ponteiro: o vetor do centro dos olhos até o mouse, com
 * força que cresce com a distância até o alcance do olho.
 * @param {{left:number,top:number,width:number,height:number}} box caixa da mascote na tela
 * @param {number} clientX
 * @param {number} clientY
 * @returns {[number, number]}
 * @example lookAtPointer({left:0,top:0,width:240,height:260}, 600, 109) // [8, 0]
 */
export function lookAtPointer(box, clientX, clientY) {
  const vx = clientX - (box.left + box.width * 0.5);
  const vy = clientY - (box.top + box.height * 0.42);
  const distance = Math.hypot(vx, vy) || 1;
  const strength = Math.min(1, distance / (box.width * 1.2)) * EYE_REACH;
  return [(vx / distance) * strength, (vy / distance) * strength];
}

/**
 * Quanto o corpo inclina para o lado do olhar, em graus (no máximo 6).
 * @param {number} dx
 * @returns {number}
 * @example mascoteTilt(20) // 6
 */
export function mascoteTilt(dx) {
  return Math.max(-6, Math.min(6, (Number(dx) || 0) * 0.6));
}

/**
 * As oito faíscas do "feliz": saem do alto da cabeça em roda, alternando o
 * acento e o âmbar do lápis.
 * @returns {Array<{x:number,y:number,amber:boolean}>} destino de cada uma
 * @example sparkTargets()[0] // {x:120, y:0, amber:false}
 */
export function sparkTargets() {
  return Array.from({length: 8}, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const reach = 70 + (i % 2) * 18;
    const round = (/** @type {number} */ n) => Math.round(n * 10) / 10;
    return {x: round(120 + Math.cos(angle) * reach), y: round(70 + Math.sin(angle) * reach), amber: i % 2 === 1};
  });
}

/** Cutucadas que deixam tonta, dentro da janela de tempo. */
export const POKES_TO_DIZZY = 5;
export const POKE_WINDOW_MS = 2000;

/**
 * Registra uma cutucada: devolve as que ainda contam e se ela ficou tonta (aí a conta zera).
 * @param {number[]} pokes instantes das cutucadas anteriores
 * @param {number} now
 * @returns {{pokes:number[], dizzy:boolean}}
 * @example poke([0,100,200,300],400) // {pokes:[], dizzy:true}
 */
export function poke(pokes, now) {
  const recent = pokes.filter((time) => now - time < POKE_WINDOW_MS).concat(now);
  if (recent.length >= POKES_TO_DIZZY) return {pokes: [], dizzy: true};
  return {pokes: recent, dizzy: false};
}
