import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {enableRepoHooks, hooksMessage} from '../scripts/git-hooks.mjs';
import {gitEnv, lintTargets} from '../scripts/lint-changed.mjs';
import {fakeGitConfig} from './fake-git-config.mjs';

/* #86: o pre-push existia e nenhum clone o tinha ligado. O setup liga, sem
   passar por cima de escolha da pessoa nem travar push de quem não tem bend. */
function cloneWithHook() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-hooks-test-'));
  fs.mkdirSync(path.join(root, '.githooks'));
  fs.writeFileSync(path.join(root, '.githooks', 'pre-push'), '#!/bin/sh\n');
  return root;
}

test('#86 setup liga o pre-push num clone sem core.hooksPath', () => {
  const fake = fakeGitConfig();
  assert.deepEqual(enableRepoHooks({root: cloneWithHook(), bendInstalled: true, git: fake.git}), {state: 'enabled'});
  assert.equal(fake.state.hooksPath, '.githooks');
  assert.match(hooksMessage({state: 'enabled'}), /pre-push ligado/);
});

test('#86 setup não mexe em core.hooksPath de outra escolha', () => {
  const fake = fakeGitConfig({hooksPath: '/home/x/meus-hooks'});
  const result = enableRepoHooks({root: cloneWithHook(), bendInstalled: true, git: fake.git});
  assert.deepEqual(result, {state: 'custom', detail: '/home/x/meus-hooks'});
  assert.equal(fake.state.hooksPath, '/home/x/meus-hooks');
  assert.match(hooksMessage(result), /"\/home\/x\/meus-hooks".*esperado "\.githooks"/);
});

test('#86 sem bend o setup só avisa, para não reprovar todo push', () => {
  const fake = fakeGitConfig();
  const result = enableRepoHooks({root: cloneWithHook(), bendInstalled: false, git: fake.git});
  assert.equal(result.state, 'no-bend');
  assert.equal(fake.state.hooksPath, '');
  assert.match(hooksMessage(result), /bend não está instalado/);
});

test('#86 instalação por zip ou sem .githooks fica calada', () => {
  const semRepo = fakeGitConfig({insideRepo: false});
  assert.equal(enableRepoHooks({root: cloneWithHook(), bendInstalled: true, git: semRepo.git}).state, 'no-repo');
  const semHook = fakeGitConfig();
  const vazio = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-hooks-test-'));
  assert.equal(enableRepoHooks({root: vazio, bendInstalled: true, git: semHook.git}).state, 'no-repo');
  assert.deepEqual(semHook.calls, [], 'sem .githooks nem chama o git');
  assert.equal(hooksMessage({state: 'no-repo'}), '');
});

test('#86 já ligado não reescreve a config', () => {
  const fake = fakeGitConfig({hooksPath: '.githooks'});
  assert.equal(enableRepoHooks({root: cloneWithHook(), bendInstalled: true, git: fake.git}).state, 'already');
  assert.ok(!fake.calls.some((call) => call === 'config core.hooksPath .githooks'));
});

test('#86 lint do push olha só JS alterado', () => {
  assert.deepEqual(lintTargets('main.cjs\nREADME.md\nsrc/a.mjs\n\nstyle.css\ntests/x.test.mjs'), ['main.cjs', 'src/a.mjs', 'tests/x.test.mjs']);
  assert.deepEqual(lintTargets(''), []);
});

test('#86 lint do push ignora o GIT_DIR que o hook exporta', () => {
  // Regressão: no primeiro push pelo hook, o ESLint recebeu desk/scripts/x.mjs a partir de desk/.
  const env = gitEnv({GIT_DIR: '/r/.git', GIT_WORK_TREE: '/r', GIT_PREFIX: 'desk/', GIT_INDEX_FILE: '/r/.git/index', PATH: '/bin', HOME: '/h'});
  assert.deepEqual(env, {PATH: '/bin', HOME: '/h'});
});

test('#86 o pre-push roda sintaxe, tipos e lint antes do verify:bend', () => {
  const hook = fs.readFileSync(path.join(import.meta.dirname, '..', '..', '.githooks', 'pre-push'), 'utf8');
  const order = ['npm run -s check', 'npm run -s typecheck', 'node scripts/lint-changed.mjs', 'exec node core/verify.mjs'].map((step) => hook.indexOf(step));
  assert.ok(order.every((at) => at >= 0), `passos que faltam no hook: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'verify:bend fica por último');
});
