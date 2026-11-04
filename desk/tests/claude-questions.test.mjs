/* Aviso de limite e avisos de atividade do Claude Code
 * (desk/src/claude-questions.mjs).
 *
 * Tudo sintético: nenhum SDK, binário, credencial, sessão, rede ou inferência;
 * nenhum arquivo do runtime é lido/escrito. O módulo é puro (sem DOM), então o
 * teste importa direto. O último teste ancora os códigos canônicos no
 * adaptador real (somente leitura) para o contrato não divergir em silêncio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

import {ptText, enText} from './pt-text.mjs';
import {message} from '../src/i18n.mjs';
import {
  ACTIVITY_NOTICE_CODES,
  RATE_LIMIT_CODES,
  claudeActivityNotice,
  claudeLimitNotice,
  deskErrorIsFatal,
  limitNoticeState,
} from '../src/claude-questions.mjs';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('claudeLimitNotice classifica código e metadados canônicos, sem mutar a entrada', () => {
  const blocked = claudeLimitNotice(deepFreeze({
    type: 'desk_warn',
    code: RATE_LIMIT_CODES.blocked,
    message: 'Limite atingido (janela de 5 horas). A execução fica pausada até o limite reiniciar em 20min.',
    rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 1770000000, blocked: true, window: 'janela de 5 horas'},
  }));
  assert.deepEqual(blocked, {
    kind: 'blocked',
    key: 'blocked:five_hour:t:1770000000000',
    message: 'Limite atingido (janela de 5 horas). A execução fica pausada até o limite reiniciar em 20min.',
    window: 'five_hour:t:1770000000000',
    type: 'five_hour',
    reset: 't:1770000000000',
  });

  const warning = claudeLimitNotice({code: RATE_LIMIT_CODES.warning, message: 'Atenção: perto do limite.'});
  assert.deepEqual(warning, {
    kind: 'warning',
    key: 'warning:Atenção: perto do limite.:unknown',
    message: 'Atenção: perto do limite.',
    window: 'Atenção: perto do limite.:unknown',
    type: '',
    reset: '',
  });

  const overage = claudeLimitNotice({rateLimit: {status: 'rejected', type: 'seven_day', resetsAt: 123, blocked: false}});
  assert.equal(overage.kind, 'overage');
  assert.equal(ptText(overage.message), 'Limite atingido, mas a execução continua usando overage.');
  assert.equal(overage.reset, 't:123000');

  const statusWarning = claudeLimitNotice({rateLimit: {status: 'allowed_warning', type: 'five_hour'}});
  assert.equal(statusWarning.kind, 'warning');
  assert.equal(statusWarning.window, 'five_hour:unknown');

  /* `type` ausente cai no rótulo humano da janela, sem inventar identidade. */
  const labelled = claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, rateLimit: {status: 'rejected', window: 'janela de 5 horas', blocked: true}});
  assert.equal(labelled.type, 'janela de 5 horas');

  /* Liberação: RESUMED (transição nativa), CLEARED (compatibilidade) e
     `status:'allowed'` têm o mesmo efeito e preservam tipo/reset. */
  const resumed = claudeLimitNotice({
    code: RATE_LIMIT_CODES.resumed,
    message: 'Limite de uso liberado (janela de 5 horas).',
    rateLimit: {status: 'allowed', type: 'five_hour', resetsAt: 1770000000, blocked: false, resumed: true},
  });
  assert.deepEqual(resumed, {kind: 'cleared', key: 'cleared', message: '', window: '', type: 'five_hour', reset: 't:1770000000000'});
  assert.deepEqual(claudeLimitNotice({code: RATE_LIMIT_CODES.cleared}), {kind: 'cleared', key: 'cleared', message: '', window: '', type: '', reset: ''});
  assert.deepEqual(claudeLimitNotice({rateLimit: {status: 'allowed', type: 'five_hour'}}), {kind: 'cleared', key: 'cleared', message: '', window: '', type: 'five_hour', reset: ''});
  assert.deepEqual(claudeLimitNotice({rateLimit: {resumed: true, type: 'seven_day'}}), {kind: 'cleared', key: 'cleared', message: '', window: '', type: 'seven_day', reset: ''});

  assert.equal(claudeLimitNotice({type: 'desk_warn', message: 'linha torta no stdout do Pi'}), null);
  assert.equal(claudeLimitNotice({code: 'CLAUDE_OUTRA_COISA', message: 'x'}), null);
  assert.equal(claudeLimitNotice(null), null);
  assert.equal(claudeLimitNotice('texto'), null);

  /* Mesma janela/reset ⇒ mesma chave (o chat deduplica); janela nova ⇒ chave
     nova; sem metadados, a mensagem identifica a janela. */
  const again = claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, message: blocked.message, rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 1770000000, blocked: true}});
  assert.equal(again.key, blocked.key);
  const later = claudeLimitNotice({rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 1770009999, blocked: true}});
  assert.notEqual(later.key, blocked.key);
  const iso = claudeLimitNotice({rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: new Date(1770000000 * 1000).toISOString(), blocked: true}});
  assert.equal(iso.reset, blocked.reset, 'ISO do mesmo instante e epoch nativo compartilham a identidade de reset');
  assert.equal(iso.key, blocked.key);
});

