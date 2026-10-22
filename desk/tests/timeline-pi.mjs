#!/usr/bin/env node
/* Pi sintético do hunt-timeline (fixture PRÓPRIA; não altera fake-pi.mjs nem
   hunt-pi.mjs). Encena a linha do tempo por roteiro escolhido no texto do
   prompt e grava o JSONL sintético no `--session` para o reload.

   Roteiros:
   - "monte uma atividade" (padrão): pensamento → fala → declaração de
     `mesa_criar_atividade` (toolcall_end) → fala → execução → resultado;
   - "duas atividades": duas ferramentas declaradas juntas, resultados fora de
     ordem (b antes de a), uma com erro;
   - "devagar": igual ao padrão, mas com uma janela longa antes do resultado —
     o hunt usa para Parar/troca de conversa;
   - "retry": re-stream do MESMO message.id com thinking_start/end autoritativos;
   - "quiz": ferramenta fora do diário e cartão no chat (regressão);
   - "atraso cruzando" + "rodada dois atrasada": N1 da revisão final — a
     rodada 1 é abortada com mensagem ABERTA e a rodada 2 dispara os eventos
     atrasados da 1 (delta, message_end e tool_execution_end) no meio do
     próprio stream, relativos ao relógio da 2 (determinístico no teste);
   - "atraso residual {igual|sufixo|cont}": R1 residual — a rodada 1 é parada
     com `late-x1` aberta e a rodada 2 recebe o `message_end` atrasado DEPOIS
     do próprio texto (igual/sufixo) ou no meio do stream (cont), SEM delta
     atrasado; o end aposentado é descartado por identidade (texto não prova
     posse);
   - "sem índice": texto→ferramenta→texto SEM `contentIndex` (N2, host legado);
   - "dois finais": dois `message_end` sem `message_start` (N3);
   - "sem id ...": Pi sem `message.id` (forma REAL do Pi):
     "sem id com deltas" (texto-ferramenta-texto), "sem id só final" (texto
     chega só no message_end), "sem id sem início" (message_end sem
     message_start), "sem id pensamento" (texto→pensamento→texto) e
     "sem id duas mensagens" (duas mensagens sem id na mesma rodada).

   Eventos sóbrios e sem dado pessoal; nenhuma credencial e nenhum arquivo do
   app. O `abort` responde e encerra o turno, mas NÃO cancela os temporizadores
   do roteiro "devagar" de propósito: é assim que o teste prova que evento
   atrasado depois de Parar não pinta. No `abort` o `agent_end`/`agent_settled`
   saem ANTES da resposta; com `HUNT_TIMELINE_ABORT_DELAY` a resposta é adiada
   e a fixture grava `<session>.abort-replied` na resposta (barreira N1). */
import fs from 'node:fs';

const args = process.argv.slice(2);
const session = args[args.indexOf('--session') + 1] || '';
const GAP = Math.max(40, Number(process.env.HUNT_TIMELINE_GAP) || 170);
const LATE = Math.max(400, Number(process.env.HUNT_TIMELINE_LATE) || 1500);
const ABORT_DELAY = Math.max(0, Number(process.env.HUNT_TIMELINE_ABORT_DELAY) || 0);
const model = {provider: 'test', id: 'offline', name: 'Pi de timeline', input: ['text', 'image']};
const timers = [];
let streaming = false;
let quizPending = null;
let slowSeq = 0;

function write(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}
function markAbortReplied() {
  if (!session) return;
  try { fs.writeFileSync(`${session}.abort-replied`, String(Date.now())); } catch {}
}
function reply(e, data) {
  const id = e && typeof e === 'object' ? e.id : e;
  write({type: 'response', id, success: true, data});
}
function emit(ev) {
  write(ev);
  if (ev.type === 'agent_end' && !ev.willRetry) write({type: 'agent_settled'});
}
function after(ms, fn) {
  const timer = setTimeout(() => {
    const at = timers.indexOf(timer);
    if (at >= 0) timers.splice(at, 1);
    try {
      fn();
    } catch {}
  }, ms);
  timers.push(timer);
  return timer;
}
function run(fns, at = 0, step = GAP) {
  for (const fn of fns) {
    after(at, fn);
    at += step;
  }
}
function append(message) {
  if (!session) return;
  try {
    fs.appendFileSync(session, `${JSON.stringify({type: 'message', message})}\n`);
  } catch {}
}
function messages() {
  if (!session || !fs.existsSync(session)) return [];
  return fs.readFileSync(session, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line).message].filter(Boolean);
    } catch {
      return [];
    }
  });
}

