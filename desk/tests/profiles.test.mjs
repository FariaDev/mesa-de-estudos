import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, sep} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const profile = require('../profiles.cjs');

/* Perfil da Mesa: a lista declarada é o contrato. O que estes testes garantem é
   a forma da lista e o recorte por existência — a fidelidade ao que o Pi carrega
   de verdade é medida por `npm run profile` (sonda numa sessão real). */

test('pinnedArgs desliga a descoberta e declara cada extensão que existe', () => {
  const home = mkdtempSync(join(tmpdir(), 'mesa-profile-'));
  try {
    const root = join(home, '.pi', 'agent', 'extensions');
    mkdirSync(join(root, 'ask-user'), {recursive: true});
    writeFileSync(join(root, 'ask-user', 'index.ts'), '');
    mkdirSync(join(root, 'browser'), {recursive: true});
    writeFileSync(join(root, 'browser', 'index.ts'), '');
    const settings = join(home, '.pi', 'agent', 'settings.json');
    writeFileSync(settings, JSON.stringify({packages: ['npm:pi-mcp-adapter']}));

    const args = profile.pinnedArgs({home, overlayDirs: [], settingsPath: settings});
    assert.equal(args[0], '--no-extensions');
    assert.ok(args.includes(join(root, 'ask-user', 'index.ts')), 'a extensão que existe entra');
    assert.ok(args.includes(join(root, 'browser', 'index.ts')), 'a segunda também');
    assert.ok(!args.some((a) => a.includes('subagents')), 'o que não existe fica de fora da linha de comando');
    assert.ok(args.includes('npm:pi-mcp-adapter'), 'o pacote declarado nas settings entra');
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

test('pinnedArgs não pede pacote que as settings não declaram', () => {
  const home = mkdtempSync(join(tmpdir(), 'mesa-profile-'));
  try {
    const settings = join(home, 'settings.json');
    writeFileSync(settings, JSON.stringify({packages: []}));
    const args = profile.pinnedArgs({home, overlayDirs: [], settingsPath: settings});
    assert.ok(!args.includes('npm:pi-mcp-adapter'), 'pacote não declarado não entra (evita npm install na largada)');
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

test('overlay do curso entra só pelos arquivos presentes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-overlay-'));
  try {
    mkdirSync(join(dir, 'extensions'), {recursive: true});
    writeFileSync(join(dir, 'extensions', 'quiz.ts'), '');
    const paths = profile.overlayExtensionPaths([dir]);
    assert.equal(paths.length, 1);
    assert.ok(paths[0].endsWith('quiz.ts'));
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('compare separa capacidade perdida de drift de extensão nova', () => {
  assert.deepEqual(profile.compare(['a', 'b'], ['a', 'b']), {missing: [], extra: []});
  assert.deepEqual(profile.compare(['a', 'b'], ['a']), {missing: ['b'], extra: []});
  assert.deepEqual(profile.compare(['a'], ['a', 'novo']), {missing: [], extra: ['novo']});
});

test('a lista declarada de extensões globais não tem duplicata', () => {
  assert.equal(new Set(profile.GLOBAL_EXTENSIONS).size, profile.GLOBAL_EXTENSIONS.length);
  assert.equal(new Set(profile.OVERLAY_EXTENSIONS).size, profile.OVERLAY_EXTENSIONS.length);
});

test('o esperado ativo e o inativo não se sobrepõem', () => {
  const active = new Set(profile.EXPECTED_ACTIVE);
  const overlap = profile.EXPECTED_INACTIVE.filter((name) => active.has(name));
  assert.deepEqual(overlap, [], 'a mesma ferramenta não pode ser esperada ativa e inativa');
  assert.ok(profile.EXPECTED_ACTIVE.length > 0 && profile.EXPECTED_INACTIVE.length > 0);
});

test('a lista declarada aponta para dentro da raiz de extensões', () => {
  /* O teste NÃO exige que as extensões existam nesta máquina: um checkout
     limpo (ou CI) não tem `~/.pi/agent/extensions` e o teste precisa rodar.
     Quem confere presença é o `npm run profile` e o doctor, que rodam na
     máquina do usuário — lá a ausência é sintoma, aqui seria ruído. */
  const root = profile.extensionsRoot();
  for (const file of profile.globalExtensionPaths()) {
    assert.ok(file.startsWith(root + sep), `${file} deveria estar sob ${root}`);
  }
  assert.equal(profile.globalExtensionPaths().length, profile.GLOBAL_EXTENSIONS.length);
  /* Caminho é montado, não copiado: o nome relativo declarado fecha o caminho. */
  profile.globalExtensionPaths().forEach((file, index) => {
    const relative = profile.GLOBAL_EXTENSIONS[index].split('/').join(sep);
    assert.equal(file, join(root, relative));
  });
});

test('o que não existe fica de fora da linha de comando', () => {
  /* Portável por construção: raiz inexistente ⇒ nada de `--extension`, e a
     linha de comando continua válida (só `--no-extensions`). */
  const home = mkdtempSync(join(tmpdir(), 'mesa-profile-clean-'));
  try {
    const args = profile.pinnedArgs({home, overlayDirs: [], settingsPath: join(home, 'settings.json')});
    assert.equal(args[0], '--no-extensions');
    assert.ok(!args.includes('--extension'), 'checkout limpo não inventa caminho');
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});
