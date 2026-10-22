import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* Fixtures sintéticas para os testes de backup/compartilhamento (nada de
   material real, nada de credencial de verdade, nada de sessão do usuário). */

export const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type/Catalog>>\nendobj\ntrailer\n<</Root 1 0 R>>\n%%EOF\n');

export function tempDir(tag = 'mesa-backup') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${tag}-`));
}

export function write(base, rel, data) {
  const abs = path.join(base, rel);
  fs.mkdirSync(path.dirname(abs), {recursive: true});
  fs.writeFileSync(abs, Buffer.isBuffer(data) ? data : String(data));
  return abs;
}

export function read(base, rel, encoding = 'utf8') {
  return fs.readFileSync(path.join(base, rel), encoding);
}

/* Runtime sintético com TODAS as áreas citadas no pedido + as negativas que o
   backup precisa recusar. Devolve `{runtime, courseDir, materialsDir}`. */
export function seedRuntime({cloak = 'mat-1'} = {}) {
  const runtime = tempDir('mesa-rt');
  const courseDir = path.join(runtime, 'learning', 'Courses', 'Algebra Linear');
  const materialsDir = tempDir('mesa-materiais');
  const piSession = path.join(runtime, 'pi-1700000000000.jsonl');
  const xoppPath = path.join(runtime, 'estudo.xopp');
  write(runtime, 'desk.json', JSON.stringify({
    theme: 'dark',
    state: {
      courseId: cloak,
      courseStates: {
        [cloak]: {
          sessions: [{path: piSession, started: 1700000000000, preview: 'sessão do Pi'}],
          draft: 'rascunho do estudo',
          sessionLayouts: {[piSession]: {draft: 'rascunho do layout', pdfs: [path.join(materialsDir, 'aula.pdf')], study: {title: 'Estudo', xopp: xoppPath}}},
          sessionStudies: {[piSession]: {title: 'Estudo', xopp: xoppPath}},
        },
      },
    },
  }));
  /* Rótulos e rascunhos persistidos do usuário: identidade = id da matéria +
     caminho RELATIVO ao runtime (o que os faz sobreviver à relocação). */
  const relSession = path.relative(runtime, piSession);
  write(runtime, 'chat-library.json', JSON.stringify({version: 1, items: {[JSON.stringify([cloak, relSession])]: {title: 'Conversa da matéria', topic: 'Limites', favorite: true}}}));
  write(runtime, 'pdf-drafts.json', JSON.stringify({[JSON.stringify([cloak, relSession])]: {id: 'draft-1', title: 'Material gerado', markdown: '# rascunho do usuário'}}));
  write(runtime, 'pending.json', JSON.stringify({items: [{id: 'q1', text: 'fila retida: não reenviar'}], held: []}));
  write(runtime, 'review.json', JSON.stringify({[cloak]: [{question: 'Derive x²', attempt: '2x', difficulty: 'media', ref: {name: 'aula.pdf', page: 3, path: path.join(materialsDir, 'aula.pdf')}}]}));
  write(runtime, 'bookmarks.json', JSON.stringify({[cloak]: [{name: 'Limites', path: path.join(materialsDir, 'aula.pdf'), page: 7}]}));
  write(runtime, 'resume.json', JSON.stringify({[cloak]: {next: 'continuar a lista 3'}}));
  write(runtime, 'sidechats/index.json', JSON.stringify({version: 1, mapping: {}}));
  write(runtime, 'sidechats/sc-123.json', JSON.stringify({id: 'sc-123', draft: 'pergunta lateral'}));
  write(runtime, 'conversations/claude-11111111-2222-3333-4444-555555555555.json', JSON.stringify({
    schemaVersion: 1, engine: 'claude', id: 'claude-11111111-2222-3333-4444-555555555555',
    nativeSessionId: '22222222-3333-4444-5555-666666666666', nativeEstablished: true, courseId: cloak,
    preview: 'conversa claude da matéria', messages: [{role: 'user', content: 'oi'}],
  }));
  write(runtime, 'pi-1700000000000.jsonl', '{"role":"user","message":{"role":"user","content":"sessão do Pi"}}\n');
  write(runtime, 'pdf-notes.json', JSON.stringify({[cloak]: [{id: 'note-1', kind: 'nota', quote: 'trecho', note: 'observação', ref: {name: 'aula.pdf', rel: 'aula.pdf', path: path.join(materialsDir, 'aula.pdf'), page: 3}, createdAt: 1700000000000, updatedAt: 1700000000000}]}));
  write(runtime, 'handoff/handoff-duvida-1234.json', JSON.stringify({phase: 'duvida', note: 'entrega incerta: preservar'}));
  write(runtime, 'handoff/falha/falha-1.json', JSON.stringify({phase: 'falha'}));
  write(runtime, 'free/aaaa/materials/gerado.md', '# material gerado\n');
  write(runtime, 'free/aaaa/workspace.json', JSON.stringify({id: 'aaaa', title: 'Livre', nativePath: path.join(runtime, 'free', 'aaaa', 'pi-livre.jsonl'), materials: [{id: 'm1', name: 'gerado.md', path: path.join(runtime, 'free', 'aaaa', 'materials', 'gerado.md')}]}));
  write(runtime, 'free/aaaa/pi-livre.jsonl', '{"role":"user","message":{"role":"user","content":"sessão Livre"}}\n');
  write(runtime, 'ggb/board.json', JSON.stringify({app: 'classic'}));
  write(runtime, 'learning/TUTOR.md', '# Tutor do usuário\n');
  write(runtime, 'learning/LEARNER.md', '# Learner do usuário\n');
  write(courseDir, '_state.md', '# Estado da matéria\n');
  write(path.join(runtime, 'learning', 'Courses', cloak), '_state.md', '# Estado da matéria (id)\n');
  write(courseDir, 'TUTOR.md', '# Tutor da matéria\n');
  write(courseDir, '.pi/skills/tutor.md', '# skill\n');
  write(courseDir, 'Sessions/2026-01-01-120000--abc.md', '# sessão\n');
  write(runtime, 'estudo.xopp', Buffer.from('xopp-binario'));

  /* Negativas: credencial, cache do Electron, log, rascunho de revisão,
     workspace efêmero do Claude e diretório de estado do próprio backup. */
  write(runtime, 'auth.json', '{"token":"NUNCA-BACKUP"}');
  write(runtime, 'settings.local.json', '{"apikey":"NUNCA"}');
  write(runtime, 'electron/Cache/data_0', 'cache do chromium');
  write(runtime, 'desk.log', 'linha de log');
  write(runtime, 'desk.log.1', 'linha de log rotacionada');
  write(runtime, '.review-draft-99.json', '{"draft":"temporário"}');
  write(runtime, 'claude-workspaces/xyz/claude-settings.json', '{"efêmero":true}');
  write(runtime, '.backup/staging/plan-x/arquivo', 'staging de restauração');
  write(runtime, 'update.lock', 'lock');

  /* Nome comum de pasta do usuário NÃO é credencial/cache: tem de entrar. */
  write(runtime, 'backups/meu-backup.md', '# anotação do usuário\n');
  write(runtime, 'downloads/apostila.md', '# apostila baixada\n');
  write(runtime, 'history.jsonl', '{"linha":"histórico do usuário"}\n');
  write(runtime, 'tmp-relatorio.md', '# começa com tmp- mas é do usuário\n');
  write(runtime, '.backup-do-usuario/anotacao.md', '# cópia que o usuário guardou\n');

  /* Material da matéria (pasta configurada) e arquivos soltos. */
  write(materialsDir, 'aula.pdf', PDF_BYTES);
  write(materialsDir, 'diagrama.png', Buffer.from('89504e470d0a1a0a-fake-png'));
  write(materialsDir, 'anotacoes.md', '# anotações\n');
  write(materialsDir, 'Sessions/da-matéria.md', '# sessão do material\n');
  write(materialsDir, 'Sources/extra.txt', 'fonte extra\n');
  write(materialsDir, 'downloads/lista-extra.pdf', PDF_BYTES);

  /* Área externa (allowlist): sessão nativa sintética do agente. */
  const agentHome = tempDir('mesa-agente');
  const nativeSession = write(agentHome, 'sessions/sessao-nativa.jsonl', '{"role":"user","message":{"role":"user","content":"nativa"}}\n');
  const nativeCache = write(agentHome, 'cache/cache-nativo.json', '{"cache":true}');
  const nativeAuth = write(agentHome, 'auth.json', '{"token":"NUNCA"}');

  return {runtime, courseDir, materialsDir, agentHome, nativeSession, nativeCache, nativeAuth};
}

export function walkFiles(root) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, {withFileTypes: true})) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel);
      else if (entry.isFile()) out.push(childRel);
      else if (entry.isSymbolicLink()) out.push(`${childRel} (link)`);
    }
  };
  if (fs.existsSync(root)) walk(root, '');
  return out.sort();
}

export function cleanup(...dirs) {
  for (const dir of dirs) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch {}
  }
}