const ACTIVITY = 'mesa_criar_atividade';
const ACTIVITY_MCP = 'mcp__mesa__criar_atividade';

function activityArgs(title) {
  return {title, objective: 'Prever e observar', alternativeMarkdown: 'Descreva o movimento', html: '<div></div>', css: '', js: ''};
}

function scenarioOrder(text) {
  const thinking = 'Vou preparar a atividade com calma.';
  const args1 = activityArgs('MRUV interativo');
  const content = [
    {type: 'thinking', thinking},
    {type: 'text', text: 'Antes.'},
    {type: 'toolCall', id: 'act-1', name: ACTIVITY, arguments: args1},
    {type: 'text', text: 'Depois.'},
  ];
  const result = {content: [{type: 'text', text: 'atividade publicada'}], details: {activityId: 'act-1', version: 1}};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant', id: 'm1'}}),
    () => {
      emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'Vou preparar ', contentIndex: 0}});
      emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'a atividade com calma.', contentIndex: 0}});
    },
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Antes.', contentIndex: 1}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 2, toolCall: {id: 'act-1', name: ACTIVITY, arguments: args1}}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Depois.', contentIndex: 3}}),
    () => emit({type: 'message_end', message: {role: 'assistant', id: 'm1', content}}),
    () => emit({type: 'tool_execution_start', toolCallId: 'act-1', toolName: ACTIVITY, args: args1}),
    () => {
      emit({type: 'tool_execution_end', toolCallId: 'act-1', toolName: ACTIVITY, isError: false, result});
      append({role: 'assistant', content, timestamp: Date.now() - 5});
      append({role: 'toolResult', toolCallId: 'act-1', toolName: ACTIVITY, isError: false, content: result.content, details: result.details, timestamp: Date.now()});
    },
    () => {
      emit({type: 'agent_end'});
      streaming = false;
    },
  ]);
}

function scenarioSlow(text) {
  const thinking = 'Vou pensar sem pressa.';
  const callId = `slow-${++slowSeq}`;
  const args1 = activityArgs('Devagar');
  const content = [
    {type: 'thinking', thinking},
    {type: 'toolCall', id: callId, name: ACTIVITY, arguments: args1},
    {type: 'text', text: 'Depois do intervalo.'},
  ];
  const result = {content: [{type: 'text', text: 'publicada'}], details: {activityId: callId}};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant', id: 'm-slow'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: thinking, contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 1, toolCall: {id: callId, name: ACTIVITY, arguments: args1}}}),
    () => emit({type: 'tool_execution_start', toolCallId: callId, toolName: ACTIVITY, args: args1}),
  ]);
  /* O atraso é o ponto do teste: o hunt aborta/troca antes disto. */
  after(GAP * 4 + LATE, () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Depois do intervalo.', contentIndex: 2}}));
  after(GAP * 4 + LATE + GAP, () => emit({type: 'message_end', message: {role: 'assistant', id: 'm-slow', content}}));
  after(GAP * 4 + LATE + GAP * 2, () => {
    emit({type: 'tool_execution_end', toolCallId: callId, toolName: ACTIVITY, isError: false, result});
    append({role: 'assistant', content, timestamp: Date.now() - 5});
    append({role: 'toolResult', toolCallId: callId, toolName: ACTIVITY, isError: false, content: result.content, details: result.details, timestamp: Date.now()});
  });
  after(GAP * 4 + LATE + GAP * 3, () => {
    emit({type: 'agent_end'});
    streaming = false;
  });
}