test('limitNoticeState: limpar uma janela liberada NÃO esconde a outra janela rejeitada', () => {
  const blocked = claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, message: 'Bloqueado (5h).', rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 100, blocked: true}});
  const warning = claudeLimitNotice({code: RATE_LIMIT_CODES.warning, message: 'Perto do limite (7d).', rateLimit: {status: 'allowed_warning', type: 'seven_day', resetsAt: 200}});
  const first = limitNoticeState([], blocked, 'conversa-1');
  assert.equal(first.visible.key, blocked.key);
  assert.equal(first.entries.length, 1);
  const both = limitNoticeState(first.entries, warning, 'conversa-1');
  assert.equal(both.entries.length, 2);
  /* O mais grave visível continua sendo o bloqueio. */
  assert.equal(both.visible.key, blocked.key);
  /* Liberar a janela de aviso nem toca no bloqueio. */
  const stillBlocked = limitNoticeState(both.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.resumed, rateLimit: {status: 'allowed', type: 'seven_day'}}), 'conversa-1');
  assert.equal(stillBlocked.entries.length, 1);
  assert.equal(stillBlocked.visible.key, blocked.key);
  /* Liberar a janela bloqueada deixa a outra visível (nada some à toa). */
  const remaining = limitNoticeState(stillBlocked.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.resumed, rateLimit: {status: 'allowed', type: 'five_hour'}}), 'conversa-1');
  assert.deepEqual(remaining.entries, []);
  assert.equal(remaining.visible, null);

  /* Reset diferente na MESMA janela não é limpo por engano. */
  const stored = limitNoticeState([], blocked, 'c');
  const wrongReset = limitNoticeState(stored.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.resumed, rateLimit: {status: 'allowed', type: 'five_hour', resetsAt: 999}}), 'c');
  assert.equal(wrongReset.entries.length, 1);
  /* ISO do mesmo instante do reset numérico LIMPA a janela. */
  const isoCleared = limitNoticeState(stored.entries, claudeLimitNotice({rateLimit: {status: 'allowed', type: 'five_hour', resetsAt: new Date(100 * 1000).toISOString()}}), 'c');
  assert.deepEqual(isoCleared.entries, []);

  /* Liberação sem tipo limpa todas as janelas da conversa, sem tocar em outra. */
  const other = limitNoticeState(both.entries, warning, 'outra-conversa');
  assert.equal(other.entries.length, 3);
  const clearedAll = limitNoticeState(other.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.cleared}), 'conversa-1');
  assert.equal(clearedAll.entries.length, 1);
  assert.equal(clearedAll.entries[0].conversationId, 'outra-conversa');
  assert.equal(clearedAll.visible, null, 'a conversa limpa não vê aviso alheio');

  /* Substituir a mesma janela troca mensagem/chave sem duplicar entrada. */
  const replaced = limitNoticeState(stored.entries, claudeLimitNotice({code: RATE_LIMIT_CODES.blocked, message: 'Bloqueio repetido.', rateLimit: {status: 'rejected', type: 'five_hour', resetsAt: 100, blocked: true}}), 'c');
  assert.equal(replaced.entries.length, 1);
  assert.equal(replaced.visible.message, 'Bloqueio repetido.');
  /* A entrada original não é mutada. */
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].message, 'Bloqueado (5h).');
});

