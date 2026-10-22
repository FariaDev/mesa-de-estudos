import assert from 'node:assert/strict';
import test from 'node:test';
import {
 STEP,addError,closeThinking,countsLabel,createLog,findToolStep,finishLog,finishTool,formatDuration,
 headLine,historyTurns,liveLabel,replaceThinking,runningStep,startTool,stepDetail,stepLabel,stepPreview,thinkingDelta,toolKind,
} from '../src/worklog.mjs';

test('toolKind separa busca, referência e leitura', () => {
 assert.equal(toolKind('web_search'), STEP.SEARCH);
 assert.equal(toolKind('Buscar na web'), STEP.SEARCH);
 assert.equal(toolKind('open_reference'), STEP.REFERENCE);
 assert.equal(toolKind('web_fetch'), STEP.FETCH);
 assert.equal(toolKind('quiz'), STEP.TOOL);
});

test('formatDuration em segundos, minutos e arredondamento', () => {
 assert.equal(formatDuration(900), '1s');
 assert.equal(formatDuration(4_400), '4s');
 assert.equal(formatDuration(65_000), '1min 5s');
 assert.equal(formatDuration(120_000), '2min');
});

test('turno com pensamento, busca e resposta', () => {
 const log = createLog(1_000);
 thinkingDelta(log, 'Vou procurar ', 1_200);
 thinkingDelta(log, 'o jogo.', 1_400);
 assert.equal(runningStep(log).kind, STEP.THINKING);
 assert.equal(liveLabel(runningStep(log)), 'Pensando…');
 assert.equal(stepPreview(runningStep(log)), 'Vou procurar o jogo.');

 closeThinking(log, 4_000);
 assert.equal(runningStep(log), null);
 assert.equal(stepLabel(log.steps[0]), 'Pensou por 3s');

 const step = startTool(log, {id: 's1', name: 'web_search', args: {query: 'kojima xbox'}, now: 4_100});
 assert.equal(liveLabel(step), 'Procurando na web: «kojima xbox»');
 finishTool(log, {
  id: 's1', now: 5_600, isError: false,
  result: {content: [{type: 'text', text: '1. [OD](https://example.com/od)'}], details: {results: [{title: 'OD', url: 'https://example.com/od'}]}},
 });
 assert.equal(step.status, 'done');
 assert.equal(stepLabel(step), 'Procurou na web: «kojima xbox»');
 assert.deepEqual(step.results, [{title: 'OD', url: 'https://example.com/od'}]);
 assert.equal(stepDetail(step), '');
 finishLog(log, {now: 9_000});
 assert.equal(headLine(log), 'Trabalhou por 8s · 1 busca');
});

test('leitura de página ganha domínio e link; falha ganha o erro', () => {
 const log = createLog(0);
 const page = startTool(log, {id: 'f1', name: 'web_fetch', args: {url: 'https://www.ign.com/articles/x'}, now: 0});
 assert.equal(liveLabel(page), 'Abrindo ign.com…');
 finishTool(log, {id: 'f1', now: 1_200, isError: false, result: {content: [{type: 'text', text: 'conteúdo'}], details: {title: 'IGN', source: 'https://www.ign.com/articles/x'}}});
 assert.equal(stepLabel(page), 'Abriu ign.com');
 assert.equal(page.url, 'https://www.ign.com/articles/x');

 const bad = startTool(log, {id: 's2', name: 'web_search', args: {query: 'x'}, now: 0});
 finishTool(log, {id: 's2', now: 500, isError: true, result: {content: [{type: 'text', text: 'rede fora'}]}});
 assert.equal(bad.status, 'error');
 assert.equal(stepDetail(bad), 'rede fora');
 finishLog(log, {now: 1_200});
 assert.equal(headLine(log), 'Trabalhou por 1s · 1 busca · 1 página');
});

test('parada marca o turno e fecha ferramenta pendente', () => {
 const log = createLog(0);
 startTool(log, {id: 's1', name: 'web_search', args: {query: 'teste'}, now: 0});
 finishLog(log, {now: 4_000, reason: 'stopped'});
 assert.equal(log.steps[0].status, 'stopped');
 assert.equal(headLine(log), 'Você parou após 4s · 1 busca');
});

