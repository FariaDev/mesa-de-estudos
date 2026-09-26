/* Chave do cache do portão do núcleo (scripts/gate-hash.mjs).

   O que a rodada anterior errava: a chave cobria `core/**` e os artefatos
   gerados, mas NÃO os verificadores de paridade nem os hosts que eles importam.
   Editar `tests/find-parity.mjs` (ou o `rpc.cjs` que o `framing-parity` compara
   contra o núcleo) deixava o hash igual, e o portão pulava justamente a etapa
   que pegaria a divergência.

   A árvore do teste é de mentira, montada em tmp, para poder mexer nos arquivos:
   aqui se prova a REGRA (o que entra e o que não entra na chave), não o valor do
   hash do repositório. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gateFiles, gateHash, parityEntries} from '../scripts/gate-hash.mjs';
import {npmInvocation, runStep} from '../scripts/gate-run.mjs';

const deskDir = dirname(dirname(fileURLToPath(import.meta.url)));

function write(file, text) {
  mkdirSync(join(file, '..'), {recursive: true});
  writeFileSync(file, text);
}

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'mesa-gate-'));
  const desk = join(root, 'desk');
  try {
    write(join(root, 'core', 'dialogsview.bend'), '# núcleo');
    write(join(root, 'core', 'build-safe.mjs'), '// passo do build\n');
    write(join(desk, 'package.json'), JSON.stringify({scripts: {'test:parity': 'node tests/parity.mjs'}}));
    write(join(desk, 'src', 'generated', 'study.core.js'), 'export default {};\n');
    write(join(root, 'chat', 'src', 'generated', 'study.core.js'), 'export default {};\n');
    write(join(desk, 'tests', 'parity.mjs'), '// runner: roda os *-parity.mjs\n');
    /* Verificador que importa o host por literal relativo, e um que o require. */
    write(join(desk, 'tests', 'study-parity.mjs'), "import {x} from '../src/study.mjs';\n");
    write(join(desk, 'tests', 'state-parity.mjs'), "const {deskLayout} = require('../state-adapter.cjs');\n");
    write(join(desk, 'src', 'study.mjs'), "import './lib-extra.mjs';\nexport const x = 1;\n");
    write(join(desk, 'src', 'lib-extra.mjs'), 'export const extra = 1;\n');
    write(join(desk, 'state-adapter.cjs'), 'exports.deskLayout = () => ({});\n');
    /* Fora da chave de propósito: não é núcleo, artefato, verificador nem passo. */
    write(join(desk, 'app', 'notes.mjs'), 'export const nada = 1;\n');
    write(join(root, 'README.md'), '# depois\n');
    return fn({root, desk});
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

const hashOf = (dirs) => gateHash(dirs).hash;

test('a chave cobre núcleo, artefatos, verificadores e o que eles importam', () => {
  fixture(({root, desk}) => {
    const files = gateFiles({root, desk}).map((file) => file.slice(root.length + 1));
    assert.deepEqual(files, [
      'chat/src/generated/study.core.js',
      'core/build-safe.mjs',
      'core/dialogsview.bend',
      'desk/package.json',
      'desk/src/generated/study.core.js',
      'desk/src/lib-extra.mjs',
      'desk/src/study.mjs',
      'desk/state-adapter.cjs',
      'desk/tests/parity.mjs',
      'desk/tests/state-parity.mjs',
      'desk/tests/study-parity.mjs',
    ], 'a lista é o contrato do cache');
    assert.equal(gateHash({root, desk}).count, files.length);
  });
});

test('o mesmo conteúdo dá o mesmo hash', () => {
  fixture(({root, desk}) => {
    assert.equal(hashOf({root, desk}), hashOf({root, desk}));
  });
});

test('mexer num host comparado pela paridade invalida a chave', () => {
  fixture(({root, desk}) => {
    const antes = hashOf({root, desk});
    write(join(desk, 'src', 'study.mjs'), "import './lib-extra.mjs';\nexport const x = 2;\n");
    assert.notEqual(hashOf({root, desk}), antes);
    write(join(desk, 'state-adapter.cjs'), 'exports.deskLayout = () => ({a: 1});\n');
    assert.notEqual(hashOf({root, desk}), antes, 'e o mesmo vale para o módulo do require');
  });
});

test('mexer no que o verificador importa de segunda mão invalida a chave', () => {
  fixture(({root, desk}) => {
    const antes = hashOf({root, desk});
    write(join(desk, 'src', 'lib-extra.mjs'), 'export const extra = 2;\n');
    assert.notEqual(hashOf({root, desk}), antes, 'a varredura de imports é transitiva');
  });
});

test('mexer num verificador de paridade invalida a chave', () => {
  fixture(({root, desk}) => {
    const antes = hashOf({root, desk});
    write(join(desk, 'tests', 'study-parity.mjs'), "import {x} from '../src/study.mjs';\n// caso novo\n");
    assert.notEqual(hashOf({root, desk}), antes, 'o veredito pode mudar sem `core/` mudar');
  });
});

