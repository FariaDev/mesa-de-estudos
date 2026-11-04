/* Texto fixo da interface com até 80 caracteres (#90), sem Electron.

   O inventário da issue #90 mediu 105 textos que aparecem sempre na tela. O
   guia (`guide.*`) e os erros (`err.*`) são os lugares certos para texto
   longo; mensagens transitórias (toast, atividade, status de motor, fila,
   erros de fluxo) e tooltips/aria também não são densidade de tela. O resto
   — lead, vazio, nota e rótulo que ficam à vista — cabe em 80 caracteres.

   Exceção entra só com o motivo na linha. O teto vale para os dois idiomas:
   a frase em inglês costuma ser alguns caracteres maior e não pode escapar. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

export const MAX_FIXED_TEXT = 80;

/* Prefixos que não são texto fixo de tela. */
const TRANSIENT_PREFIX = /^(?:guide|err|toast|activity|update|phone)\.|^backup\.msg\.|^review\.(?:explain|graded|error|draft)\.|^free\.(?:diag|math|counts|preview)\.|^material\.diag\.|^keys\.status\.|^(?:claude|opencode|turn|queue)\.|^sidechat\.(?:note|unavailable)|^stats\.warn\.|^studyctx\.captureStale\.|^tutor\.error\.|^check\.absent\.|^conferir\.|^ggb\.|^mention\.|^more\.compactNow\.|^controls\./;

/* Tooltips (`title`), dicas (`tip`) e nomes acessíveis (`aria-*`). */
const NON_VISIBLE_SUFFIX = /(?:Title|title|Tip|tip|Aria[A-Za-z]*|aria[A-Za-z]*)$/;

/* Texto que vai ao modelo, não à pessoa. */
const MODEL_TEXT = /prompt|instruction|checkPrompt/;

/** Exceções com o motivo de cada uma. */
export const EXCEPTIONS = new Map([
  ['releaseNotes.login.goHint', 'janela de novidades: preço, modelos e como conectar em uma frase só'],
  ['releaseNotes.todo.loginFoot', 'janela de novidades: frase inteira que explica a mudança do Pi para o OpenCode'],
  ['releaseNotes.todo.loginHint', 'janela de novidades: frase inteira que explica a mudança do Pi para o OpenCode'],
  ['releaseNotes.login.claudeHint', 'janela de novidades: frase inteira que explica a mudança do Pi para o OpenCode'],
  ['releaseNotes.login.grokHint', 'janela de novidades: frase inteira que explica a mudança do Pi para o OpenCode'],
  ['releaseNotes.opencode.lead', 'janela de novidades: frase inteira que explica a mudança do Pi para o OpenCode'],
  ['about.credit.chartjs', 'crédito legal (licença do Chart.js)'],
  ['about.credit.dompurify', 'crédito legal (licença do DOMPurify)'],
  ['about.credit.geogebra', 'crédito legal (licença do GeoGebra)'],
  ['about.credit.marked', 'crédito legal (licença do marked)'],
  ['about.credit.lobeIcons', 'crédito legal (licença do Lobe Icons)'],
  ['about.credit.lucide', 'crédito legal (licença do Lucide)'],
  ['about.credit.stix', 'crédito legal (licença da STIX)'],
  ['about.credit.t3', 'crédito legal (licença do T3 Code)'],
  ['about.licenseT3', 'texto de licença, copiado na íntegra'],
  ['backup.restore.lead', 'aviso de destruição: restaurar preserva uma cópia do estado anterior'],
  ['firstrun.tutor.opencodeOldConfirm', 'confirmação de atualização: o binário é usado por outros programas e será substituído'],
]);

/** Chaves acima do teto que uma pessoa lê fixo na tela, com o tamanho em cada idioma. */
export function longFixedTexts(ptCatalog = ptBR, enCatalog = en) {
  const rows = [];
  for (const [key, phrase] of Object.entries(ptCatalog)) {
    if (TRANSIENT_PREFIX.test(key) || NON_VISIBLE_SUFFIX.test(key) || MODEL_TEXT.test(key)) continue;
    if (EXCEPTIONS.has(key)) continue;
    const sizes = [phrase, enCatalog[key] ?? ''].map((text) => [...text].length);
    if (sizes.some((size) => size > MAX_FIXED_TEXT)) rows.push({key, pt: sizes[0], en: sizes[1]});
  }
  return rows;
}

test('toda exceção tem motivo e continua passando do teto em algum idioma', () => {
  for (const [key, reason] of EXCEPTIONS) {
    assert.ok(reason.trim().length > 10, `${key}: exceção sem motivo`);
    const sizes = [ptBR[key], en[key]].filter((text) => typeof text === 'string').map((text) => [...text].length);
    assert.ok(sizes.some((size) => size > MAX_FIXED_TEXT), `${key}: não passa de ${MAX_FIXED_TEXT} caracteres; tire da lista`);
  }
});

test('texto fixo na tela cabe em 80 caracteres nos dois idiomas', () => {
  const rows = longFixedTexts();
  const detail = rows.map((row) => `${row.key}: pt ${row.pt}, en ${row.en}`).join('\n');
  assert.deepEqual(rows, [], `texto fixo acima de ${MAX_FIXED_TEXT} caracteres sem exceção:\n${detail}`);
});