test('erro avulso entra como passo e o turno interrompido avisa', () => {
 const log = createLog(0);
 addError(log, 'Ferramenta bloqueada neste app: bash', 100);
 finishLog(log, {now: 2_500, reason: 'blocked'});
 assert.equal(stepDetail(log.steps[0]), 'Ferramenta bloqueada neste app: bash');
 assert.equal(headLine(log), 'Turno interrompido após 3s');
});

test('countsLabel pluraliza e ignora o que não é ferramenta', () => {
 const log = createLog(0);
 startTool(log, {id: 'a', name: 'web_search', args: {query: 'a'}, now: 0});
 startTool(log, {id: 'b', name: 'web_search', args: {query: 'b'}, now: 0});
 startTool(log, {id: 'c', name: 'web_fetch', args: {url: 'https://x.dev'}, now: 0});
 thinkingDelta(log, 'pensando', 0);
 assert.equal(countsLabel(log.steps), '2 buscas · 1 página');
});

test('historyTurns reconstrói turnos do JSONL pareando toolResult', () => {
 const messages = [
  {role: 'user', content: [{type: 'text', text: 'qual o jogo?'}], timestamp: 1_000},
  {role: 'assistant', content: [{type: 'thinking', thinking: 'Vou buscar.'}, {type: 'toolCall', id: 't1', name: 'web_search', arguments: {query: 'kojima xbox'}}], timestamp: 2_000},
  {role: 'toolResult', toolCallId: 't1', toolName: 'web_search', isError: false, timestamp: 3_000, content: [{type: 'text', text: '1. [OD](https://example.com/od)'}], details: {results: [{title: 'OD', url: 'https://example.com/od'}]}},
  {role: 'assistant', content: [{type: 'text', text: 'É o OD.'}], timestamp: 4_000},
 ];
 const turns = historyTurns(messages);
 assert.equal(turns.length, 1);
 const [turn] = turns;
 assert.equal(turn.userText, 'qual o jogo?');
 assert.equal(turn.text, 'É o OD.');
 assert.equal(turn.steps.length, 2);
 assert.equal(turn.steps[0].kind, STEP.THINKING);
 assert.equal(stepLabel(turn.steps[1]), 'Procurou na web: «kojima xbox»');
 assert.equal(turn.steps[1].results[0].url, 'https://example.com/od');
 assert.equal(headLine({...turn, endedAt: turn.endedAt}), 'Trabalhou por 3s · 1 busca');
});

test('historyTurns sem resultado marca a ferramenta como parada', () => {
 const turns = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'oi'}], timestamp: 0},
  {role: 'assistant', content: [{type: 'toolCall', id: 't1', name: 'web_search', arguments: {query: 'x'}}], timestamp: 500},
 ]);
 assert.equal(turns[0].steps[0].status, 'stopped');
 assert.equal(headLine(turns[0]), 'Trabalhou por 1s · 1 busca');
});

test('historyTurns separa turnos e ignora mensagem vazia', () => {
 const turns = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'um'}], timestamp: 0},
  {role: 'assistant', content: [{type: 'text', text: 'resposta um'}], timestamp: 100},
  {role: 'assistant', content: [{type: 'thinking', thinking: 'ignorada'}], timestamp: 150},
  {role: 'user', content: [{type: 'text', text: 'dois'}], timestamp: 200},
  {role: 'assistant', content: [{type: 'text', text: 'resposta dois'}], timestamp: 300},
 ]);
 assert.equal(turns.length, 2);
 assert.equal(turns[0].text, 'resposta um');
 assert.equal(turns[1].text, 'resposta dois');
});

test('startTool é idempotente por id: declaração reserva e execução atualiza o mesmo passo', () => {
 const log = createLog(0);
 const declared = startTool(log, {id: 't1', name: 'mesa_criar_atividade', args: {title: 'MRUV'}, now: 10});
 const executed = startTool(log, {id: 't1', name: 'mesa_criar_atividade', args: {title: 'MRUV'}, now: 20});
 assert.equal(executed, declared, 'o mesmo objeto de passo, sem duplicar');
 assert.equal(log.steps.length, 1);
 assert.equal(declared.startedAt, 10, 'o relógio da declaração fica');
 assert.equal(findToolStep(log, 't1'), declared);
 assert.equal(findToolStep(log, 'nope'), null);
 finishTool(log, {id: 't1', now: 30, isError: false, result: {content: 'ok', details: {activityId: 'act-1'}}});
 assert.equal(log.steps.filter(step => step.id === 't1').length, 1, 'o fim não cria linha extra');
 assert.equal(declared.status, 'done');
});

