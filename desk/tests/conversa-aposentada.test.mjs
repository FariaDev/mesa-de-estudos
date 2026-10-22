/* Regressão da #50 (aposentadoria do app Conversa): dado antigo do bilhete
 * Conversa → Mesa continua sendo lido, e a Mesa não depende mais de nada dele.
 *
 * O recebimento do bilhete saiu da Mesa, mas dois tipos de dado gravado antes
 * disso seguem nos computadores de quem usava os dois apps:
 *   - sessões do Pi com o bloco `[Da Conversa]` no fim da mensagem do usuário;
 *   - a pasta `<runtime>/handoff/` em todas as fases do protocolo antigo.
 * A tag local `conversa-final` guarda o código que os escrevia.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {displayUserText} from '../text.mjs';
import {seedRuntime, walkFiles, read, tempDir, cleanup} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const {sessionPreviewFromJsonl} = require('../lib.cjs');
const deskDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Mensagem do usuário como o app antigo a gravava: pergunta + bloco do bilhete. */
const FIXTURE_MENSAGEM_ANTIGA = {
  soBilhete: 'quanto vale o limite?\n\n[Da Conversa]\n- objetivo: revisar limites\n- pergunta pendente: como isolar x?',
  comContexto: 'confere minha resposta\n\n[Contexto da Mesa]\n- matéria: Cálculo I\n\n[Da Conversa]\n- objetivo: revisar limites',
  comReferencias: 'e agora?\n\n[Da Conversa]\n- objetivo: x\n- referências trazidas da Conversa:\n  · /tmp/a.pdf',
};

test('sessão antiga: o bloco do bilhete não aparece no transcript, com ou sem contexto da Mesa', () => {
  assert.equal(displayUserText(FIXTURE_MENSAGEM_ANTIGA.soBilhete), 'quanto vale o limite?');
  assert.equal(displayUserText(FIXTURE_MENSAGEM_ANTIGA.comContexto), 'confere minha resposta');
  assert.equal(displayUserText(FIXTURE_MENSAGEM_ANTIGA.comReferencias), 'e agora?');
});

test('sessão antiga: o preview da lista corta o bloco do bilhete', () => {
  const line = (text) => JSON.stringify({type: 'message', message: {role: 'user', content: [{type: 'text', text}]}});
  const preview = sessionPreviewFromJsonl(line(FIXTURE_MENSAGEM_ANTIGA.soBilhete));
  assert.ok(preview, 'o preview precisa sair');
  assert.doesNotMatch(preview, /\[Da Conversa\]/, 'o marcador não aparece na lista de sessões');
  assert.doesNotMatch(preview, /revisar limites/, 'nem o conteúdo que veio com ele');
});

test('runtime antigo: a pasta handoff/ vai e volta no backup byte a byte, sem erro', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const fases = {
      'handoff/conversa.json': '{"v":1,"from":"conversa","goal":"pendente"}\n',
      'handoff/reivindicado-1790000000000-1-1': '{"goal":"reivindicado"}\n',
      'handoff/enviando-1790000000000-1-2': '{"goal":"enviando"}\n',
      'handoff/entregue-1790000000000': '{"goal":"entregue"}\n',
      'handoff/arquivo/1790000000000.json': '{"goal":"arquivado"}\n',
      'handoff/duvida/1790000000000-incerto.json': '{"goal":"em dúvida"}\n',
    };
    for (const [rel, body] of Object.entries(fases)) {
      const file = path.join(fixture.runtime, ...rel.split('/'));
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, body);
    }
    const snapshot = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    for (const rel of Object.keys(fases)) fs.rmSync(path.join(fixture.runtime, ...rel.split('/')));

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});

    assert.equal(applied.applied, true);
    for (const [rel, body] of Object.entries(fases)) assert.equal(read(fixture.runtime, rel), body, `restaurado ${rel}`);
    assert.ok(walkFiles(fixture.runtime).includes('handoff/falha/falha-1.json'), 'o fixture já trazia uma falha antiga');
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('a Mesa não carrega mais nada do bilhete nem de chat/', () => {
  /* Os hosts que saíram do main (#43 fase 2) continuam vigiados. */
  const hosts = fs.readdirSync(deskDir).filter((name) => /(-host|-ipc)\.cjs$/.test(name));
  const vivos = ['main.cjs', 'preload.cjs', 'send.cjs', 'rpc.cjs', 'src/main.mjs', 'scripts/doctor.mjs', ...hosts];
  for (const rel of vivos) {
    const text = fs.readFileSync(path.join(deskDir, rel), 'utf8');
    assert.doesNotMatch(text, /handoff\.cjs|claimHand|recoverClaims|onHandoff|handoff-received|handoff-problem/, `${rel} ainda fala do bilhete`);
    assert.doesNotMatch(text, /\.\.\/chat\b|\/chat\/(?:rpc|pi|handoff)/, `${rel} ainda depende de chat/`);
  }
  for (const gone of ['handoff.cjs', 'src/generated/handoff.core.js']) {
    assert.equal(fs.existsSync(path.join(deskDir, gone)), false, `${gone} devia ter saído`);
  }
  assert.ok(os.tmpdir(), 'guarda de sanidade do ambiente');
});