test('claudeActivityNotice: retry/overload/fallback/recusa viram faixa+toast concisos e deduplicáveis', () => {
  const marked = message('claude.activity.retryAttempt', {attempt: 2, max: 5});
  assert.equal(ptText(marked), 'O Claude Code está repetindo a chamada à API (tentativa 2 de 5).');
  assert.equal(enText(marked), 'Claude Code is retrying the API call (attempt 2 of 5).');
  const retry = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'Retry nativo.', detail: {attempt: 2, maxRetries: 5, retryDelayMs: 1500, errorStatus: null}});
  assert.deepEqual(retry, {
    kind: 'retry',
    code: 'CLAUDE_API_RETRY',
    key: `retry:2::${marked}`,
    message: marked,
  });
  /* O mesmo attempt deduplica; o attempt seguinte tem chave nova. */
  const retryAgain = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'x', detail: {attempt: 2, maxRetries: 5}});
  assert.equal(retryAgain.key, retry.key);
  const retryNext = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'x', detail: {attempt: 3, maxRetries: 5}});
  assert.notEqual(retryNext.key, retry.key);
  /* Sem detail, o texto do adaptador continua valendo. */
  const retryText = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'O Claude Code está repetindo uma chamada à API.'});
  assert.equal(retryText.message, 'O Claude Code está repetindo uma chamada à API.');
  /* dedupeKey do host vence a composição local. */
  const deduped = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.retry, detail: {attempt: 9, maxRetries: 9, dedupeKey: 'api_retry:9:529:none'}});
  assert.match(deduped.key, /api_retry:9:529:none/);

  const overloaded = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.overloaded, message: 'API sobrecarregada (529).'});
  assert.equal(overloaded.kind, 'overloaded');
  assert.equal(overloaded.message, 'API sobrecarregada (529).');
  assert.equal(ptText(claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.overloaded}).message), 'A API do Claude está sobrecarregada; a execução tenta de novo.');

  const fallback = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.fallback, message: 'Modelo de segurança respondeu.', detail: {retractedMessageUuids: ['u1'], retractedCount: 1}});
  assert.equal(fallback.kind, 'fallback');
  assert.equal(fallback.message, 'Modelo de segurança respondeu.');
  const fallbackModel = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.fallback, detail: {fallbackModel: 'claude-sonnet'}});
  assert.equal(ptText(fallbackModel.message), 'Modelo alternativo em uso: claude-sonnet.');

  const refusal = claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.refusal, message: 'o modelo recusou a solicitação (cyber)'});
  assert.equal(refusal.kind, 'refusal');
  assert.equal(refusal.message, 'o modelo recusou a solicitação (cyber)');
  assert.equal(ptText(claudeActivityNotice({code: ACTIVITY_NOTICE_CODES.refusal}).message), 'O modelo recusou a solicitação.');

  /* Aviso de limite não é aviso de atividade (e vice-versa): cada classificador
     só responde pelo seu contrato. */
  assert.equal(claudeActivityNotice({code: RATE_LIMIT_CODES.blocked, message: 'x'}), null);
  assert.equal(claudeLimitNotice({code: ACTIVITY_NOTICE_CODES.retry, message: 'x'}), null);
  assert.equal(claudeActivityNotice({type: 'desk_warn', message: 'linha torta'}), null);
  assert.equal(claudeActivityNotice(null), null);
});

test('deskErrorIsFatal: só o `fatal:false` exato deixa o turno seguir sem derrubar conexão/busy/fila', () => {
  assert.equal(deskErrorIsFatal(undefined), true);
  assert.equal(deskErrorIsFatal(null), true);
  assert.equal(deskErrorIsFatal({}), true);
  assert.equal(deskErrorIsFatal({fatal: true}), true);
  assert.equal(deskErrorIsFatal({fatal: false}), false);
  assert.equal(deskErrorIsFatal({fatal: 'false'}), true, 'só o booleano exato vale');
  assert.equal(deskErrorIsFatal({fatal: 0}), true);
});

test('contrato do aviso de limite casa com os códigos do adaptador pinado', {skip: !existsSync(fileURLToPath(new URL('../src/agents/claude-adapter.cjs', import.meta.url)))}, () => {
  /* Somente leitura: ancora os códigos do módulo no adaptador real (donde vêm
     os eventos `warning`) para uma renomeação não passar em silêncio. */
  /* Desde a #43 fase 2 o adaptador mora em claude-adapter*.cjs (limites e avisos em -rate-limit). */
  const agentsDir = fileURLToPath(new URL('../src/agents/', import.meta.url));
  const source = readdirSync(agentsDir).filter((file) => /^claude-adapter.*\.cjs$/.test(file))
    .map((file) => readFileSync(agentsDir + file, 'utf8')).join('\n');
  assert.match(source, /CLAUDE_RATE_LIMITED/);
  assert.match(source, /CLAUDE_RATE_LIMIT_WARNING/);
  assert.match(source, /CLAUDE_RATE_LIMIT_OVERAGE/);
  assert.match(source, /CLAUDE_RATE_LIMIT_RESUMED/);
  assert.match(source, /CLAUDE_API_RETRY/);
  assert.match(source, /CLAUDE_OVERLOADED/);
  assert.match(source, /CLAUDE_MODEL_REFUSAL/);
  assert.equal(RATE_LIMIT_CODES.blocked, 'CLAUDE_RATE_LIMITED');
  assert.equal(RATE_LIMIT_CODES.warning, 'CLAUDE_RATE_LIMIT_WARNING');
  assert.equal(RATE_LIMIT_CODES.overage, 'CLAUDE_RATE_LIMIT_OVERAGE');
  assert.equal(RATE_LIMIT_CODES.resumed, 'CLAUDE_RATE_LIMIT_RESUMED');
  assert.equal(ACTIVITY_NOTICE_CODES.retry, 'CLAUDE_API_RETRY');
  assert.equal(ACTIVITY_NOTICE_CODES.overloaded, 'CLAUDE_OVERLOADED');
  assert.equal(ACTIVITY_NOTICE_CODES.refusal, 'CLAUDE_MODEL_REFUSAL');
});