test('replaceThinking grava o conteúdo autoritativo do thinking_end sem duplicar', () => {
 const log = createLog(0);
 thinkingDelta(log, 'Vou ', 10);
 thinkingDelta(log, 'buscar.', 20);
 replaceThinking(log, 'Vou buscar com calma.', log.steps[0]);
 assert.equal(log.steps.length, 1);
 assert.equal(log.steps[0].text, 'Vou buscar com calma.');
 thinkingDelta(log, ' e conferir.', 30);
 assert.equal(log.steps[0].text, 'Vou buscar com calma. e conferir.', 'delta seguinte continua no mesmo passo running');
 assert.equal(replaceThinking(log, 'x', null), log.steps[0], 'sem passo explícito usa o último pensamento');
 assert.equal(log.steps[0].text, 'x');
});

test('historyTurns expõe parts: a fala fecha a rodada e o trabalho seguinte vem depois', () => {
 const messages = [
  {role: 'user', content: [{type: 'text', text: 'faz aí'}], timestamp: 0},
  {role: 'assistant', content: [
   {type: 'thinking', thinking: 'Vou buscar.'},
   {type: 'toolCall', id: 't1', name: 'web_search', arguments: {query: 'x'}},
  ], timestamp: 100},
  {role: 'toolResult', toolCallId: 't1', toolName: 'web_search', isError: false, timestamp: 200, content: [{type: 'text', text: 'ok'}], details: {results: [{title: 'A', url: 'https://a.dev'}]}},
  {role: 'assistant', content: [{type: 'text', text: 'Achei: A'}], timestamp: 300},
  {role: 'assistant', content: [
   {type: 'thinking', thinking: 'Agora o preço.'},
   {type: 'toolCall', id: 't2', name: 'web_fetch', arguments: {url: 'https://a.dev/preco'}},
  ], timestamp: 400},
  {role: 'toolResult', toolCallId: 't2', toolName: 'web_fetch', isError: false, timestamp: 500, content: [{type: 'text', text: 'R$ 10'}], details: {}},
  {role: 'assistant', content: [{type: 'text', text: 'Custa R$ 10.'}], timestamp: 600},
 ];
 const [turn] = historyTurns(messages);
 assert.deepEqual(turn.parts.map(part => part.type), ['work', 'text', 'work', 'text']);
 assert.equal(turn.parts[0].steps.length, 2, 'pensamento + busca na primeira rodada');
 assert.equal(turn.parts[2].steps.length, 2, 'pensamento + leitura na segunda');
 assert.equal(turn.parts[1].text, 'Achei: A');
 assert.equal(turn.parts[3].text, 'Custa R$ 10.');
 assert.equal(turn.parts[0].startedAt, 100);
 assert.equal(turn.parts[0].endedAt, 200, 'a rodada fecha no resultado da ferramenta');
 assert.equal(turn.text, 'Achei: A\n\nCusta R$ 10.');
 assert.equal(turn.steps.length, 4);
 assert.equal(headLine({...turn, endedAt: turn.endedAt}), 'Trabalhou por 1s · 1 busca · 1 página');
});

