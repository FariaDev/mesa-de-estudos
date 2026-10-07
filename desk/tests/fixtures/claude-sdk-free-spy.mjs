/* Fixture espiã para os testes da aba Livre: delega ao fake SDK real e grava
   o `systemPrompt`/`cwd` que o host passou, para provar que a sessão Livre usa
   o prompt GENÉRICO (sem TUTOR/LEARNER da matéria/vault) e um cwd próprio.
   Nenhuma credencial, nenhum processo Claude, nenhuma sessão real. */
import fs from 'node:fs';
import {query as baseQuery, getSessionMessages} from './claude-sdk-fake.mjs';

function record(options = {}) {
  const file = process.env.FAKE_CLAUDE_SYSTEM_LOG;
  if (!file) return;
  try {
    fs.appendFileSync(file, JSON.stringify({
      at: Date.now(),
      cwd: String(options.cwd || ''),
      systemPrompt: String(options.systemPrompt || ''),
    }) + '\n');
  } catch {}
}

export function query(input = {}) {
  record(input.options || {});
  return baseQuery(input);
}

export {getSessionMessages};