function scenarioDuo(text) {
  const argsA = activityArgs('A');
  const argsB = activityArgs('B');
  const content = [
    {type: 'toolCall', id: 'duo-a', name: ACTIVITY, arguments: argsA},
    {type: 'toolCall', id: 'duo-b', name: ACTIVITY_MCP, arguments: argsB},
    {type: 'text', text: 'Prontas.'},
  ];
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant', id: 'm2'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 0, toolCall: {id: 'duo-a', name: ACTIVITY, arguments: argsA}}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 1, toolCall: {id: 'duo-b', name: ACTIVITY_MCP, arguments: argsB}}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Prontas.', contentIndex: 2}}),
    () => emit({type: 'message_end', message: {role: 'assistant', id: 'm2', content}}),
    () => emit({type: 'tool_execution_start', toolCallId: 'duo-a', toolName: ACTIVITY, args: argsA}),
    () => emit({type: 'tool_execution_start', toolCallId: 'duo-b', toolName: ACTIVITY_MCP, args: argsB}),
    () => emit({type: 'tool_execution_end', toolCallId: 'duo-b', toolName: ACTIVITY_MCP, isError: false, result: {content: [{type: 'text', text: 'b ok'}], details: {activityId: 'duo-b'}}}),
    () => emit({type: 'tool_execution_end', toolCallId: 'duo-a', toolName: ACTIVITY, isError: true, result: {content: [{type: 'text', text: 'a falhou'}], details: {}}}),
    () => {
      append({role: 'assistant', content, timestamp: Date.now() - 5});
      append({role: 'toolResult', toolCallId: 'duo-b', toolName: ACTIVITY_MCP, isError: false, content: [{type: 'text', text: 'b ok'}], details: {activityId: 'duo-b'}, timestamp: Date.now()});
      append({role: 'toolResult', toolCallId: 'duo-a', toolName: ACTIVITY, isError: true, content: [{type: 'text', text: 'a falhou'}], details: {}, timestamp: Date.now()});
      emit({type: 'agent_end'});
      streaming = false;
    },
  ]);
}

function scenarioRetry(text) {
  const first = 'Pensando um pouco.';
  const final = 'Pensando muito.';
  const content = [{type: 'thinking', thinking: final}, {type: 'text', text: 'Resposta final.'}];
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant', id: 'm3'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: first, contentIndex: 0}}),
    () => emit({type: 'auto_retry_start', attempt: 1, maxAttempts: 2, delayMs: 120}),
    /* Retry do MESMO bloco: thinking_start reseta, thinking_end é autoritativo. */
    () => emit({type: 'message_start', message: {role: 'assistant', id: 'm3'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_start', contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'Pensando ', contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'muito.', contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_end', contentIndex: 0, content: final}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Resposta ', contentIndex: 1}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'final.', contentIndex: 1}}),
    () => emit({type: 'message_end', message: {role: 'assistant', id: 'm3', content}}),
    () => emit({type: 'auto_retry_end', success: true}),
    () => {
      append({role: 'assistant', content, timestamp: Date.now() - 5});
      emit({type: 'agent_end'});
      streaming = false;
    },
  ]);
}

function scenarioQuiz(text) {
  const question = 'Quanto vale \\(2+2\\)?';
  const argsQ = {question, details: 'Pergunta de teste', options: [{label: '\\(3\\)', value: 'three'}, {label: '\\(4\\)', value: 'four'}, {label: '\\(5\\)', value: 'five'}], multiSelect: false, correctAnswer: 'four', explanation: 'Pela definição: \\(2+2=4\\).'};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  emit({type: 'agent_start'});
  emit({type: 'message_start', message: {role: 'assistant', id: 'm-quiz'}});
  emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'Vou perguntar.', contentIndex: 0}});
  emit({type: 'tool_execution_start', toolCallId: 'quiz-1', toolName: 'quiz', args: argsQ});
  emit({type: 'extension_ui_request', id: 'ui-quiz-1', method: 'select', title: `Quiz · ${question}`, options: [...argsQ.options.map((option) => option.label), 'Não sei']});
  quizPending = {toolCallId: 'quiz-1', args: argsQ};
}