test('historyTurns: artefato entra no ponto da ferramenta, antes da próxima fala', () => {
 const [turn] = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'crie uma atividade'}], timestamp: 0},
  {role: 'assistant', content: [
   {type: 'thinking', thinking: 'Vou montar.'},
   {type: 'toolCall', id: 'a1', name: 'mesa_criar_atividade', arguments: {title: 'MRUV'}},
  ], timestamp: 100},
  {role: 'toolResult', toolCallId: 'a1', toolName: 'mesa_criar_atividade', isError: false, timestamp: 200, content: [{type: 'text', text: 'atividade publicada'}], details: {activityId: 'act-1', hash: 'h1'}},
  {role: 'assistant', content: [{type: 'text', text: 'Aqui está.'}], timestamp: 300},
 ]);
 assert.deepEqual(turn.parts.map(part => part.type), ['work', 'artifact', 'text']);
 assert.equal(turn.parts[1].toolCallId, 'a1');
 assert.equal(turn.parts[1].name, 'mesa_criar_atividade');
 assert.equal(turn.parts[1].at, 100);
 assert.equal(turn.parts[0].steps.length, 2);
});

test('historyTurns: text-tool-text na mesma mensagem preserva a ordem e o slot', () => {
 const [turn] = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'oi'}], timestamp: 0},
  {role: 'assistant', content: [
   {type: 'text', text: 'Antes.'},
   {type: 'toolCall', id: 'a1', name: 'mcp__mesa__criar_atividade', arguments: {title: 'x'}},
   {type: 'text', text: 'Depois.'},
  ], timestamp: 100},
  {role: 'toolResult', toolCallId: 'a1', toolName: 'mcp__mesa__criar_atividade', isError: false, timestamp: 150, content: [{type: 'text', text: 'ok'}], details: {}},
 ]);
 assert.deepEqual(turn.parts.map(part => part.type), ['text', 'work', 'artifact', 'text']);
 assert.equal(turn.parts[0].text, 'Antes.');
 assert.equal(turn.parts[1].steps.length, 1);
 assert.equal(turn.parts[2].toolCallId, 'a1');
 assert.equal(turn.parts[3].text, 'Depois.');
});

test('historyTurns: duas atividades na mesma rodada mantêm ordem de declaração e step do jeito', () => {
 const [turn] = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'duas'}], timestamp: 0},
  {role: 'assistant', content: [
   {type: 'toolCall', id: 'a1', name: 'mesa_criar_atividade', arguments: {title: 'um'}},
   {type: 'toolCall', id: 'a2', name: 'mesa_criar_atividade', arguments: {title: 'dois'}},
  ], timestamp: 10},
  {role: 'toolResult', toolCallId: 'a2', toolName: 'mesa_criar_atividade', isError: true, timestamp: 20, content: [{type: 'text', text: 'falhou'}], details: {}},
  {role: 'toolResult', toolCallId: 'a1', toolName: 'mesa_criar_atividade', isError: false, timestamp: 30, content: [{type: 'text', text: 'ok'}], details: {}},
 ]);
 assert.deepEqual(turn.parts.map(part => part.type), ['work', 'artifact', 'artifact']);
 assert.deepEqual(turn.parts.filter(part => part.type === 'artifact').map(part => part.toolCallId), ['a1', 'a2']);
 assert.equal(turn.parts[0].steps.length, 2);
 assert.equal(turn.parts[0].steps[0].status, 'done');
 assert.equal(turn.parts[0].steps[1].status, 'error', 'resultado fora de ordem cai no passo do próprio id');
});

test('historyTurns junta falas consecutivas da mesma mensagem (só trabalho separa)', () => {
 const [turn] = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'oi'}], timestamp: 0},
  {role: 'assistant', content: [
   {type: 'text', text: 'Primeiro parágrafo.'},
   {type: 'text', text: 'Segundo parágrafo.'},
  ], timestamp: 100},
 ]);
 assert.deepEqual(turn.parts.map(part => part.type), ['text'], 'textos vizinhos ficam num balão só');
 assert.equal(turn.parts[0].text, 'Primeiro parágrafo.\n\nSegundo parágrafo.');
});

test('historyTurns guarda imagens do assistente em parts (fala vazia vira parte visual)', () => {
 const [turn] = historyTurns([
  {role: 'user', content: [{type: 'text', text: 'imagem?'}], timestamp: 0},
  {role: 'assistant', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png'}], timestamp: 100},
 ]);
 assert.deepEqual(turn.parts.map(part => part.type), ['text']);
 assert.equal(turn.parts[0].text, '');
 assert.deepEqual(turn.parts[0].images, ['data:image/png;base64,QUJD']);
 assert.equal(turn.assistantImages.length, 1);
});
