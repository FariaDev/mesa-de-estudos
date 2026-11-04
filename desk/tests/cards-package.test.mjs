/* Pacote de estudo com quiz não respondido (#92, achado 4): o JSONL bruto vai
   no pacote (é a conversa), mas o aluno que importa e abre não pode ver a
   resposta certa na tela. O pacote é o de verdade: buildPackage + importPackage,
   e o histórico importado passa pelo MESMO `historyTurns` da janela. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {historyTurns} from '../src/worklog.mjs';

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const zipkit = require('../src/study-data/zipkit.cjs');

const SECRET = 'SEGREDO-DO-PACOTE';
const EXPLANATION = 'EXPLICACAO-DO-PACOTE';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-card-pkg-'));
  const runtime = path.join(root, 'runtime');
  const course = path.join(runtime, 'learning', 'Courses', 'Calculo');
  fs.mkdirSync(course, {recursive: true});
  const session = path.join(runtime, 'pi-1000.jsonl');
  const messages = [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'me dá um quiz'}]}},
    {type: 'message', message: {role: 'assistant', content: [
      {type: 'text', text: 'Deixei o cartão.'},
      {type: 'toolCall', id: 'card-1', name: 'mesa_quiz', arguments: {
        question: 'Quanto é 2+2?', options: [{label: '3'}, {label: '4'}],
        correctAnswer: SECRET, explanation: EXPLANATION,
      }},
    ]}},
    {type: 'message', message: {role: 'toolResult', toolCallId: 'card-1', content: [{type: 'text', text: 'Mostrado ao aluno.'}]}},
  ];
  fs.writeFileSync(session, messages.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({
    session, courseId: 'C',
    courseStates: {C: {session, sessions: [{path: session, started: 1}]}},
  }));
  return {root, runtime, session};
}

test('pacote real leva o JSONL, mas o histórico importado não expõe a resposta antes de responder', () => {
  const f = fixture();
  try {
    const built = packages.buildPackage({
      runtime: f.runtime,
      course: {id: 'C', name: 'Cálculo'},
      learningDir: path.join(f.runtime, 'learning', 'Courses', 'Calculo'),
      include: {conversations: true, review: false, bookmarks: false, resume: false, annotations: false},
    });
    const entries = zipkit.readZip(built.buffer);
    const raw = entries.find((entry) => entry.name.startsWith('payload/conversations/pi/'));
    assert.ok(raw, 'a conversa do Pi entra no pacote');
    assert.match(raw.data.toString('utf8'), new RegExp(SECRET), 'o JSONL bruto carrega a resposta (é o dado da conversa)');

    const destinationRoot = path.join(f.root, 'destino');
    fs.mkdirSync(destinationRoot, {recursive: true});
    const destination = packages.planDestination({root: destinationRoot, name: 'Cálculo'});
    const imported = packages.importPackage({buffer: built.buffer, destination, courseId: 'materia-nova'});
    const files = fs.readdirSync(path.join(imported.conversationsDir, 'claude'));
    assert.equal(files.length, 1);
    const descriptor = JSON.parse(fs.readFileSync(path.join(imported.conversationsDir, 'claude', files[0]), 'utf8'));
    const turns = historyTurns(descriptor.messages);
    assert.ok(!JSON.stringify(turns).includes(SECRET), 'o histórico importado não vira passo com a resposta');
    assert.ok(!JSON.stringify(turns).includes(EXPLANATION), 'nem com a explicação');
  } finally {
    try { fs.rmSync(f.root, {recursive: true, force: true}); } catch {}
  }
});
