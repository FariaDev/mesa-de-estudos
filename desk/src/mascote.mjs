// @ts-check
import {mascoteHumor,mascoteLook,mascoteTilt,lookAtPointer,poke} from './mascote-humor.mjs';
import {trioSvg} from './trio-art.mjs';

/* As mascotes da Mesa (#64): o trio ∫ Integral, Σ Sigma e ∇ Nabla, no estilo
   da rodada 6 da identidade. Este é o único lugar que os põe na tela: setup,
   Guia e a marca de "pensando" do chat chamam `createMascote` ou
   `mascoteMarkup`, nunca o SVG direto.

   Aqui moram o humor (por nome: normal, feliz, pensando, aflita, sono,
   escrevendo, atento, lendo), o olhar que segue o mouse, a inclinação, o pulo,
   as faíscas, a cutucada e o movimento reduzido. O desenho de cada personagem
   entrega um SVG com os grupos `.mascote-tilt`, `.mascote-jump`,
   `.mascote-look` e `.mascote-sparks`; piscar, laços e rostos por humor ficam
   no CSS dela, chaveados por `data-humor` e pelas classes `mascote-*`.

   Para pôr outra personagem: o desenho com o mesmo contrato de grupos (como
   `trio-art.mjs`), o CSS dela sob `.mascote-<id>` (como `trio.css`) e uma
   linha em PERSONAGENS, com a chave do nome em `src/locales/*.json`. */

/**
 * @typedef {object} Personagem
 * @property {(uid:string)=>string} draw o SVG, com recortes prefixados por `uid`
 * @property {string} nameKey a chave do nome no catálogo (vai no aria-label)
 */

/** @type {Record<string, Personagem>} */
const PERSONAGENS = {
  integral: {draw: (uid) => trioSvg('integral', uid), nameKey: 'mascote.integral.nome'},
  sigma: {draw: (uid) => trioSvg('sigma', uid), nameKey: 'mascote.sigma.nome'},
  nabla: {draw: (uid) => trioSvg('nabla', uid), nameKey: 'mascote.nabla.nome'},
};

/**
 * A personagem pedida, ou um erro que diz o que veio e o que vale.
 * @param {unknown} personagem
 * @returns {Personagem}
 * @example personagemOf('sigma').nameKey // 'mascote.sigma.nome'
 */
export function personagemOf(personagem) {
  const found = typeof personagem === 'string' && Object.hasOwn(PERSONAGENS, personagem) ? PERSONAGENS[personagem] : null;
  if (found) return found;
  throw new Error(`personagem da mascote desconhecida: ${JSON.stringify(personagem)}; esperado um destes textos: ${Object.keys(PERSONAGENS).map((id) => `"${id}"`).join(', ')}`);
}

/**
 * A chave do nome da personagem no catálogo (para o aria-label).
 * @param {string} personagem
 * @returns {string}
 * @example t(mascoteNameKey('nabla')) // 'Nabla'
 */
export const mascoteNameKey = (personagem) => personagemOf(personagem).nameKey;

/**
 * @typedef {import('./mascote-humor.mjs').MascoteFlags & {wave?:boolean,float?:boolean}} MascoteState
 */

/**
 * O que o estado vira no elemento: o humor (`data-humor`) e as classes de laço.
 * Puro, para o teste do contrato não depender do desenho.
 * @param {MascoteState} state
 * @returns {{humor:import('./mascote-humor.mjs').MascoteHumor, classes:Record<string,boolean>}}
 * @example mascoteView({mood:'feliz'}).classes['mascote-party'] // true
 */
export function mascoteView(state) {
  const humor = mascoteHumor(state);
  return {
    humor,
    classes: {
      'mascote-waving': !!state.wave && humor === 'normal',
      'mascote-floating': state.float !== false,
      'mascote-party': state.mood === 'feliz',
    },
  };
}

const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Animação de uma vez: tira a classe, força o recálculo e põe de novo, para
   recomeçar mesmo no meio da anterior. */
function replay(/** @type {Element} */ el, /** @type {string} */ cls) {
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
}

let serial = 0;

/**
 * @typedef {object} Mascote
 * @property {HTMLElement} el
 * @property {(next:MascoteState)=>void} set troca o humor e os laços (entrar em "feliz" comemora)
 * @property {(dx:number,dy:number)=>void} look olhar num deslocamento
 * @property {(event:{clientX:number,clientY:number})=>void} lookAt olhar para um ponto da tela
 * @property {()=>void} jump um pulo (nada com movimento reduzido)
 * @property {()=>void} celebrate pulo e faíscas, sem trocar o humor
 * @property {()=>void} tally o ✓ da soma (o Σ marca um passo vencido)
 */

