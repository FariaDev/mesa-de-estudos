'use strict';

/* Quadro do GeoGebra por uso do tutor (#53): o host do applet entrega o que lê
   do quadro e este módulo aplica a regra do núcleo (`core/ggbboard.bend`):
   quando limpar, a origem do que fica guardado e o que "voltar" troca. Aqui
   ficam só os fatos do mundo — assinatura do desenho, o histórico em disco
   (por matéria) e os pedidos ao applet. Nada de Electron: o applet e o disco
   entram por parâmetro, e os testes os trocam por fakes com nome
   (`tests/fixtures/fake-ggb-applet.cjs`). */
const fs = require('node:fs');
const path = require('node:path');
const core = require('./src/generated/ggbboard.core.js').default;
const {toNat} = require('./src/bend-nat.mjs');

/**
 * @typedef {{b64: string, origin: 'tutor'|'student', at: number}} KeptConstruction
 * @typedef {{summary: () => Promise<{objects: string, count: number}>, snapshot: () => Promise<string>,
 *   load: (b64: string) => Promise<void>, clear: () => Promise<void>}} BoardApplet
 * @typedef {{read: (key: string) => KeptConstruction[], write: (key: string, list: KeptConstruction[]) => void}} KeptStore
 * @typedef {{kept: number, canGoBack: boolean}} BoardStatus
 */

const originName = (origin) => (origin.$ === 'FromTutor' ? 'tutor' : 'student');

/**
 * @param {{applet: BoardApplet, store: KeptStore, key: () => string, onChange?: (status: BoardStatus & {note?: string}) => void, now?: () => number}} deps
 * @example
 * const board = createGgbBoard({applet, store, key: () => 'Calc'});
 * board.newRequest();
 * await board.beforeUse({kind: 'run', continues: false}); // limpa e guarda se havia algo
 */
function createGgbBoard({applet, store, key, onChange = () => {}, now = Date.now}) {
  let request = 0;
  let usedRequest = -1;
  /* Assinatura (lista de objetos) logo depois do último comando do tutor, por
     matéria: se o quadro ainda a tem, nada mudou desde o tutor. */
  const tutorSignature = new Map();

  const list = () => store.read(key());
  const status = () => ({kept: list().length, canGoBack: core.canGoBack(toNat(list().length))});
  const emit = (note) => onChange({...status(), ...(note ? {note} : {})});

  function pushKept(item) {
    const next = [item, ...list()].slice(0, Number(core.keptLimit()));
    store.write(key(), next);
  }

  async function keepAndClear(summary) {
    const known = tutorSignature.get(key());
    const origin = core.originOf(known !== undefined, known === summary.objects);
    pushKept({b64: await applet.snapshot(), origin: originName(origin), at: now()});
    await applet.clear();
    tutorSignature.delete(key());
    return origin;
  }

  return {
    /** Uma mensagem nova do aluno chegou: a próxima execução do tutor pode limpar de novo. */
    newRequest() { request += 1; },

    /**
     * Antes de o tutor usar o applet. Só `kind: 'run'` mexe no quadro; ler nunca limpa.
     * @param {{kind: 'run'|'read', continues?: boolean}} use
     * @returns {Promise<{cleared: boolean, origin?: 'tutor'|'student'}>}
     */
    async beforeUse({kind, continues = false}) {
      const summary = await applet.summary();
      const run = kind === 'run';
      const plan = core.boardPlan({$: run ? 'UseRun' : 'UseRead'}, continues === true, usedRequest === request, summary.count === 0);
      if (run) usedRequest = request;
      if (plan.$ !== 'PlanFresh') return {cleared: false};
      const origin = await keepAndClear(summary);
      emit(core.freshNote(origin));
      return {cleared: true, origin: originName(origin)};
    },

    /** Depois de um comando do tutor: a lista de objetos vira a assinatura "do tutor". */
    afterRun(summary) { tutorSignature.set(key(), String(summary?.objects ?? '')); },

    /** "Voltar à construção anterior": restaura a mais recente; o que estava no quadro toma o lugar dela. */
    async restore() {
      const kept = list();
      const summary = await applet.summary();
      const plan = core.restorePlan(toNat(kept.length), summary.count === 0);
      if (plan.$ === 'RestoreNone') return {restored: false, ...status()};
      const [previous, ...rest] = kept;
      const swapped = plan.$ === 'RestoreSwap'
        ? [{b64: await applet.snapshot(), origin: originName(core.originOf(tutorSignature.has(key()), tutorSignature.get(key()) === summary.objects)), at: now()}, ...rest]
        : rest;
      await applet.load(previous.b64);
      store.write(key(), swapped);
      if (previous.origin === 'tutor') tutorSignature.set(key(), (await applet.summary()).objects);
      else tutorSignature.delete(key());
      emit(core.restoredNote());
      return {restored: true, ...status()};
    },

    /** A matéria mudou: os marcadores de resposta e de desenho do tutor não valem para o quadro de outra. */
    reset() { usedRequest = -1; tutorSignature.clear(); },

    status,
    emit,
  };
}

const KEPT_MAX_B64 = 400000;
const keptFileName = (key) => `${String(key || 'default').replace(/[^\w.-]/g, '_')}.kept.json`;
const isKept = (item) => !!item && typeof item.b64 === 'string' && item.b64.length > 0 && item.b64.length <= KEPT_MAX_B64
  && (item.origin === 'tutor' || item.origin === 'student') && Number.isFinite(item.at);

/**
 * Histórico em disco, um arquivo por matéria: `<dir>/<chave>.kept.json`. Arquivo
 * ausente ou estragado vale como "nada guardado" (o histórico é conforto, não dado do aluno).
 * @param {string} dir
 * @param {(message: string) => void} [log]
 * @returns {KeptStore}
 * @example createKeptStore(path.join(runtime, 'ggb')).read('Calc') // []
 */
function createKeptStore(dir, log = () => {}) {
  return {
    read(key) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(dir, keptFileName(key)), 'utf8'));
        return Array.isArray(parsed) ? parsed.filter(isKept) : [];
      } catch { return []; }
    },
    write(key, items) {
      const file = path.join(dir, keptFileName(key));
      try {
        if (!items.length) { fs.rmSync(file, {force: true}); return; }
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(file, JSON.stringify(items));
      } catch (error) { log(`construções guardadas sem gravar (${String(key)}): ${error.message}`); }
    },
  };
}

module.exports = {createGgbBoard, createKeptStore, keptFileName};
