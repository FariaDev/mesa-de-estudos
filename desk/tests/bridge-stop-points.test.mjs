/* Prova — quem para a ponte invalida o voo de connect (#r5-D). Cada ponto do
   renderer que faz o main destruir a ponte (`stopBridge`) precisa invalidar o
   voo corrente no mesmo trecho, senão o resultado tardio do voo velho escreve
   por cima da sessão nova. Os testes de estado não cobrem os call sites (o
   e8b39a52 continuava verde com todos revertidos); este percorre a lista de
   pontos de uma vez.

   Onde o relink/parada religa de fato (provedor, chave, promoção Livre,
   atualização de componente), o ponto usa `reconnectAfterBridgeStop`, que
   invalida E religa a sessão corrente. Exceção por desenho:
   `pi-connect-cancel` NÃO invalida — o voo corrente precisa continuar para o
   catch pintar "desligado" (state.mjs cancelConnect).

   Rodar: node --test --test-force-exit tests/bridge-stop-points.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const INVALIDATES = /invalidateConnect\(|reconnectAfterBridgeStop\(/;
const RELINKS = /reconnectAfterBridgeStop\(/;
/* Metade do trecho lido para cada lado da âncora: cobre a distância real do
   ponto à marca (até ~400 caracteres, comentário incluído) sem alcançar o
   ponto vizinho (o mais próximo está a ~1850 caracteres). */
const TRECHO = 500;

const POINTS = [
  {where: 'troca de matéria (switch-course)', file: 'src/state.mjs', anchor: 'window.desk.switchCourse(id)'},
  {where: 'save-config das Configurações (adoptSavedConfig)', file: 'src/main.mjs', anchor: 'async function adoptSavedConfig'},
  {where: 'abrir conversa da biblioteca', file: 'src/main.mjs', anchor: 'window.desk.libraryChatOpen'},
  {where: 'abrir resultado da busca de estudo', file: 'src/main.mjs', anchor: 'window.desk.studySearchOpen'},
  {where: 'aplicar restauração de backup', file: 'src/main.mjs', anchor: 'window.desk.backupRestoreApply'},
  {where: 'religar tutor por troca de idioma', file: 'src/main.mjs', anchor: 'window.desk.languageRelink'},
  {where: 'sessão nova', file: 'src/course-conversations.mjs', anchor: 'window.desk.newSession('},
  {where: 'abrir conversa da matéria', file: 'src/course-conversations.mjs', anchor: 'window.desk.openSession(file)'},
  {where: 'relink de provedor OpenCode (finish)', file: 'src/opencode-providers.mjs', anchor: 'if(next?.relinked)', must: RELINKS},
  {where: 'chave OpenCode aprovada (startWithKey)', file: 'src/free-models.mjs', anchor: 'export async function startWithKey', must: RELINKS},
  {where: 'remover chave OpenCode', file: 'src/free-models.mjs', anchor: 'window.desk.opencodeKeyRemove', must: RELINKS},
  {where: 'promoção Livre→matéria (free-promote)', file: 'src/free-study.mjs', anchor: 'const leftFree=', must: RELINKS},
  {where: 'atualização de componente (toolHost.relink)', file: 'src/tool-notices.mjs', anchor: 'window.desk.toolUpdateRun', must: RELINKS},
  {where: 'save-config da primeira abertura', file: 'src/first-run.mjs', anchor: 'window.desk.saveConfig'},
];

const EXCLUSIONS = [
  {where: 'cancelar connect (pi-connect-cancel) segue corrente por desenho', file: 'src/state.mjs', anchor: 'export async function cancelConnect'},
];

/** @param {string} file caminho relativo a `desk/` @returns {string} o fonte */
function sourceOf(file) {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
}

/** @param {string} source @param {string} anchor @returns {number} posição única da âncora */
function anchorAt(source, anchor) {
  const at = source.indexOf(anchor);
  assert.notEqual(at, -1, `âncora não encontrada: ${anchor}`);
  assert.equal(at, source.lastIndexOf(anchor), `âncora ambígua (mais de uma ocorrência): ${anchor}`);
  return at;
}

test('quem para a ponte invalida o voo de connect', async (t) => {
  for (const point of POINTS) {
    await t.test(point.where, () => {
      const source = sourceOf(point.file);
      const at = anchorAt(source, point.anchor);
      const trecho = source.slice(Math.max(0, at - TRECHO), at + TRECHO);
      assert.match(trecho, point.must ?? INVALIDATES,
        `${point.file} para a ponte em "${point.anchor}" sem invalidar o voo no trecho`);
    });
  }
  for (const point of EXCLUSIONS) {
    await t.test(point.where, () => {
      const source = sourceOf(point.file);
      const at = anchorAt(source, point.anchor);
      const trecho = source.slice(Math.max(0, at - TRECHO), at + TRECHO);
      assert.doesNotMatch(trecho, INVALIDATES,
        `${point.file} invalida em "${point.anchor}": o voo precisa seguir corrente para o catch pintar desligado`);
    });
  }
});
