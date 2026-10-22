/* Descritor da conversa OpenCode (#57): mesmo esquema do Claude em
   `opencode-<uuid>.json`, com o nativo `ses_…` que o servidor exige. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');

test('cria, lê, classifica e atualiza o descritor OpenCode sem misturar com o Claude', () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-conv-'));
  const file = conversations.createClaudeConversation({runtime, courseId: 'calc', engine: 'opencode'});
  assert.match(path.basename(file), /^opencode-[0-9a-f-]{36}\.json$/);
  const record = conversations.readClaudeConversation(file, {runtime});
  assert.equal(record.engine, 'opencode');
  /* O `ses_` vem do servidor (403 do grátis com id da Mesa, 2026-10-20). */
  assert.equal(record.nativeSessionId, null);
  assert.equal(conversations.conversationEngine(file, {runtime}), 'opencode');
  assert.equal(conversations.conversationMetadata(file, {runtime}).engine, 'opencode');
  assert.throws(() => conversations.updateClaudeConversation(file, {nativeSessionId: 'b7d1d2c3-0000-4000-8000-000000000000'}, {runtime}));
  assert.throws(() => conversations.updateClaudeConversation(file, {nativeSessionId: null}, {runtime}));
  const serverId = 'ses_ea5e2cf67ffeh4QXVLFnu10D1S';
  assert.equal(conversations.updateClaudeConversation(file, {nativeSessionId: serverId}, {runtime}).nativeSessionId, serverId);
  assert.equal(conversations.updateClaudeConversation(file, {nativeSessionId: serverId}, {runtime}).nativeSessionId, serverId);
  assert.throws(() => conversations.updateClaudeConversation(file, {nativeSessionId: 'ses_ea5e2000affeZzYyXxWwVvUuTt'}, {runtime}), /imutável/);
  assert.equal(conversations.updateClaudeConversation(file, {delivery: {id: 'u1', status: 'accepted'}}, {runtime}).delivery.status, 'accepted');
  assert.equal(conversations.recoverClaudeConversation(file, {runtime}).delivery.status, 'uncertain');
  assert.throws(() => conversations.createClaudeConversation({runtime, engine: 'pi'}));
  const claude = conversations.createClaudeConversation({runtime, courseId: 'calc'});
  assert.equal(conversations.conversationEngine(claude, {runtime}), 'claude');
});
