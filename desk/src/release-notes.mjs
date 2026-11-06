// @ts-check

/* Novidades da versão: uma janela depois de atualizar, com o que mudou e o que
   a pessoa precisa fazer. Fica em JS (ADR 0003): não custa nada ao aluno se
   falhar, e a lei só repetiria a comparação. Cada versão com novidade ganha uma
   entrada aqui, com o número exato do `package.json` da release. */

/** @typedef {{icon: string, title: string, body: string}} ReleaseCard */
/** @typedef {{title: string, cards: ReleaseCard[]}} ReleaseGroup */
/** @typedef {{version: string, title: string, lead: string, opencodeSetup?: boolean, groups: ReleaseGroup[]}} ReleaseNote */

/** @type {readonly ReleaseNote[]} */
export const RELEASE_NOTES = Object.freeze([
  {
    version: '1.2.0',
    title: 'releaseNotes.comfort.title',
    lead: 'releaseNotes.comfort.lead',
    groups: [
      {title: 'releaseNotes.comfort.also', cards: [
        {icon: 'plug', title: 'releaseNotes.comfort.login', body: 'releaseNotes.comfort.loginBody'},
        {icon: 'maximize', title: 'releaseNotes.comfort.full', body: 'releaseNotes.comfort.fullBody'},
        {icon: 'messageSquare', title: 'releaseNotes.comfort.continue', body: 'releaseNotes.comfort.continueBody'},
        {icon: 'book', title: 'releaseNotes.comfort.reading', body: 'releaseNotes.comfort.readingBody'},
      ]},
    ],
  },
  {
    version: '1.1.0',
    title: 'releaseNotes.opencode.title',
    lead: 'releaseNotes.opencode.lead',
    opencodeSetup: true,
    groups: [
      {title: 'releaseNotes.opencode.safe', cards: [
        {icon: 'check', title: 'releaseNotes.opencode.safe.study', body: 'releaseNotes.opencode.safe.studyBody'},
        {icon: 'messageSquare', title: 'releaseNotes.opencode.safe.old', body: 'releaseNotes.opencode.safe.oldBody'},
      ]},
      {title: 'releaseNotes.opencode.also', cards: [
        {icon: 'bookmark', title: 'releaseNotes.opencode.also.default', body: 'releaseNotes.opencode.also.defaultBody'},
        {icon: 'chevronDown', title: 'releaseNotes.opencode.also.chat', body: 'releaseNotes.opencode.also.chatBody'},
        {icon: 'board', title: 'releaseNotes.opencode.also.figures', body: 'releaseNotes.opencode.also.figuresBody'},
      ]},
    ],
  },
]);

/**
 * Os três números de uma versão `X.Y.Z`; qualquer outro formato (prerelease,
 * vazio) não é versão de release.
 * @param {unknown} version
 * @returns {number[]|null}
 * @example parseReleaseVersion('1.10.2') // [1, 10, 2]
 * @example parseReleaseVersion('1.1.0-beta') // null
 */
export function parseReleaseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? '').trim());
  return match ? match.slice(1).map(Number) : null;
}

/**
 * Compara duas versões já lidas.
 * @param {number[]} left @param {number[]} right
 * @returns {number} negativo, zero ou positivo
 * @example compareReleaseVersions([1, 9, 0], [1, 10, 0]) // -1
 */
export function compareReleaseVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

/**
 * O que abrir nesta partida e o que guardar como já visto. Instalação nova não
 * vê novidade: a primeira abertura já explica tudo. Quem atualiza de uma versão
 * sem este registro (`seen` vazio) vê todas as notas até a versão atual, porque
 * é justamente quem vem do Pi. Voltar de versão não reabre nada.
 * @param {{seen?: unknown, current?: unknown, firstRun?: boolean, notes?: readonly ReleaseNote[]}} options
 * @returns {{notes: ReleaseNote[], seen: string|null}} `seen: null` = não gravar
 * @example pendingReleaseNotes({seen: '1.0.2', current: '1.1.0'}).notes[0].version // '1.1.0'
 * @example pendingReleaseNotes({seen: '', current: '1.1.0', firstRun: true}) // {notes: [], seen: '1.1.0'}
 */
export function pendingReleaseNotes({seen = '', current = '', firstRun = false, notes = RELEASE_NOTES}) {
  const now = parseReleaseVersion(current);
  if (!now) return {notes: [], seen: null};
  const before = parseReleaseVersion(seen);
  if (before && compareReleaseVersions(before, now) >= 0) return {notes: [], seen: null};
  const version = now.join('.');
  if (firstRun && !before) return {notes: [], seen: version};
  const pending = notes.filter((note) => {
    const at = parseReleaseVersion(note.version);
    return !!at && compareReleaseVersions(at, now) <= 0 && (!before || compareReleaseVersions(at, before) > 0);
  });
  return {notes: pending, seen: version};
}

let seenVersion = '';

/** Carrega a última versão vista, do estado de interface. @param {unknown} value @returns {void} */
export function loadReleaseNotesSeen(value) {
  seenVersion = parseReleaseVersion(value) ? String(value).trim() : '';
}

/** A última versão vista. @returns {string} */
export function releaseNotesSeen() {
  return seenVersion;
}
