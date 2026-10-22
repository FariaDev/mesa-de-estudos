// @ts-check
import {createMascote,mascoteNameKey} from './mascote.mjs';
import {t} from './ui-text.mjs';

/* O palco da primeira abertura (#64): o trio ∫ Σ ∇ junto nas Boas-vindas e no
   Pronto, e um só, grande, nos outros passos (quem fica em cena vem de
   `castOf`, em setup-flow.mjs). Os três ficam montados o tempo todo; trocar de
   passo só esconde e redimensiona, para o piscar de cada um não recomeçar a
   cada clique. */

/** @typedef {import('./setup-flow.mjs').SetupLead} SetupLead */
/** @typedef {import('./mascote.mjs').MascoteState} MascoteState */

/** Da esquerda para a direita, na ordem em que aparecem juntos. */
export const CAST = /** @type {const} */ (['integral', 'sigma', 'nabla']);
const SOLO_SIZE = 240;
/* Três de 96 px cabem na coluna de 290 px da mascote (first-run.css). */
const TRIO_SIZE = 96;
/* Em repouso, os de fora olham para o do meio: um deslocamento além do alcance
   do olho (EYE_REACH em mascote-humor.mjs) deixa a pupila no canto. */
const GLANCE = 20;
/* O pulo e as faíscas de "Criar a matéria" duram `--t-slow * 2.4`; a tela sai
   logo depois, para a comemoração ser vista. */
const CELEBRATE_MS = 760;

const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * O olhar de repouso de cada um: no trio, os de fora olham para o do meio.
 * @param {SetupLead} id
 * @param {boolean} trio
 * @returns {[number, number]}
 * @example restLook('integral', true) // [20, 0]
 */
export function restLook(id, trio) {
  if (!trio || id === 'sigma') return [0, 0];
  return [id === 'integral' ? GLANCE : -GLANCE, 0];
}

/**
 * O estado de cada um em cena: quem lidera pega tudo do passo; no trio, os
 * outros pegam o humor e o sono, mas não acenam nem escrevem.
 * @param {MascoteState} look o humor do passo (`mascoteOf`)
 * @param {boolean} leads
 * @returns {MascoteState}
 * @example memberLook({mood:'normal',wave:true}, false).wave // false
 */
export function memberLook(look, leads) {
  return leads ? look : {...look, wave: false, writing: false, reading: false, alert: false};
}

/* A ponta do balão não chega à borda arredondada dele. */
const TAIL_INSET = 18;

/**
 * Onde fica a ponta do balão, em px da borda esquerda dele: em cima do meio de
 * quem fala, sem sair da parte reta da borda (#70: no trio ela apontava para o
 * Σ mesmo quando quem falava era a ∫).
 * @param {{left:number, width:number}} speech caixa do balão na tela
 * @param {{left:number, width:number}} speaker caixa de quem fala
 * @returns {number}
 * @example tailX({left: 100, width: 270}, {left: 110, width: 96}) // 58
 */
export function tailX(speech, speaker) {
  const center = speaker.left + speaker.width / 2 - speech.left;
  return Math.round(Math.min(speech.width - TAIL_INSET, Math.max(TAIL_INSET, center)));
}

/**
 * Monta o trio em `mount` e devolve o controle do palco.
 * @param {HTMLElement} mount
 * @param {HTMLElement | null} [speech] o balão, para a ponta seguir quem fala
 * @example const cast=createSetupCast($('#setup-mascote'), $('#setup-speech'));cast.paint({trio:true,lead:'integral'},mascoteOf(state));
 */
export function createSetupCast(mount, speech = null) {
  const members = Object.fromEntries(CAST.map((id) => [id, createMascote({personagem: id, tamanho: SOLO_SIZE, label: t(mascoteNameKey(id))})]));
  mount.replaceChildren(...CAST.map((id) => members[id].el));
  let cast = {trio: true, lead: /** @type {SetupLead} */ ('integral')};
  const onStage = () => (cast.trio ? [...CAST] : [cast.lead]);

  function rest() {
    for (const id of onStage()) members[id].look(...restLook(id, cast.trio));
  }

  /** @param {{clientX:number, clientY:number}} point */
  function lookAt(point) {
    for (const id of onStage()) members[id].lookAt(point);
  }

  /* Medido depois do layout: o tamanho de quem está em cena acabou de mudar. */
  function aim() {
    if (!speech) return;
    requestAnimationFrame(() => {
      const lead = members[cast.lead].el.getBoundingClientRect();
      const box = speech.getBoundingClientRect();
      if (lead.width && box.width) speech.style.setProperty('--tail-x', `${tailX(box, lead)}px`);
    });
  }

  return {
    /**
     * @param {{trio:boolean, lead:SetupLead}} next quem está em cena
     * @param {MascoteState} look o humor do passo
     */
    paint(next, look) {
      const moved = next.trio !== cast.trio || next.lead !== cast.lead;
      cast = next;
      mount.dataset.cast = cast.trio ? 'trio' : 'solo';
      for (const id of CAST) {
        const {el} = members[id];
        el.hidden = !onStage().includes(id);
        el.style.setProperty('--fo-size', `${cast.trio ? TRIO_SIZE : SOLO_SIZE}px`);
        el.setAttribute('aria-label', t(mascoteNameKey(id)));
        members[id].set(memberLook(look, id === cast.lead));
      }
      if (moved) rest();
      aim();
    },
    aim,
    lookAt,
    /** Olha para o meio de um elemento (o campo com foco, o botão do passo). */
    lookAtElement(/** @type {Element} */ el) {
      const box = el.getBoundingClientRect();
      if (box.width) lookAt({clientX: box.left + box.width / 2, clientY: box.top + box.height / 2});
    },
    rest,
    /** Um passo vencido: o Σ marca o ✓ se estiver em cena; senão quem lidera pula. */
    tally() {
      if (onStage().includes('sigma')) members.sigma.tally();
      else members[cast.lead].jump();
    },
    /** Um quadro do passeio vencido: quem lidera pula. */
    jump() {
      members[cast.lead].jump();
    },
    /**
     * "Criar a matéria": os três em cena comemoram; resolve quando dá para sair.
     * @returns {Promise<void>}
     */
    celebrate() {
      for (const id of onStage()) members[id].celebrate();
      return new Promise((done) => setTimeout(done, reducedMotion() ? 0 : CELEBRATE_MS));
    },
  };
}
