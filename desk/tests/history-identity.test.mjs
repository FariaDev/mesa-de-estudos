// Identidade do histórico exibido (#115): mesma sessão + mesmas mensagens +
// mesmos cartões não remontam; qualquer conteúdo diferente remonta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createShownHistory} from '../src/history-shown.mjs';

const require = createRequire(import.meta.url);
const {historyIdentity} = require('../src/history-identity.cjs');

const messages = [
  {role: 'user', content: [{type: 'text', text: 'Pergunta 1'}], timestamp: 1_000},
  {role: 'assistant', content: [{type: 'text', text: 'Resposta 1'}], timestamp: 2_000},
];
const cards = [{id: 'card-1', createdAt: 1_500, kind: 'quiz', status: 'shown'}];

test('mesma sessão, mesmas mensagens e mesmos cartões: identidade igual', () => {
  assert.equal(
    historyIdentity({session: '/rt/opencode-a.json', messages, cards}),
    historyIdentity({session: '/rt/opencode-a.json', messages: structuredClone(messages), cards: structuredClone(cards)}),
  );
});

test('sessão diferente muda a identidade', () => {
  assert.notEqual(
    historyIdentity({session: '/rt/opencode-a.json', messages, cards}),
    historyIdentity({session: '/rt/opencode-b.json', messages, cards}),
  );
});

test('cartão diferente muda a identidade', () => {
  assert.notEqual(
    historyIdentity({session: '/rt/opencode-a.json', messages, cards}),
    historyIdentity({session: '/rt/opencode-a.json', messages, cards: [{...cards[0], status: 'answered'}]}),
  );
});

test('histórico nativo maior muda a identidade', () => {
  const native = [...messages, {role: 'assistant', content: [{type: 'text', text: 'Resposta nova'}], timestamp: 3_000}];
  assert.notEqual(
    historyIdentity({session: '/rt/opencode-a.json', messages, cards}),
    historyIdentity({session: '/rt/opencode-a.json', messages: native, cards}),
  );
});

test('texto trocado no meio muda a identidade mesmo com a mesma quantidade', () => {
  const edited = messages.map((message, index) => index === 0 ? {...message, content: [{type: 'text', text: 'Pergunta corrigida'}]} : message);
  assert.notEqual(
    historyIdentity({session: '/rt/opencode-a.json', messages, cards}),
    historyIdentity({session: '/rt/opencode-a.json', messages: edited, cards}),
  );
});

test('uuid do fio não entra: o descritor perde o id e o nativo o traz', () => {
  const native = messages.map((message, index) => ({...message, uuid: `msg_${index}`}));
  assert.equal(
    historyIdentity({session: '/rt/opencode-a.json', messages, cards}),
    historyIdentity({session: '/rt/opencode-a.json', messages: native, cards}),
  );
});

test('argumentos de ferramenta comparam por conteúdo, não por ordem de chave', () => {
  const left = [{role: 'assistant', content: [{type: 'toolCall', id: 't1', name: 'ler', arguments: {página: 2, arquivo: 'a.pdf'}}]}];
  const right = [{role: 'assistant', content: [{type: 'toolCall', id: 't1', name: 'ler', arguments: {arquivo: 'a.pdf', página: 2}}]}];
  assert.equal(historyIdentity({messages: left}), historyIdentity({messages: right}));
});

test('identidade da tela só vale enquanto a lista é a da montagem (#115)', () => {
  const box = {childElementCount: 4};
  const shown = createShownHistory(() => box);
  assert.equal(shown.current(), null, 'nada montado ainda');
  shown.mark('abc');
  assert.equal(shown.current(), 'abc');
  box.childElementCount = 0;
  assert.equal(shown.current(), null, 'lista esvaziada pede o histórico de novo');
  box.childElementCount = 5;
  assert.equal(shown.current(), null, 'bolha nova pede a remontagem que a limpa');
  box.childElementCount = 4;
  shown.mark(null);
  assert.equal(shown.current(), null, 'montagem sem identidade não vale');
});

test('links de busca do registro entram na identidade: details diferente remonta', () => {
  const withDetails = (title) => [{role: 'toolResult', toolCallId: 't1', content: [{type: 'text', text: 'ok'}], details: {results: [{title}]}, timestamp: 1_000}];
  assert.notEqual(historyIdentity({session: 's', messages: withDetails('A')}), historyIdentity({session: 's', messages: withDetails('B')}));
});