function gradeQuiz(response) {
  if (!quizPending) return;
  const {toolCallId, args: argsQ} = quizPending;
  quizPending = null;
  const label = response.cancelled ? '' : String(response.value ?? '');
  const index = argsQ.options.findIndex((option) => option.label === label) + 1;
  const details = {
    status: response.cancelled ? 'cancelled' : 'answered',
    question: argsQ.question,
    answers: index > 0 ? [{index, label}] : [],
    dontKnow: false,
    correct: label === argsQ.options[1].label,
    correctIndices: [2],
    options: argsQ.options.map((option, at) => ({index: at + 1, label: option.label})),
    explanation: argsQ.explanation,
  };
  emit({type: 'tool_execution_end', toolCallId, toolName: 'quiz', result: {content: [{type: 'text', text: 'User answered the test quiz.'}], details}, isError: false});
  const text = details.correct ? 'Boa! Resposta correta.' : 'Quase: reveja a resolução com calma.';
  emit({type: 'message_start', message: {role: 'assistant', id: 'm-quiz-2'}});
  emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: text, contentIndex: 0}});
  emit({type: 'message_end', message: {role: 'assistant', id: 'm-quiz-2', content: [{type: 'text', text}]}});
  append({role: 'assistant', content: [{type: 'thinking', thinking: 'Vou perguntar.'}, {type: 'toolCall', id: 'quiz-1', name: 'quiz', arguments: argsQ}], timestamp: Date.now() - 5});
  append({role: 'toolResult', toolCallId: 'quiz-1', toolName: 'quiz', isError: false, content: [{type: 'text', text: 'User answered the test quiz.'}], details, timestamp: Date.now()});
  append({role: 'assistant', content: [{type: 'text', text}], timestamp: Date.now()});
  emit({type: 'agent_end'});
  streaming = false;
}

function scenarioNoIdStream(text) {
  const args1 = activityArgs('Sem id com deltas');
  const content = [
    {type: 'thinking', thinking: 'Vou preparar sem id.'},
    {type: 'text', text: 'Antes.'},
    {type: 'toolCall', id: 'act-ns-1', name: ACTIVITY, arguments: args1},
    {type: 'text', text: 'Depois noid.'},
  ];
  const result = {content: [{type: 'text', text: 'noid ok'}], details: {activityId: 'act-ns-1'}};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'Vou preparar sem id.', contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Antes.', contentIndex: 1}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 2, toolCall: {id: 'act-ns-1', name: ACTIVITY, arguments: args1}}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Depois noid.', contentIndex: 3}}),
    () => emit({type: 'message_end', message: {role: 'assistant', content}}),
    () => emit({type: 'tool_execution_start', toolCallId: 'act-ns-1', toolName: ACTIVITY, args: args1}),
    () => {
      emit({type: 'tool_execution_end', toolCallId: 'act-ns-1', toolName: ACTIVITY, isError: false, result});
      append({role: 'assistant', content, timestamp: Date.now() - 5});
      append({role: 'toolResult', toolCallId: 'act-ns-1', toolName: ACTIVITY, isError: false, content: result.content, details: result.details, timestamp: Date.now()});
    },
    () => {
      emit({type: 'agent_end'});
      streaming = false;
    },
  ]);
}

/* Texto SÓ no `message_end` com a ferramenta já declarada antes: a fala de
   índice anterior precisa nascer ANTES do passo da ferramenta, sem mover o
   slot. `comInicio=false` cobre também o message_end sem message_start. */
function scenarioNoIdFinal(text, comInicio = true) {
  const args1 = activityArgs(comInicio ? 'Sem id só final' : 'Sem id sem início');
  const callId = comInicio ? 'act-nf-1' : 'act-nn-1';
  const content = [
    {type: 'text', text: comInicio ? 'Antes sem stream.' : 'Antes sem início.'},
    {type: 'toolCall', id: callId, name: ACTIVITY, arguments: args1},
    {type: 'text', text: comInicio ? 'Depois sem stream.' : 'Depois sem início.'},
  ];
  const result = {content: [{type: 'text', text: 'noid ok'}], details: {activityId: callId}};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  const events = [
    () => emit({type: 'agent_start'}),
    ...(comInicio ? [() => emit({type: 'message_start', message: {role: 'assistant'}})] : []),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 1, toolCall: {id: callId, name: ACTIVITY, arguments: args1}}}),
    () => emit({type: 'message_end', message: {role: 'assistant', content}}),
    () => emit({type: 'tool_execution_start', toolCallId: callId, toolName: ACTIVITY, args: args1}),
    () => {
      emit({type: 'tool_execution_end', toolCallId: callId, toolName: ACTIVITY, isError: false, result});
      append({role: 'assistant', content, timestamp: Date.now() - 5});
      append({role: 'toolResult', toolCallId: callId, toolName: ACTIVITY, isError: false, content: result.content, details: result.details, timestamp: Date.now()});
    },
    () => {
      emit({type: 'agent_end'});
      streaming = false;
    },
  ];
  run(events);
}

