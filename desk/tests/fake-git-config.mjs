/* Git de mentira para `scripts/git-hooks.mjs`: guarda `core.hooksPath` em
   memória e anota cada chamada. `insideRepo:false` imita a instalação por zip. */
export function fakeGitConfig({insideRepo = true, hooksPath = '', failSet = false} = {}) {
  const calls = [];
  const state = {hooksPath};
  const git = (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'rev-parse') return {status: insideRepo ? 0 : 128, stdout: insideRepo ? 'true\n' : ''};
    if (args[1] === '--get') return {status: state.hooksPath ? 0 : 1, stdout: state.hooksPath ? `${state.hooksPath}\n` : ''};
    if (failSet) return {status: 1, stdout: ''};
    state.hooksPath = args[2];
    return {status: 0, stdout: ''};
  };
  return {git, calls, state};
}
