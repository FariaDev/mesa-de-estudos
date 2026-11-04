/* Liga o `.githooks/pre-push` no clone (#86, auditoria do CI).

   O hook existia desde a #47, mas só valia em quem rodava
   `git config core.hooksPath .githooks` à mão — e nenhum clone tinha rodado.
   O `npm run setup` liga agora, com três recusas:

   - fora de um clone git (instalação por zip), não há o que ligar;
   - `core.hooksPath` já apontando para outro lugar é escolha da pessoa;
   - sem o bend instalado o hook reprovaria todo push, então só avisa. */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Decide e aplica o `core.hooksPath` do clone.
 * @param {{root:string, bendInstalled:boolean, git:(args:string[])=>{status:number, stdout:string}}} options
 *   `git` roda no clone e devolve status e saída (fake nos testes).
 * @returns {{state:'enabled'|'already'|'no-repo'|'custom'|'no-bend', detail?:string}}
 * @example enableRepoHooks({root, bendInstalled:true, git:runGit}) // {state:'enabled'}
 */
export function enableRepoHooks({root, bendInstalled, git}) {
  if (!fs.existsSync(path.join(root, '.githooks', 'pre-push'))) return {state: 'no-repo'};
  if (git(['rev-parse', '--is-inside-work-tree']).status !== 0) return {state: 'no-repo'};
  const current = git(['config', '--get', 'core.hooksPath']).stdout.trim();
  if (current === '.githooks') return {state: 'already'};
  if (current) return {state: 'custom', detail: current};
  if (!bendInstalled) return {state: 'no-bend'};
  if (git(['config', 'core.hooksPath', '.githooks']).status !== 0) return {state: 'no-repo'};
  return {state: 'enabled'};
}

/** Frase do setup para cada estado de `enableRepoHooks`; vazia quando não há o que dizer. */
export function hooksMessage({state, detail}) {
  if (state === 'enabled') return 'Hook de pre-push ligado (.githooks): lint, tipos e provas do núcleo antes de cada push.';
  if (state === 'custom') return `Hook de pre-push não ligado: core.hooksPath já aponta para ${JSON.stringify(detail)}; esperado ".githooks".`;
  if (state === 'no-bend') return 'Hook de pre-push não ligado: o bend não está instalado. Instale-o e rode git config core.hooksPath .githooks.';
  return '';
}