/* texto → pensamento → texto com deltas E final (sem id): cada bloco de fala
   preserva a sua bolha e a projeção do histórico (`texto, work, texto`)
   coincide com o que ficou ao vivo. */
function scenarioNoIdThinking(text) {
  const content = [
    {type: 'text', text: 'Primeira fala.'},
    {type: 'thinking', thinking: 'Penso no meio sem id.'},
    {type: 'text', text: 'Segunda fala.'},
  ];
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Primeira fala.', contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'thinking_delta', delta: 'Penso no meio sem id.', contentIndex: 1}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Segunda fala.', contentIndex: 2}}),
    () => emit({type: 'message_end', message: {role: 'assistant', content}}),
    () => {
      append({role: 'assistant', content, timestamp: Date.now() - 5});
      emit({type: 'agent_end'});
      streaming = false;
    },
  ]);
}

/* Duas mensagens sem id na MESMA rodada: cada `message_start` abre a identidade
   seguinte; a segunda mensagem (índice 0 de novo) não pode sobrescrever a fala
   da primeira. */
function scenarioNoIdTwoMessages(text) {
  const args1 = activityArgs('Duas mensagens sem id');
  const first = [
    {type: 'text', text: 'Primeira mensagem.'},
    {type: 'toolCall', id: 'act-n2-1', name: ACTIVITY, arguments: args1},
  ];
  const second = [{type: 'text', text: 'Segunda mensagem.'}];
  const result = {content: [{type: 'text', text: 'noid ok'}], details: {activityId: 'act-n2-1'}};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Primeira mensagem.', contentIndex: 0}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 1, toolCall: {id: 'act-n2-1', name: ACTIVITY, arguments: args1}}}),
    () => emit({type: 'message_end', message: {role: 'assistant', content: first}}),
    () => emit({type: 'tool_execution_start', toolCallId: 'act-n2-1', toolName: ACTIVITY, args: args1}),
    () => {
      emit({type: 'tool_execution_end', toolCallId: 'act-n2-1', toolName: ACTIVITY, isError: false, result});
      append({role: 'assistant', content: first, timestamp: Date.now() - 8});
      append({role: 'toolResult', toolCallId: 'act-n2-1', toolName: ACTIVITY, isError: false, content: result.content, details: result.details, timestamp: Date.now() - 6});
    },
    () => emit({type: 'message_start', message: {role: 'assistant'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Segunda mensagem.', contentIndex: 0}}),
    () => emit({type: 'message_end', message: {role: 'assistant', content: second}}),
    () => {
      append({role: 'assistant', content: second, timestamp: Date.now() - 4});
      emit({type: 'agent_end'});
      streaming = false;
    },
  ]);
}

/* N1 (revisão final 2026-10-08): atraso cruzando o turno. A rodada 1 fica com
   a mensagem ABERTA e `late-x1` declarada (sem `message_end` antes do abort);
   os atrasos são disparados quando a rodada 2 começa, no relógio DA 2, para o
   momento não depender do tempo do teste. O `message_end`/`tool_execution_end`
   atrasados citam `late-x1`: o host os aposentou no `agent_settled` da 1 e não
   pode deixá-los pintar/fechar a rodada 2. */
let lateRun=null;
function scenarioLateCross(text){
 const callId='late-x1';
 const args1=activityArgs('Atrasada 1');
 const content=[
  {type:'thinking',thinking:'Penso na rodada um.'},
  {type:'toolCall',id:callId,name:ACTIVITY,arguments:args1},
  {type:'text',text:'Fala atrasada da rodada 1.'},
 ];
 const result={content:[{type:'text',text:'r1 ok'}],details:{activityId:'art-late-1',version:7}};
 append({role:'user',content:[{type:'text',text}],timestamp:Date.now()-10});
 run([
  () => emit({type:'agent_start'}),
  () => emit({type:'message_start',message:{role:'assistant'}}),
  () => emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'Penso na rodada um.',contentIndex:0}}),
  () => emit({type:'message_update',assistantMessageEvent:{type:'toolcall_end',contentIndex:1,toolCall:{id:callId,name:ACTIVITY,arguments:args1}}}),
  () => emit({type:'tool_execution_start',toolCallId:callId,toolName:ACTIVITY,args:args1}),
 ]);
 lateRun={callId,content,result};
}
function fireLateRun({comInicio=true,falaCedo=false}={}){
 if(!lateRun)return;
 const {callId,content,result}=lateRun;lateRun=null;
 after(GAP*4,() => emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Fala atrasada da rodada 1.',contentIndex:2}}));
 /* Host documentado: o `message_end` atrasado chega DEPOIS da fala da 2 (o
    `text_start` já zerou o delta). Forma crua do probe original: o end atrasado
    chega ANTES da fala da 2 e é DESCARTADO por identidade (id aposentado), sem
    tocar no bloco. */
 after(falaCedo||comInicio?GAP*6:GAP*5,() => emit({type:'message_end',message:{role:'assistant',content}}));
 after(GAP*8,() => {
  emit({type:'tool_execution_end',toolCallId:callId,toolName:ACTIVITY,isError:false,result});
  /* Marca a emissão do atraso SEM poluir o JSONL: o atraso é violação de
     protocolo (o `abort` real só responde depois do settle) e não vira
     histórico; o teste sincroniza e prova a emissão por este arquivo. */
  try{if(session)fs.writeFileSync(`${session}.late-marker`,String(Date.now()));}catch{}
 });
}
function scenarioLateSecond(text,{comInicio=true,falaCedo=false}={}){
 const callId='late-x2';
 const args2=activityArgs('Atrasada 2');
 const content=[
  {type:'thinking',thinking:'Penso na rodada dois.'},
  {type:'toolCall',id:callId,name:ACTIVITY,arguments:args2},
  {type:'text',text:'Fala da rodada 2.'},
 ];
 const result={content:[{type:'text',text:'r2 ok'}],details:{activityId:'art-late-2',version:9}};
 append({role:'user',content:[{type:'text',text}],timestamp:Date.now()-10});
 run([
  () => emit({type:'agent_start'}),
  () => emit({type:'message_start',message:{role:'assistant'}}),
  () => emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'Penso na rodada dois.',contentIndex:0}}),
  () => emit({type:'message_update',assistantMessageEvent:{type:'toolcall_end',contentIndex:1,toolCall:{id:callId,name:ACTIVITY,arguments:args2}}}),
  () => emit({type:'tool_execution_start',toolCallId:callId,toolName:ACTIVITY,args:args2}),
 ]);
 fireLateRun({comInicio,falaCedo});
 /* A fala da 2 chega depois do delta atrasado; no host documentado ela vem
    antes do `message_end` atrasado (o `text_start` zera o bloco); na forma crua
    ela vem depois e o end aposentado é descartado por identidade; com fala cedo
    ela vem antes do delta — o delta anônimo se anexa e o end aposentado NÃO
    apaga nada por texto. */
 after(falaCedo?GAP*3:(comInicio?GAP*5:GAP*6),() => {
  if(comInicio)emit({type:'message_update',assistantMessageEvent:{type:'text_start',contentIndex:2}});
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Fala da rodada 2.',contentIndex:2}});
 });
 after(GAP*12,() => emit({type:'message_end',message:{role:'assistant',content}}));
 after(GAP*14,() => {
  emit({type:'tool_execution_end',toolCallId:callId,toolName:ACTIVITY,isError:false,result});
  append({role:'assistant',content,timestamp:Date.now()-5});
  append({role:'toolResult',toolCallId:callId,toolName:ACTIVITY,isError:false,content:result.content,details:result.details,timestamp:Date.now()});
 });
 after(GAP*16,() => {emit({type:'agent_end'});streaming=false;});
}

