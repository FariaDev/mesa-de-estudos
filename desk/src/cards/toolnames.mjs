/* Nomes de ferramenta dos cartões, de uma fonte só (#92). O Pi registra
   `mesa_quiz`/`mesa_perguntar`; o Claude expõe `mcp__mesa__quiz`/
   `mcp__mesa__perguntar`; o OpenCode chama o MCP `mesa` e também vê
   `mesa_quiz`/`mesa_perguntar` no fluxo. Sessões antigas guardaram `quiz` e
   `AskUserQuestion` — eles continuam reconhecidos para o histórico não virar
   passo solto. */

const NAMES = Object.freeze({
  quiz: new Set(['quiz', 'mesa_quiz', 'mcp__mesa__quiz']),
  ask: new Set(['perguntar', 'mesa_perguntar', 'mcp__mesa__perguntar', 'AskUserQuestion', 'ask_user', 'mcp__mesa__ask_user']),
});

/**
 * Tipo do cartão para um nome de ferramenta, ou `null`.
 * @param {string} name
 * @returns {'quiz'|'ask'|null}
 * @example cardToolKind('mcp__mesa__quiz') // 'quiz'
 */
export function cardToolKind(name) {
  const clean = String(name || '');
  if (NAMES.quiz.has(clean)) return 'quiz';
  if (NAMES.ask.has(clean)) return 'ask';
  return null;
}
