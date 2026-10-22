#!/usr/bin/env node
// Pi de mentira do GeoGebra (#53): sem modelo, mas com o cliente REAL da ponte
// (`mesa-geogebra/client.mjs`). Lê da mensagem do aluno `ggb: <comando>` (executar),
// `ggb-estado` (ler) ou `ggb-continuar: <comando>` (executar sem limpar) e chama a
// ponte como a ferramenta `mesa_geogebra` faria. Registra cada mensagem recebida em
// FAKE_PI_GGB_LOG (uma linha JSON) e cada resposta da ponte em FAKE_PI_GGB_OUT.
import fs from 'node:fs';
import readline from 'node:readline';
import {callGeogebra} from '../../src/extensions/mesa-geogebra/client.mjs';

const args = process.argv.slice(2), session = args[args.indexOf('--session') + 1];
const model = {provider: 'test', id: 'offline', name: 'Pi do GeoGebra sintético', input: ['text']};
const TOOL = 'mesa_geogebra';
let streaming = false, seq = 0;
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
const append = (message) => fs.appendFileSync(session, JSON.stringify({type: 'message', message}) + '\n');
const reply = (event, data) => emit({type: 'response', id: event.id, success: true, data});
const appendLine = (file, value) => { if (file) fs.appendFileSync(file, JSON.stringify(value) + '\n'); };

/** @returns {{action: 'run'|'state', command?: string, continuar: boolean} | null} */
function requestOf(text) {
  const first = String(text).split('\n')[0];
  const run = /^ggb(-continuar)?:\s*(.+)$/.exec(first);
  if (run) return {action: 'run', command: run[2].trim(), continuar: !!run[1]};
  return /^ggb-estado\b/.test(first) ? {action: 'state', continuar: false} : null;
}

const summaryOf = (answer) => answer.error ? `Erro: ${answer.error}` : `Feito. ${JSON.stringify(answer.state ?? answer)}`;

async function prompt(event) {
  streaming = true;
  reply(event, {});
  appendLine(process.env.FAKE_PI_GGB_LOG, {message: event.message});
  append({role: 'user', content: [{type: 'text', text: event.message}]});
  emit({type: 'agent_start'});
  const id = `ggb-call-${++seq}`, wanted = requestOf(event.message);
  let text = 'Sem pedido ao GeoGebra.';
  if (wanted) {
    emit({type: 'tool_execution_start', toolCallId: id, toolName: TOOL, args: wanted});
    let answer;
    try { answer = await callGeogebra(process.env.LEARNING_DESK_GGB_BRIDGE, wanted.action, wanted); }
    catch (error) { answer = {error: error.message}; }
    appendLine(process.env.FAKE_PI_GGB_OUT, {request: wanted, answer});
    text = summaryOf(answer);
    emit({type: 'tool_execution_end', toolCallId: id, toolName: TOOL, isError: !!answer.error, result: {content: [{type: 'text', text}]}});
  }
  const content = [{type: 'text', text}];
  emit({type: 'message_start', message: {role: 'assistant', id: `ggb-message-${seq}`}});
  emit({type: 'message_update', assistantMessageEvent: {type: 'text_delta', contentIndex: 0, delta: text}});
  emit({type: 'message_end', message: {role: 'assistant', id: `ggb-message-${seq}`, content}});
  append({role: 'assistant', content});
  streaming = false;
  emit({type: 'agent_end'});
  emit({type: 'agent_settled'});
}

for await (const line of readline.createInterface({input: process.stdin})) {
  let event; try { event = JSON.parse(line); } catch { continue; }
  if (event.type === 'get_state') reply(event, {model, thinkingLevel: 'off', isStreaming: streaming, pendingMessageCount: 0, autoCompactionEnabled: true});
  else if (event.type === 'get_messages') {
    let messages = []; try { messages = fs.readFileSync(session, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).message); } catch { /* sessão ainda vazia */ }
    reply(event, {messages});
  }
  else if (event.type === 'get_available_models') reply(event, {models: [model]});
  else if (event.type === 'get_commands') reply(event, {commands: []});
  else if (event.type === 'get_session_stats') reply(event, {contextUsage: {tokens: 100, contextWindow: 100000, percent: 0.1}});
  else if (event.type === 'prompt') prompt(event).catch((error) => { streaming = false; emit({type: 'desk_error', message: error.message}); });
  else if (event.type === 'abort') { streaming = false; reply(event, {}); emit({type: 'agent_end'}); emit({type: 'agent_settled'}); }
  else if (event.id) reply(event, {});
}