/* N2 (revisão final): texto→ferramenta→texto SEM `contentIndex` em nenhum
   evento (host legado, fora do contrato do Pi). O delta sem chave entra numa
   fila FIFO e o `message_end` reconcilia cada parte de texto com o balão
   certo — sem duplicar a primeira fala nem fundir as duas. */
/* R1 residual: a rodada 1 fica ABERTA com `late-x1` declarada (mesmo fluxo do
   N1); a rodada 2 termina com texto legítimo IGUAL (igual) ou SUFIXO (sufixo)
   ao atraso, e o `message_end` atrasado da rodada 1 chega DEPOIS do fim
   autoritativo — SEM delta atrasado. Igualdade/sufixo de texto NUNCA prova
   posse: o end aposentado tem de ser ignorado por IDENTIDADE, sem apagar nem
   truncar a fala nova (o cont chega no MEIO do stream, entre os dois deltas). */
function scenarioResidualSecond(kind, text) {
  const callId = `late-${kind}-2`;
  const lateText = 'Fala atrasada da rodada 1.';
  const args2 = activityArgs('Residual 2');
  const own = kind === 'igual' ? lateText : `Introdução nova. ${lateText}`;
  const cont = kind === 'cont';
  const ownContent = [
    {type: 'thinking', thinking: 'Penso na rodada dois.'},
    {type: 'toolCall', id: callId, name: ACTIVITY, arguments: args2},
    {type: 'text', text: own},
  ];
  const finalContent = [{...ownContent[0]}, {...ownContent[1]}, {type: 'text', text: `${own} Mais texto.`}];
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  run([
    () => emit({type: 'agent_start'}),
    () => emit({type: 'message_start', message: {role: 'assistant'}}),
    () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: own, contentIndex: 2}}),
    ...(cont ? [] : [() => {
      emit({type: 'message_end', message: {role: 'assistant', content: ownContent}});
      append({role: 'assistant', content: ownContent, timestamp: Date.now() - 5});
    }]),
  ]);
  if (cont) after(GAP * 5, () => emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: ' Mais texto.', contentIndex: 2}}));
  /* End atrasado da rodada 1, sem delta: depois do texto novo (igual/sufixo) ou
     no meio do stream (cont). Nada aqui pinta nem toca no bloco novo. */
  after(cont ? GAP * 3 : GAP * 4, () => {
    if (!lateRun) return;
    emit({type: 'message_end', message: {role: 'assistant', content: lateRun.content}});
    lateRun = null;
  });
  if (cont) after(GAP * 7, () => append({role: 'assistant', content: finalContent, timestamp: Date.now() - 5}));
  after(GAP * 9, () => { emit({type: 'agent_end'}); streaming = false; });
}

