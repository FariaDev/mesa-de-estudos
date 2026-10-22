/* Diagnósticos do material (#41 fase 3): o template devolve mensagem marcada
   (chave + argumentos), e a tela traduz no idioma da interface. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {prepareMaterialMarkdown} from '../src/materials/template.mjs';

const translate = (language, value) => createI18n({catalogs: {'pt-BR': ptBR, en}, language}).text(value);

test('título rebaixado vira frase nos dois idiomas, com plural', () => {
  const result = prepareMaterialMarkdown({title: 'Limites', markdown: '# Limites\n\n## Seção\n\n### Detalhe\n'});
  const shifted = result.diagnostics.find((entry) => entry.code === 'headings-shifted');
  assert.ok(shifted, 'diagnóstico de títulos rebaixados');
  assert.equal(translate('en', shifted.message), '2 content headings moved down one level so there is a single H1.');
  assert.equal(translate('pt-BR', shifted.message), '2 títulos do conteúdo rebaixados um nível para existir um único H1.');
});

test('heading repetido: a mensagem não traz português quando a interface está em inglês', () => {
  const result = prepareMaterialMarkdown({title: 'Limites', markdown: '# Limites\n\nTexto.\n'});
  const repeated = result.diagnostics.find((entry) => entry.code === 'heading-deduplicated' || /repet/i.test(translate('pt-BR', entry.message)));
  assert.ok(repeated, 'diagnóstico do heading repetido');
  assert.equal(translate('en', repeated.message), 'The repeated heading at the start was removed; the title appears once.');
});