/**
 * Cria uma mascote. Interativa, reage ao clique e ao passar o mouse e se
 * apresenta pelo nome (`label`, de `mascoteNameKey`) como imagem; decorativa,
 * fica escondida do leitor de tela. Nenhuma das duas é um controle: não entra
 * no Tab.
 * @param {{personagem:string, humor?:import('./mascote-humor.mjs').MascoteMood, tamanho:number, label?:string, interativa?:boolean}} options
 * @returns {Mascote}
 * @example const m=createMascote({personagem:'nabla',humor:'pensando',tamanho:120,interativa:false});mount.append(m.el);
 */
export function createMascote({personagem, humor = 'normal', tamanho, label = '', interativa = true}) {
  const {draw} = personagemOf(personagem);
  const el = document.createElement('div');
  el.className = `mascote mascote-${personagem}${interativa ? ' mascote-interativa' : ''}`;
  el.style.setProperty('--fo-size', `${tamanho}px`);
  if (interativa) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else el.setAttribute('aria-hidden', 'true');
  el.innerHTML = draw(`mascote${++serial}`);
  /** @type {MascoteState} */
  let state = {mood: humor, wave: false, float: true};
  let pointer = /** @type {[number,number]} */ ([0, 0]);
  let pokes = /** @type {number[]} */ ([]);
  let laughTimer = 0, dizzyTimer = 0;
  const jumpEl = /** @type {Element} */ (el.querySelector('.mascote-jump'));
  const sparksEl = /** @type {Element} */ (el.querySelector('.mascote-sparks'));

  function paint() {
    const view = mascoteView(state);
    el.dataset.humor = view.humor;
    for (const [cls, on] of Object.entries(view.classes)) el.classList.toggle(cls, on);
    const still = reducedMotion();
    const [dx, dy] = mascoteLook(view.humor, still ? 0 : pointer[0], still ? 0 : pointer[1]);
    for (const pupils of el.querySelectorAll('.mascote-look')) /** @type {SVGGElement} */ (pupils).style.transform = `translate(${dx}px,${dy}px)`;
    /** @type {SVGGElement} */ (el.querySelector('.mascote-tilt')).style.transform = `rotate(${still ? 0 : mascoteTilt(pointer[0])}deg)`;
  }

  function jump() {
    if (!reducedMotion()) replay(jumpEl, 'mascote-jumping');
  }

  function celebrate() {
    jump();
    if (!reducedMotion()) replay(sparksEl, 'mascote-bursting');
  }

  /* O ✓ aparece mesmo com movimento reduzido: é informação, não enfeite. */
  function tally() {
    replay(el, 'mascote-tallying');
    jump();
  }

  /* Clique: ri por 900 ms; cinco seguidos deixam aflito por 1,6 s. */
  function onPoke() {
    const out = poke(pokes, Date.now());
    pokes = out.pokes;
    jump();
    clearTimeout(laughTimer);
    if (out.dizzy) {
      clearTimeout(dizzyTimer);
      state = {...state, dizzy: true, laughing: false};
      dizzyTimer = window.setTimeout(() => { state = {...state, dizzy: false}; paint(); }, 1600);
    } else {
      state = {...state, laughing: true};
      laughTimer = window.setTimeout(() => { state = {...state, laughing: false}; paint(); }, 900);
    }
    paint();
  }

  if (interativa) el.addEventListener('click', onPoke);
  paint();
  return {
    el,
    set(next) {
      const wasHappy = state.mood === 'feliz';
      state = {...state, ...next};
      paint();
      if (state.mood === 'feliz' && !wasHappy) celebrate();
    },
    look(dx, dy) { pointer = [dx, dy]; paint(); },
    lookAt(event) {
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      pointer = lookAtPointer(box, event.clientX, event.clientY);
      paint();
    },
    jump,
    celebrate,
    tally,
  };
}

/* Os humores que o CSS do trio desenha (os rostos de `data-humor`). */
const HUMORES = ['normal', 'feliz', 'pensando', 'aflita', 'sono', 'escrevendo', 'atento', 'lendo'];

/**
 * Uma mascote pequena e parada, como texto (para lugares que se repintam por
 * `innerHTML`, como a marca de "pensando" do chat). Decorativa: o texto ao lado
 * diz o estado. Pisca pelo CSS, e o piscar para com movimento reduzido.
 * @param {{personagem:string, humor?:import('./mascote-humor.mjs').MascoteHumor, tamanho:number}} options
 * @returns {string}
 * @example mark.innerHTML=mascoteMarkup({personagem:'integral',humor:'pensando',tamanho:20})
 */
export function mascoteMarkup({personagem, humor = 'normal', tamanho}) {
  const {draw} = personagemOf(personagem);
  if (!HUMORES.includes(humor)) throw new Error(`humor da mascote desconhecido: ${JSON.stringify(humor)}; esperado um destes: ${HUMORES.join(', ')}`);
  return `<span class="mascote mascote-${personagem}" data-humor="${humor}" style="--fo-size:${tamanho}px" aria-hidden="true">${draw(`mascote${++serial}`)}</span>`;
}