function scenarioNoIndex(text) {
  const args1 = activityArgs('Sem índice');
  const callId = 'si-1';
  const content = [
    {type: 'text', text: 'Antes sem índice.'},
    {type: 'toolCall', id: callId, name: ACTIVITY, arguments: args1},
    {type: 'text', text: 'Depois sem índice.'},
  ];
  const result = {content: [{type: 'text', text: 'si ok'}], details: {activityId: 'si-1', version: 1}};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  emit({type: 'agent_start'});
  emit({type: 'message_start', message: {role: 'assistant'}});
  emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Antes sem índice.'}});
  emit({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', toolCall: {id: callId, name: ACTIVITY, arguments: args1}}});
  emit({type: 'tool_execution_start', toolCallId: callId, toolName: ACTIVITY, args: args1});
  emit({type: 'tool_execution_end', toolCallId: callId, toolName: ACTIVITY, isError: false, result});
  emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Depois sem índice.'}});
  emit({type: 'message_end', message: {role: 'assistant', content}});
  append({role: 'assistant', content, timestamp: Date.now() - 5});
  append({role: 'toolResult', toolCallId: callId, toolName: ACTIVITY, isError: false, content: result.content, details: result.details, timestamp: Date.now()});
  emit({type: 'agent_end'});
  streaming = false;
}

/* N3 (revisão final): dois `message_end` sem nenhum `message_start` no mesmo
   turno. A identidade sintética encerrada não pode ser reusada pela segunda
   mensagem (a fala da primeira era sobrescrita). */
function scenarioTwoEnds(text) {
  const m1 = {role: 'assistant', content: [{type: 'text', text: 'Final isolado um.'}]};
  const m2 = {role: 'assistant', content: [{type: 'text', text: 'Final isolado dois.'}]};
  append({role: 'user', content: [{type: 'text', text}], timestamp: Date.now() - 10});
  emit({type: 'agent_start'});
  emit({type: 'message_end', message: m1});
  emit({type: 'message_end', message: m2});
  append({role: 'assistant', content: m1.content, timestamp: Date.now() - 5});
  append({role: 'assistant', content: m2.content, timestamp: Date.now() - 4});
  emit({type: 'agent_end'});
  streaming = false;
}

function onPrompt(e) {
  const text = String(e.message || '');
  reply(e, {});
  streaming = true;
  if (/atraso residual (igual|sufixo|cont)/i.test(text)) return scenarioResidualSecond(RegExp.$1.toLowerCase(), text);
  if (/atraso cruzando/i.test(text)) return scenarioLateCross(text);
  if (/rodada dois atrasada com fala cedo/i.test(text)) return scenarioLateSecond(text,{comInicio:false,falaCedo:true});
  if (/rodada dois atrasada/i.test(text)) return scenarioLateSecond(text,{comInicio:!/sem in[íi]cio/i.test(text)});
  if (/sem índice/i.test(text)) return scenarioNoIndex(text);
  if (/dois finais/i.test(text)) return scenarioTwoEnds(text);
  if (/sem id com deltas/i.test(text)) return scenarioNoIdStream(text);
  if (/sem id só final/i.test(text)) return scenarioNoIdFinal(text, true);
  if (/sem id sem início/i.test(text)) return scenarioNoIdFinal(text, false);
  if (/sem id pensamento/i.test(text)) return scenarioNoIdThinking(text);
  if (/sem id duas mensagens/i.test(text)) return scenarioNoIdTwoMessages(text);
  if (/duas atividades/i.test(text)) return scenarioDuo(text);
  if (/devagar/i.test(text)) return scenarioSlow(text);
  if (/retry/i.test(text)) return scenarioRetry(text);
  if (/quiz/i.test(text)) return scenarioQuiz(text);
  return scenarioOrder(text);
}

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const raw = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (e.type === 'extension_ui_response') {
      gradeQuiz(e);
      continue;
    }
    if (e.type === 'get_state') reply(e, {model, thinkingLevel: 'off', isStreaming: streaming, pendingMessageCount: 0, autoCompactionEnabled: true});
    else if (e.type === 'get_messages') reply(e, {messages: messages()});
    else if (e.type === 'get_available_models') reply(e, {models: [model]});
    else if (e.type === 'get_commands') reply(e, {commands: []});
    else if (e.type === 'get_session_stats') reply(e, {contextUsage: {tokens: 12000, contextWindow: 200000, percent: 6}});
    else if (e.type === 'set_auto_compaction' || e.type === 'set_model' || e.type === 'set_thinking_level') reply(e, {});
    else if (e.type === 'compact') reply(e, {summary: 'resumo', tokensBefore: 1000});
    else if (e.type === 'clear_queue') reply(e, {});
    else if (e.type === 'abort') {
      /* Contrato do Pi: o abort emite o fim/settle ANTES de responder. Com
         HUNT_TIMELINE_ABORT_DELAY a resposta é atrasada de propósito para o
         teste provar que o próximo envio sai com o abort ainda pendente
         (as linhas do RPC são concorrentes; o que segura o turno novo é o
         settle + `isStreaming`, não a resposta do abort). */
      if (streaming) {
        streaming = false;
        after(80, () => emit({type: 'agent_end'}));
      }
      if (ABORT_DELAY > 0) after(ABORT_DELAY, () => { reply(e, {}); markAbortReplied(); });
      else { reply(e, {}); markAbortReplied(); }
    } else if (e.type === 'prompt') onPrompt(e);
    else if (e.id) reply(e, {});
  }
});
