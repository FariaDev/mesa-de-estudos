/* Registro de conversa Claude (descritor JSON real) e compatibilidade Pi.
 *
 * O que o teste fixa: identidade por CAMINHO do descritor (não `claude:uuid`);
 * `nativeSessionId` separado e `nativeEstablished` como portão de retomada;
 * leitura validada (engine/id/versão/tetos, realpath sem escape de symlink);
 * escrita atômica que preserva o anterior; recuperação que transforma entrega
 * em voo em `uncertain` (sem reenvio); e o Pi intocado (JSONL byte a byte,
 * chave da fila no pending.cjs sobrevive à poda).
 *
 * Sem Electron, sem Pi real e sem rede: só fs temporário.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const conversations = require('../src/agents/conversations.cjs');
const pending = require('../pending.cjs');

test('cache trimming keeps the newest complete UTF-8/image suffix within the byte cap',()=>{
 const image={role:'user',content:[{type:'image',data:'a'.repeat(conversations.MAX_MESSAGES_BYTES/2)}]};
 const newest={role:'assistant',content:[{type:'text',text:'ação 😀 \\ " fim'}]};
 const input=[image,image,newest];
 const bounded=conversations.boundMessages(input);
 assert.deepEqual(bounded,[image,newest]);
 assert.equal(input.length,3,'the source transcript is preserved');
 assert.ok(Buffer.byteLength(JSON.stringify(bounded),'utf8')<=conversations.MAX_MESSAGES_BYTES);
 assert.ok(Buffer.byteLength(JSON.stringify([image,...bounded]),'utf8')>conversations.MAX_MESSAGES_BYTES,'retained suffix is maximal');
 assert.deepEqual(conversations.boundMessages([{content:'x'.repeat(conversations.MAX_MESSAGES_BYTES)}]),[],'oversized newest message cannot fit');
});

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-claude-conv-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value));
const readRaw = (file) => readFileSync(file, 'utf8');
const readJson = (file) => JSON.parse(readRaw(file));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value));
const tmpLeftovers = (dir) => readdirSync(dir).filter((name) => name.includes('.tmp-'));

test('model/effort selection survives reopen without changing the native session or delivery', () => {
  withRuntime((runtime) => {
    const file = conversations.createClaudeConversation({runtime, courseId: 'c1', model: 'sonnet', effort: 'high'});
    const original = conversations.readClaudeConversation(file, {runtime});
    conversations.updateClaudeConversation(file, {model: 'opus', effort: 'max'}, {runtime});
    const reopened = conversations.readClaudeConversation(file, {runtime});
    assert.equal(reopened.model, 'opus');
    assert.equal(reopened.effort, 'max');
    assert.equal(reopened.nativeSessionId, original.nativeSessionId);
    assert.equal(reopened.nativeEstablished, false);
    const saved = readRaw(file);
    assert.throws(() => conversations.updateClaudeConversation(file, {model: 'other', effort: 'x'.repeat(25)}, {runtime}), /effort/);
    assert.equal(readRaw(file), saved, 'an invalid effort cannot partially change the model');
    conversations.updateClaudeConversation(file, {effort: null}, {runtime});
    assert.equal(conversations.readClaudeConversation(file, {runtime}).effort, undefined);
    assert.throws(() => conversations.createClaudeConversation({runtime, courseId: 'c1', effort: {} }), /effort/);
  });
});

function create(runtime, extra = {}) {
  const file = conversations.createClaudeConversation({runtime, courseId: 'calculo-1', ...extra});
  return {file, dir: join(runtime, 'conversations')};
}

test('create grava descritor exclusivo com id/nativeSessionId separados e nativeEstablished=false', () => {
  withRuntime((runtime) => {
    const {file, dir} = create(runtime, {model: 'claude-sonnet-4-5'});
    assert.equal(file, join(dir, `claude-${readJson(file).id}.json`));
    assert.match(file, /claude-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/);
    const descriptor = conversations.readClaudeConversation(file, {runtime});
    assert.equal(descriptor.schemaVersion, 1);
    assert.equal(descriptor.engine, 'claude');
    assert.equal(descriptor.id, descriptor.id.toLowerCase());
    assert.match(descriptor.nativeSessionId, /^[0-9a-f-]{36}$/);
    assert.notEqual(descriptor.nativeSessionId, descriptor.id, 'referência nativa é separada do id local');
    assert.equal(descriptor.nativeEstablished, false, 'precriado não autoriza retomar');
    assert.equal(descriptor.courseId, 'calculo-1');
    assert.ok(descriptor.started > 0);
    assert.equal(descriptor.preview, '');
    assert.equal(descriptor.model, 'claude-sonnet-4-5');
    assert.deepEqual(tmpLeftovers(dir), [], 'create não deixa tmp para trás');
    assert.equal(conversations.descriptorPath(runtime, descriptor.id), file);

    const first = readRaw(file);
    const second = create(runtime);
    assert.notEqual(second.file, file, 'segunda conversa não reusa o arquivo');
    assert.equal(readRaw(file), first, 'create existente nunca é sobrescrito');
  });
});

test('read recusa ausente, nome não gerenciado, engine/versão/id/tipo inválidos e JSON torto', () => {
  withRuntime((runtime) => {
    const dir = join(runtime, 'conversations');
    mkdirSync(dir, {recursive: true});
    assert.equal(conversations.readClaudeConversation(join(dir, 'claude-00000000-0000-4000-8000-000000000000.json')), null);

    const valid = {
      schemaVersion: 1,
      engine: 'claude',
      id: 'a2c7ff60-6e3c-4c62-9d3e-1c1e2a3b4c5d',
      nativeSessionId: 'b2c7ff60-6e3c-4c62-9d3e-1c1e2a3b4c5d',
      nativeEstablished: false,
      courseId: 'c1',
      started: 1,
      preview: ''
    };
    const file = join(dir, `claude-${valid.id}.json`);

    writeFileSync(join(runtime, 'pi-1700000000000.jsonl'), JSON.stringify(valid));
    assert.equal(conversations.readClaudeConversation(join(runtime, 'pi-1700000000000.jsonl')), null, 'nome de sessão Pi nunca é descritor');
    writeJson(join(dir, 'notas.json'), valid);
    assert.equal(conversations.readClaudeConversation(join(dir, 'notas.json')), null, 'nome não gerenciado não é lido');

    const cases = {
      'versão futura': (raw) => {raw.schemaVersion = 2;},
      'engine errado': (raw) => {raw.engine = 'pi';},
      'id que não é uuid': (raw) => {raw.id = 'conversa-1';},
      'id diferente do arquivo': (raw) => {raw.id = '00000000-0000-4000-8000-000000000000';},
      'nativeSessionId inválido': (raw) => {raw.nativeSessionId = 'sessão-nativa';},
      'nativeEstablished ausente': (raw) => {delete raw.nativeEstablished;},
      'nativeEstablished não booleano': (raw) => {raw.nativeEstablished = 'sim';},
      'started inválido': (raw) => {raw.started = 'ontem';},
      'preview não string': (raw) => {raw.preview = 7;},
      'delivery sem id': (raw) => {raw.delivery = {id: '', status: 'transmitting'};},
      'delivery status desconhecido': (raw) => {raw.delivery = {id: 'd1', status: 'queued'};},
      'messages não lista': (raw) => {raw.messages = 'oi';},
      'mensagem com papel desconhecido': (raw) => {raw.messages = [{role: 'system', content: []}];},
      'parte desconhecida': (raw) => {raw.messages = [{role: 'assistant', content: [{type: 'audio'}]}];},
      'texto acima do teto': (raw) => {raw.messages = [{role: 'user', content: [{type: 'text', text: 'x'.repeat(400001)}]}];}
    };
    for (const [label, mutate] of Object.entries(cases)) {
      const raw = JSON.parse(JSON.stringify(valid));
      mutate(raw);
      writeJson(file, raw);
      assert.equal(conversations.readClaudeConversation(file), null, `recusa: ${label}`);
    }
    writeFileSync(file, '{isso não é json');
    assert.equal(conversations.readClaudeConversation(file), null, 'JSON torto não vira descritor');
  });
});

test('runtime resolve realpath e recusa symlink/arquivo fora de conversations', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime);
    assert.ok(conversations.readClaudeConversation(file, {runtime}), 'descritor normal passa');

    /* Cópia válida fora de runtime/conversations: com runtime não é lida. */
    const outside = join(runtime, 'fora');
    mkdirSync(outside, {recursive: true});
    const moved = join(outside, file.slice(file.lastIndexOf('/') + 1));
    renameSync(file, moved);
    assert.equal(conversations.readClaudeConversation(moved, {runtime}), null, 'fora de conversations não é descritor');
    assert.deepEqual(conversations.readClaudeConversation(moved), JSON.parse(readRaw(moved)), 'sem runtime o nome gerenciado basta');

    /* Symlink de volta para o alvo fora: com runtime o realpath barra. */
    symlinkSync(moved, file);
    assert.equal(conversations.readClaudeConversation(file, {runtime}), null, 'symlink para fora não escapa');
    assert.equal(conversations.readClaudeConversation(file) && 'lido', 'lido', 'a contenção é do read com runtime');
    assert.throws(() => conversations.conversationEngine(file, {runtime}), (error) => error.code === conversations.CORRUPT_DESCRIPTOR_CODE);
  });
});

