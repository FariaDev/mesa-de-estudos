// @ts-check
/* Primeira abertura em tela cheia (#64, docs/design/setup-guia-r1/Setup-passos.dc.html):
   a parte sem DOM. Seis passos, um por vez — boas-vindas, como a Mesa
   funciona (quatro quadros), nome, PDFs, tutor (opcional) e pronto —, o que
   trava o botão, o texto dele, a trilha, a fala e o humor da mascote.

   Pela ADR 0001 isto é interface e mora em JS com teste. A invariante ("só
   cria com nome e pasta") é do núcleo `core/firstrun.bend`; quem cria é o
   `first-run.mjs`, que pergunta ao núcleo antes. */

export const STEPS = /** @type {const} */ (['welcome', 'tour', 'name', 'folder', 'tutor', 'ready']);
/** @typedef {typeof STEPS[number]} SetupStep */

/* Os quatro quadros do passeio: a região do desenho que acende, quem do trio
   apresenta e com que humor. A ∫ lê junto, o Σ organiza a resolução e o ∇,
   curioso, aponta onde perguntar e onde achar as coisas. */
export const TOUR = /** @type {const} */ ([
  {id: 'read', region: 'readers', lead: 'integral', humor: 'reading'},
  {id: 'write', region: 'writer', lead: 'sigma', humor: 'writing'},
  {id: 'ask', region: 'tutor', lead: 'nabla', humor: 'normal'},
  {id: 'where', region: 'top', lead: 'nabla', humor: 'hint'},
]);

/** @typedef {'integral'|'sigma'|'nabla'} SetupLead */

/* Quem fica em cena fora do passeio: o Σ conta os itens (nome), o ∇ procura a
   pasta e a ∫ apresenta o tutor. Boas-vindas e Pronto são do trio. */
/** @type {Record<string, SetupLead>} */
const STEP_LEAD = {welcome: 'integral', name: 'sigma', folder: 'nabla', tutor: 'integral', ready: 'sigma'};

/**
 * @typedef {object} SetupState
 * @property {number} step índice em STEPS
 * @property {number} frame quadro do passeio (só no passo "tour")
 * @property {string} name nome digitado
 * @property {string} folder pasta dos PDFs ('' sem pasta)
 * @property {number} pdfCount PDFs na pasta
 * @property {boolean} online o tutor está ligado
 * @property {boolean} alert algo está sendo arrastado para a tela
 * @property {boolean} writing digitando o nome agora
 * @property {boolean} sleepy parada há um tempo
 */

const isBlank = (/** @type {string} */ value) => !String(value ?? '').trim();

/**
 * O estado do começo. Quem já tem a pasta de dados e só ficou sem matéria
 * ("empty", por exemplo depois de apagar todas) já conhece a Mesa: começa no nome.
 * @param {string} kind "setup" ou "empty" (o `entry` do núcleo)
 * @returns {SetupState}
 * @example initialSetup('empty').step // 2
 */
export function initialSetup(kind) {
  return {step: kind === 'empty' ? STEPS.indexOf('name') : 0, frame: 0, name: '', folder: '', pdfCount: 0, online: false, alert: false, writing: false, sleepy: false};
}

/**
 * Tira a pasta escolhida por engano (#70): o passo PDFs volta ao quadro vazio
 * e o botão principal trava de novo.
 * @param {SetupState} state
 * @returns {SetupState}
 * @example clearFolder({...initialSetup('setup'), folder: '/c', pdfCount: 2}).folder // ''
 */
export function clearFolder(state) {
  return {...state, folder: '', pdfCount: 0, alert: false};
}

/** @param {SetupState} state @returns {SetupStep} */
export const stepId = (state) => STEPS[state.step];

/**
 * O botão principal está travado? Nome e pasta são obrigatórios; o tutor não.
 * @param {SetupState} state
 * @returns {boolean}
 * @example setupBlocked({...initialSetup('setup'), step: 2}) // true
 */
export function setupBlocked(state) {
  const id = stepId(state);
  if (id === 'name') return isBlank(state.name);
  if (id === 'folder') return isBlank(state.folder);
  if (id === 'ready') return isBlank(state.name) || isBlank(state.folder);
  return false;
}

/**
 * Avança: o passeio vai quadro a quadro; o último passo não avança (cria a
 * matéria, quem decide é o `first-run.mjs`). Travado, não sai do lugar.
 * @param {SetupState} state
 * @returns {SetupState}
 * @example nextSetup(initialSetup('setup')).step // 1
 */
export function nextSetup(state) {
  if (setupBlocked(state)) return state;
  if (stepId(state) === 'tour' && state.frame < TOUR.length - 1) return {...state, frame: state.frame + 1};
  if (state.step >= STEPS.length - 1) return state;
  return {...state, step: state.step + 1, frame: 0, alert: false};
}

/**
 * Volta: dentro do passeio volta um quadro; do nome volta ao último quadro.
 * @param {SetupState} state
 * @returns {SetupState}
 * @example backSetup({...initialSetup('setup'), step: 2}).frame // 3
 */
export function backSetup(state) {
  if (stepId(state) === 'tour' && state.frame > 0) return {...state, frame: state.frame - 1};
  if (state.step === 0) return state;
  const step = state.step - 1;
  return {...state, step, frame: STEPS[step] === 'tour' ? TOUR.length - 1 : 0, alert: false};
}

/**
 * Vai direto a um passo ("Como a Mesa funciona" leva ao passeio; "Pular a explicação", ao nome).
 * @param {SetupState} state
 * @param {SetupStep} id
 * @returns {SetupState}
 */