test('verificador novo entra na chave pela varredura do runner', () => {
  fixture(({root, desk}) => {
    const antes = hashOf({root, desk});
    const entries = parityEntries(desk).length;
    write(join(desk, 'tests', 'novo-parity.mjs'), '// mais um\n');
    assert.equal(parityEntries(desk).length, entries + 1);
    assert.notEqual(hashOf({root, desk}), antes);
  });
});

test('mexer nos passos e no núcleo invalida a chave', () => {
  fixture(({root, desk}) => {
    const antes = hashOf({root, desk});
    write(join(desk, 'package.json'), JSON.stringify({scripts: {'test:parity': 'node tests/parity.mjs', extra: 1}}));
    assert.notEqual(hashOf({root, desk}), antes, 'o package.json define os passos');
    write(join(root, 'core', 'dialogsview.bend'), '# núcleo 2');
    assert.notEqual(hashOf({root, desk}), antes);
    write(join(root, 'core', 'build-safe.mjs'), '// passo do build melhorado\n');
    assert.notEqual(hashOf({root, desk}), antes, 'o script do passo também entra');
  });
});

test('o que não entra nos três passos não invalida a chave', () => {
  fixture(({root, desk}) => {
    const antes = hashOf({root, desk});
    write(join(desk, 'app', 'notes.mjs'), 'export const nada = 2;\n');
    write(join(root, 'README.md'), '# depois, com mais texto\n');
    assert.equal(hashOf({root, desk}), antes, 'senão o cache nunca acertaria');
  });
});

/* ---------- como o portão roda cada passo ---------- */

/* O Windows de verdade não roda aqui: o que se testa é a REGRA (plataforma
   injetada) e o que o portão faz com cada resposta do spawn. */

test('macOS e Linux rodam o npm do PATH, sem shell', () => {
  for (const platform of ['darwin', 'linux']) {
    assert.deepEqual(npmInvocation('test:parity', platform), {
      file: 'npm',
      args: ['run', 'test:parity'],
      options: {},
    });
  }
});

test('no Windows (de mentira) o passo chama npm.cmd por shell', () => {
  assert.deepEqual(npmInvocation('test:parity', 'win32'), {
    file: 'npm.cmd',
    args: ['run', 'test:parity'],
    options: {shell: true},
  });
});

test('o passo roda com o terminal herdado e o comando certo', () => {
  const visto = [];
  const out = runStep({
    script: 'test:proof',
    cwd: deskDir,
    platform: 'darwin',
    log: {error() {}},
    spawn(file, args, options) {
      visto.push({file, args, options});
      return {status: 0};
    },
  });
  assert.equal(out.ok, true);
  assert.equal(out.status, 0);
  assert.equal(visto.length, 1);
  assert.equal(visto[0].file, 'npm');
  assert.deepEqual(visto[0].args, ['run', 'test:proof']);
  assert.equal(visto[0].options.cwd, deskDir);
  assert.equal(visto[0].options.stdio, 'inherit');
  assert.equal(visto[0].options.shell, undefined, 'sem shell fora do Windows');
});

test('spawn que não sai fala o comando e o motivo em vez de sair calado', () => {
  const linhas = [];
  const out = runStep({
    script: 'build:bend',
    cwd: deskDir,
    platform: 'win32',
    log: {error: (linha) => linhas.push(String(linha))},
    spawn: () => ({error: {code: 'EINVAL'}, status: null}),
  });
  assert.equal(out.ok, false);
  assert.equal(out.status, 1, 'sem status, a saída é 1 (não "0" por acidente)');
  assert.equal(out.reason, 'spawn');
  assert.match(linhas.join('\n'), /npm\.cmd run build:bend/, 'diz o comando exato');
  assert.match(linhas.join('\n'), /EINVAL/, 'e o motivo que o Node deu');
  assert.match(linhas.join('\n'), /PATH/);
});

test('passo interrompido por sinal também avisa', () => {
  const linhas = [];
  const out = runStep({
    script: 'test:parity',
    cwd: deskDir,
    log: {error: (linha) => linhas.push(String(linha))},
    spawn: () => ({status: null, signal: 'SIGINT'}),
  });
  assert.equal(out.ok, false);
  assert.equal(out.status, 1);
  assert.equal(out.signal, 'SIGINT');
  assert.match(linhas.join('\n'), /interrompido \(SIGINT\)/);
});

test('passo que termina com erro mantém o código de saída dele', () => {
  const out = runStep({
    script: 'test:parity',
    cwd: deskDir,
    log: {error() {}},
    spawn: () => ({status: 3}),
  });
  assert.equal(out.ok, false);
  assert.equal(out.status, 3, 'o código do passo atravessa o portão');
});

test('o portão não chama spawnSync por conta própria', () => {
  const texto = readFileSync(join(deskDir, 'scripts', 'core-gate.mjs'), 'utf8');
  assert.match(texto, /import \{runStep\} from '\.\/gate-run\.mjs'/, 'o main do portão delega');
  assert.doesNotMatch(texto, /spawnSync\(/, 'e não voltou a chamar o spawn direto (sem diagnóstico)');
});