test('update mescla só campos permitidos, ignora path/id/engine e preserva o anterior em falha', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime, {model: 'claude-sonnet-4-5'});
    const before = conversations.readClaudeConversation(file, {runtime});
    const updated = conversations.updateClaudeConversation(file, {
      preview: 'Lista 2',
      nativeEstablished: true,
      delivery: {id: 'envio-1', status: 'transmitting'},
      pinnedExecutable: '/opt/claude',
      id: '00000000-0000-4000-8000-000000000000',
      engine: 'pi',
      schemaVersion: 9,
      path: '/etc/passwd',
      file: '/etc/passwd',
      runtime: '/etc'
    }, {runtime});
    assert.equal(updated.preview, 'Lista 2');
    assert.equal(updated.nativeEstablished, true);
    assert.deepEqual(updated.delivery, {id: 'envio-1', status: 'transmitting'});
    assert.equal(updated.pinnedExecutable, '/opt/claude');
    assert.equal(updated.id, before.id);
    assert.equal(updated.engine, 'claude');
    assert.equal(updated.schemaVersion, 1);

    const good = readRaw(file);
    assert.throws(() => conversations.updateClaudeConversation(file, {delivery: {id: 'd2', status: 'feito'}}, {runtime}),
      (error) => error.code === conversations.CLAUDE_DESCRIPTOR_PATCH || /inválido/.test(error.message));
    assert.throws(() => conversations.updateClaudeConversation(file, {nativeSessionId: 'nope'}, {runtime}));
    assert.throws(() => conversations.updateClaudeConversation(file, {started: -1}, {runtime}));
    assert.throws(() => conversations.updateClaudeConversation(file, {messages: 'oi'}, {runtime}));
    assert.equal(readRaw(file), good, 'falha de validação não toca no arquivo');
    assert.deepEqual(tmpLeftovers(join(runtime, 'conversations')), []);

    const cleared = conversations.updateClaudeConversation(file, {model: null, pinnedExecutable: null}, {runtime});
    assert.equal(cleared.model, undefined);
    assert.equal(cleared.pinnedExecutable, undefined);
    assert.equal(conversations.updateClaudeConversation(join(runtime, 'conversations', 'claude-00000000-0000-4000-8000-000000000000.json'), {preview: 'x'}, {runtime}), null, 'sem arquivo não há merge');
  });
});

