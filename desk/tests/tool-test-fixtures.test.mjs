// Os fixtures de ferramentas só existem no modo de teste (#45).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {toolTestFixtures} = createRequire(import.meta.url)('../tool-test-fixtures.cjs');

test('fora do modo de teste nenhum fixture passa, mesmo com o ambiente preenchido', () => {
  assert.deepEqual(toolTestFixtures(false, {LEARNING_DESK_TOOL_FAKE_BIN: '/x'}), {});
});

test('modo de teste lê versões, pasta falsa e launcher; JSON inválido é ignorado', () => {
  assert.deepEqual(toolTestFixtures(true, {
    LEARNING_DESK_TOOL_LATEST: '{"claude":"9"}',
    LEARNING_DESK_TOOL_FAKE_BIN: '/bin-falso',
    LEARNING_DESK_CLAUDE_LAUNCHER: '',
  }), {latestOverride: {claude: '9'}, searchDirs: ['/bin-falso'], allowRunInTest: true, claudeLauncher: ''});
  assert.deepEqual(toolTestFixtures(true, {LEARNING_DESK_TOOL_LATEST: '{quebrado'}), {});
});