export function goToStep(state, id) {
  return {...state, step: STEPS.indexOf(id), frame: 0, alert: false};
}

/**
 * A chave do texto do botão principal.
 * @param {SetupState} state
 * @returns {string}
 * @example primaryKey({...initialSetup('setup'), step: 5}) // 'setup.create'
 */
export function primaryKey(state) {
  const id = stepId(state);
  if (id === 'welcome') return 'setup.start';
  if (id === 'tour') return 'setup.next';
  if (id === 'tutor') return state.online ? 'setup.continue' : 'setup.skip';
  if (id === 'ready') return 'setup.create';
  return 'setup.continue';
}

/**
 * O que falta, ao lado do botão travado ('' quando nada falta).
 * @param {SetupState} state
 * @returns {string}
 */
export function hintKey(state) {
  const id = stepId(state);
  if (id === 'name' && isBlank(state.name)) return 'firstrun.hint.name';
  if (id === 'folder' && isBlank(state.folder)) return 'firstrun.hint.folder';
  return '';
}

/**
 * A trilha de passos: o feito ganha ✓, o atual fica marcado.
 * @param {SetupState} state
 * @returns {Array<{id:SetupStep, status:'done'|'current'|'todo', mark:string}>}
 */
export function setupTrail(state) {
  return STEPS.map((id, i) => {
    const status = i < state.step ? 'done' : i === state.step ? 'current' : 'todo';
    return {id, status, mark: status === 'done' ? '✓' : String(i + 1)};
  });
}

/**
 * A fala no balão: chave e argumentos. Diz o que aconteceu ou o que fazer.
 * @param {SetupState} state
 * @returns {{key:string, args?:Record<string,string|number>}}
 * @example speechOf(initialSetup('setup')).key // 'setup.say.welcome'
 */
export function speechOf(state) {
  if (state.sleepy) return {key: 'setup.say.sleep'};
  const id = stepId(state);
  if (id === 'welcome') return {key: 'setup.say.welcome'};
  if (id === 'tour') return {key: `setup.tour.${TOUR[state.frame].id}.say`};
  if (id === 'name') return nameSpeech(state);
  if (id === 'folder') return folderSpeech(state);
  if (id === 'tutor') return {key: state.online ? 'setup.say.tutorOn' : 'setup.say.tutorOff'};
  return {key: 'setup.say.ready'};
}

/** @param {SetupState} state */
function nameSpeech(state) {
  const name = state.name.trim();
  return name ? {key: 'setup.say.named', args: {name}} : {key: 'setup.say.name'};
}

/** @param {SetupState} state */
function folderSpeech(state) {
  if (state.alert) return {key: 'setup.say.drop'};
  if (isBlank(state.folder)) return {key: 'setup.say.folder'};
  if (!state.pdfCount) return {key: 'setup.say.emptyFolder'};
  return {key: 'setup.say.pdfs', args: {count: state.pdfCount}};
}

/**
 * O que a mascote grande mostra (os campos de `MascoteState`, em `mascote.mjs`).
 * `milestone` sobe a cada passo ou quadro vencido: cada subida é um pulo.
 * @param {SetupState} state
 * @returns {{mood:'normal'|'feliz'|'pensando', wave:boolean, sleepy:boolean, writing:boolean, reading:boolean, alert:boolean, milestone:number}}
 */
export function mascoteOf(state) {
  const id = stepId(state);
  const frame = id === 'tour' ? TOUR[state.frame] : null;
  const waiting = id === 'folder' && isBlank(state.folder) && !state.alert;
  return {
    mood: id === 'ready' ? 'feliz' : waiting ? 'pensando' : 'normal',
    wave: id === 'welcome',
    sleepy: state.sleepy,
    writing: state.writing || frame?.humor === 'writing',
    reading: frame?.humor === 'reading',
    alert: state.alert || frame?.humor === 'hint',
    milestone: state.step * 4 + (frame ? state.frame : 0),
  };
}

/**
 * Quem está em cena: o trio junto (Boas-vindas e Pronto) ou um só, grande.
 * `lead` é quem fala e pega o humor do passo; no trio, é o do meio do olhar.
 * @param {SetupState} state
 * @returns {{trio:boolean, lead:SetupLead}}
 * @example castOf(initialSetup('empty')) // {trio:false, lead:'sigma'}
 */
export function castOf(state) {
  const id = stepId(state);
  const lead = id === 'tour' ? TOUR[state.frame].lead : STEP_LEAD[id];
  return {trio: id === 'welcome' || id === 'ready', lead};
}

/**
 * A região do desenho da Mesa que acende no quadro atual ('' fora do passeio).
 * @param {SetupState} state
 * @returns {string}
 */
export function activeRegion(state) {
  return stepId(state) === 'tour' ? TOUR[state.frame].region : '';
}

/**
 * Os nomes de PDF que cabem na linha da pasta escolhida, e quantos sobram.
 * @param {string[]} names nomes em ordem
 * @param {number} count total de PDFs na pasta
 * @returns {{shown:string[], more:number}}
 * @example pdfPreview(['a.pdf','b.pdf','c.pdf','d.pdf','e.pdf'], 12) // {shown:['a.pdf','b.pdf','c.pdf','d.pdf'], more:8}
 */
export function pdfPreview(names, count) {
  const shown = (names || []).slice(0, 4);
  return {shown, more: Math.max(0, (Number(count) || 0) - shown.length)};
}