test('messages normaliza, limita a ~12 MiB pelas mais novas e nunca corta a entrega', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime);
    conversations.updateClaudeConversation(file, {delivery: {id: 'envio-9', status: 'accepted'}}, {runtime});
    const image = (tag) => ({
      role: 'user',
      content: [{type: 'image', data: 'A'.repeat(3.5 * 1024 * 1024), mimeType: 'image/png'}, {type: 'text', text: tag}]
    });
    const updated = conversations.updateClaudeConversation(file, {
      messages: [image('m0'), image('m1'), image('m2'), image('m3')]
    }, {runtime});
    assert.ok(updated.messages.length < 4, 'o teto corta mensagens antigas');
    assert.ok(bytesOf(updated.messages) <= conversations.MAX_MESSAGES_BYTES);
    assert.deepEqual(updated.delivery, {id: 'envio-9', status: 'accepted'}, 'entrega em voo não é cortada pelo teto de messages');
    const stored = conversations.readClaudeConversation(file, {runtime});
    assert.equal(stored.messages.at(-1).content.at(-1).text, 'm3', 'as mais novas ficam');
    assert.equal(stored.messages[0].content.at(-1).text, 'm1', 'a mais antiga saiu do descritor');
    assert.deepEqual(stored.delivery, {id: 'envio-9', status: 'accepted'});

    /* Mensagem normalizada de verdade round-trip: imagem + texto + ferramenta. */
    const normalized = conversations.updateClaudeConversation(file, {
      messages: [{
        type: 'assistant',
        message: {role: 'assistant', content: [{type: 'text', text: 'resposta'}, {type: 'tool_use', id: 't1', name: 'Read', input: {file_path: '/x'}}]},
        timestamp: 123
      }]
    }, {runtime}).messages;
    assert.equal(normalized[0].content[1].type, 'toolCall');
    assert.deepEqual(conversations.readClaudeConversation(file, {runtime}).messages, normalized);
  });
});

