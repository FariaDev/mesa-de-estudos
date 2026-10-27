import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/* Texto de interface no núcleo passa pelo catálogo (`M.msg`). O vazio do
   caderno tinha "Copiar · Citar" fixo e aparecia em português com a Mesa em
   inglês (v1.0.2). Esta trava pega qualquer `V.viewText("...")` com letras. */
const CORE = fileURLToPath(new URL('../../core/', import.meta.url));

// Não se traduz: nome de ícone, nome próprio e o valor "auto" do seletor.
const UNTRANSLATED = new Set(['×', 'check', 'GeoGebra', 'auto']);

/** @returns {string[]} linhas `arquivo:linha: "texto"` com texto fixo traduzível */
function literalViewTexts() {
  const found = [];
  for (const file of readdirSync(CORE).filter((name) => name.endsWith('.bend'))) {
    readFileSync(CORE + file, 'utf8').split('\n').forEach((line, index) => {
      for (const [, text] of line.matchAll(/viewText\("([^"]*)"\)/g)) {
        if (/\p{L}/u.test(text) && !UNTRANSLATED.has(text)) found.push(`${file}:${index + 1}: "${text}"`);
      }
    });
  }
  return found;
}

test('núcleo não escreve texto de interface fixo em V.viewText', () => {
  const found = literalViewTexts();
  assert.deepEqual(found, [], `texto fixo recebido:\n${found.join('\n')}\nesperado: V.viewText(M.msg("chave")) com a chave nos dois catálogos`);
});