test('conversationEngine: claude só para descritor válido; corrompido lança, ausente cai em pi', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime);
    assert.equal(conversations.conversationEngine(file, {runtime}), 'claude');
    assert.equal(conversations.conversationEngine(join(runtime, 'pi-1700000000000.jsonl'), {runtime}), 'pi');

    const missing = join(runtime, 'conversations', 'claude-00000000-0000-4000-8000-000000000000.json');
    assert.equal(conversations.conversationEngine(missing, {runtime}), 'pi', 'ausente não é descritor');

    writeFileSync(file, '{');
    assert.throws(() => conversations.conversationEngine(file, {runtime}),
      (error) => error.code === conversations.CORRUPT_DESCRIPTOR_CODE, 'corrompido lança e não vira Pi calado');

    /* Nome gerenciado fora de conversations não é o descritor gerenciado. */
    const outside = join(runtime, 'claude-00000000-0000-4000-8000-000000000000.json');
    writeJson(outside, {
      schemaVersion: 1,
      engine: 'claude',
      id: '00000000-0000-4000-8000-000000000000',
      nativeSessionId: 'b0000000-0000-4000-8000-000000000000',
      nativeEstablished: false,
      courseId: '',
      started: 1,
      preview: ''
    });
    assert.equal(conversations.conversationEngine(outside, {runtime}), 'pi');
    assert.equal(conversations.conversationEngine(outside), 'claude');
  });
});

test('conversationMetadata: campos Claude e fallback Pi sem ler o JSONL nativo', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime, {model: 'claude-haiku-4-5'});
    const metadata = conversations.conversationMetadata(file, {runtime});
    assert.equal(metadata.engine, 'claude');
    assert.equal(metadata.id, readJson(file).id);
    assert.equal(metadata.nativeSessionId, readJson(file).nativeSessionId);
    assert.equal(metadata.nativeEstablished, false);
    assert.equal(metadata.courseId, 'calculo-1');
    assert.equal(metadata.model, 'claude-haiku-4-5');
    assert.equal(metadata.messageCount, 0);

    const jsonl = join(runtime, 'pi-1700000000000.jsonl');
    writeFileSync(jsonl, `${JSON.stringify({message: {role: 'user', content: 'assunto secreto'}})}\n`);
    const pi = conversations.conversationMetadata(jsonl, {runtime});
    assert.equal(pi.engine, 'pi');
    assert.equal(pi.preview, '', 'o fallback não lê o JSONL nativo');
    assert.equal(pi.started, 1700000000000, 'started sai só do nome do arquivo');
    assert.equal(pi.nativeSessionId, null);
  });
});

test('recover: transmitting/accepted viram uncertain sem reenvio; terminais ficam', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime);
    conversations.updateClaudeConversation(file, {delivery: {id: 'envio-1', status: 'transmitting'}, preview: 'pergunta'}, {runtime});
    const recovered = conversations.recoverClaudeConversation(file, {runtime});
    assert.deepEqual(recovered.delivery, {id: 'envio-1', status: 'uncertain'});
    assert.equal(recovered.preview, 'pergunta', 'o resto dos dados fica');
    assert.deepEqual(conversations.recoverClaudeConversation(file, {runtime}).delivery, {id: 'envio-1', status: 'uncertain'}, 'incerto é estável');

    conversations.updateClaudeConversation(file, {delivery: {id: 'envio-2', status: 'accepted'}}, {runtime});
    assert.equal(conversations.recoverClaudeConversation(file, {runtime}).delivery.status, 'uncertain');

    for (const status of ['settled', 'refused', 'uncertain']) {
      conversations.updateClaudeConversation(file, {delivery: {id: 'envio-3', status}}, {runtime});
      const before = readRaw(file);
      const state = conversations.recoverClaudeConversation(file, {runtime});
      assert.equal(state.delivery.status, status);
      assert.equal(readRaw(file), before, `${status} não é reescrito`);
    }

    conversations.updateClaudeConversation(file, {delivery: null}, {runtime});
    const before = readRaw(file);
    conversations.recoverClaudeConversation(file, {runtime});
    assert.equal(readRaw(file), before, 'sem entrega não há escrita');
    assert.equal(conversations.recoverClaudeConversation(join(runtime, 'conversations', 'claude-00000000-0000-4000-8000-000000000000.json'), {runtime}), null);
  });
});

test('recover não apaga descritor corrompido: lança e preserva os bytes', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime);
    writeFileSync(file, '{"schemaVersion":1,"engine":"claude"');
    const before = readRaw(file);
    assert.throws(() => conversations.recoverClaudeConversation(file, {runtime}),
      (error) => error.code === conversations.CORRUPT_DESCRIPTOR_CODE);
    assert.equal(readRaw(file), before, 'dado preservado para conferência');
  });
});

test('identidade por caminho: JSONL de Pi intocado e a fila (pending) sobrevive à poda', () => {
  withRuntime((runtime) => {
    const jsonl = join(runtime, 'pi-1700000000000.jsonl');
    const third = join(runtime, 'pi-1700000000001.jsonl');
    const records = [{message: {role: 'user', content: 'pergunta antiga'}}, {message: {role: 'assistant', content: 'resposta'}}];
    writeFileSync(jsonl, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
    writeFileSync(third, '');
    const jsonlBytes = readRaw(jsonl);

    pending.saveQueue(runtime, jsonl, [{text: 'na fila do Pi', refs: [], images: []}], false);
    const {file} = create(runtime);
    assert.ok(existsSync(file), 'courseSessions/fs.existsSync enxerga o descritor');
    pending.saveQueue(runtime, file, [{text: 'na fila do Claude', refs: [], images: []}], true);
    pending.saveQueue(runtime, third, [{text: 'terceira', refs: [], images: []}], false);

    const store = JSON.parse(readFileSync(join(runtime, pending.FILENAME), 'utf8'));
    assert.deepEqual(Object.keys(store).sort(), [file, jsonl, third].sort(), 'a chave da fila é o caminho do descritor e sobrevive à poda');
    assert.equal(store[file].held, true);
    assert.equal(pending.readPending(runtime, file).items[0].text, 'na fila do Claude');
    assert.equal(readRaw(jsonl), jsonlBytes, 'nenhuma API toca o JSONL do Pi');
    assert.equal(conversations.readClaudeConversation(jsonl, {runtime}), null);
  });
});

test('nativeEstablished é o portão de retomada: precriado fica false e só o adaptador promove', () => {
  withRuntime((runtime) => {
    const {file} = create(runtime);
    const precreated = conversations.readClaudeConversation(file, {runtime});
    assert.equal(precreated.nativeEstablished, false);
    assert.match(precreated.nativeSessionId, /^[0-9a-f-]{36}$/);
    const foreignId = 'c2c7ff60-6e3c-4c62-9d3e-1c1e2a3b4c5d';
    const freshBytes = readRaw(file);
    assert.throws(() => conversations.updateClaudeConversation(file, {nativeSessionId: foreignId}, {runtime}), /imutável/);
    assert.equal(readRaw(file), freshBytes, 'a identidade precriada não pode ser trocada antes da primeira entrega');

    const established = conversations.updateClaudeConversation(file, {nativeEstablished: true, preview: 'Subiu'}, {runtime});
    assert.equal(established.nativeEstablished, true);
    assert.equal(established.nativeSessionId, precreated.nativeSessionId, 'o id nativo criado uma vez não muda ao estabelecer');
    assert.equal(conversations.readClaudeConversation(file, {runtime}).nativeEstablished, true);

    const establishedBytes = readRaw(file);
    assert.throws(() => conversations.updateClaudeConversation(file, {nativeSessionId: foreignId, preview: 'foreign'}, {runtime}), /imutável/);
    assert.equal(readRaw(file), establishedBytes, 'recusar a troca não grava nenhum outro campo do patch');
    const unchanged = conversations.updateClaudeConversation(file, {nativeSessionId: precreated.nativeSessionId}, {runtime});
    assert.equal(unchanged.nativeSessionId, precreated.nativeSessionId);
  });
});
