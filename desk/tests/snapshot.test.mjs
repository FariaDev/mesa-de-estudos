/* O snapshot público da Mesa é `desk/` sem o app irmão `chat/`.
 *
 * A suíte tem de rodar lá: os testes que dependem da Conversa se pulam e os da
 * Mesa rodam. Isso não se prova com uma asserção sobre o texto do código — o
 * jeito honesto é montar a árvore sem `chat/` e rodar a suíte dentro dela. É o
 * que este teste faz, com o mínimo de arquivos que a suíte do bilhete precisa
 * (os três artefatos do núcleo são autônomos).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const desk = dirname(dirname(fileURLToPath(import.meta.url)));

test('a suíte do bilhete roda no snapshot público, sem chat/', () => {
  const root = mkdtempSync(join(tmpdir(), 'mesa-snapshot-'));
  try {
    const target = join(root, 'desk');
    mkdirSync(join(target, 'tests'), {recursive: true});
    mkdirSync(join(target, 'src', 'generated'), {recursive: true});
    /* `main.cjs` entra porque um dos testes lê a ordem do handler nele (só
       leitura de texto: nada aqui carrega o Electron). `rpc.cjs` e `pi.cjs`
       entram porque um teste do envio usa a PONTE DE VERDADE com o `pi` vazio
       para provar que a recusa não vira dúvida — é a fronteira com o Pi, sem
       processo nenhum. */
    for (const file of ['handoff.cjs', 'send.cjs', 'lib.cjs', 'text.mjs', 'main.cjs', 'rpc.cjs', 'pi.cjs']) {
      cpSync(join(desk, file), join(target, file));
    }
    /* As duas suítes da Mesa que tocam o bilhete: a do protocolo e a do ciclo
       de envio. Nenhuma das duas precisa da Conversa. */
    for (const suite of ['handoff.test.mjs', 'send.test.mjs']) {
      cpSync(join(desk, 'tests', suite), join(target, 'tests', suite));
    }
    for (const core of ['handoff.core.js', 'sessions.core.js', 'attachments.core.js', 'rpcstate.core.js']) {
      const source = join(desk, 'src', 'generated', core);
      assert.ok(existsSync(source), `${core} precisa existir para o snapshot rodar`);
      cpSync(source, join(target, 'src', 'generated', core));
    }
    cpSync(join(desk, 'src', 'generated', 'package.json'), join(target, 'src', 'generated', 'package.json'));

    assert.ok(!existsSync(join(root, 'chat')), 'a árvore do teste não pode ter o app irmão');

    /* O runner de fora passa `NODE_TEST_CONTEXT` para os filhos: com essa
       variável o `node --test` interno vira reporter do pai e não imprime o
       resumo. O ambiente limpo é o que faz a suíte de dentro ser a suíte de
       verdade, com contagem própria. */
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;

    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/handoff.test.mjs', 'tests/send.test.mjs'], {
      cwd: target,
      env,
      encoding: 'utf8',
      timeout: 120000,
    });
    const saida = `${run.stdout || ''}${run.stderr || ''}`;
    const numero = (nome) => Number((new RegExp(`^# ${nome} (\\d+)$`, 'm').exec(saida) || [])[1] ?? -1);
    const passou = numero('pass');
    const falhou = numero('fail');
    const pulados = numero('skipped');

    assert.equal(run.status, 0, `a suíte não pode falhar sem o app irmão:\n${saida.slice(0, 2000)}`);
    assert.equal(falhou, 0, 'nenhuma falha no snapshot público');
    assert.ok(passou > 0, 'os testes da Mesa precisam rodar, não sumir');
    assert.ok(pulados > 0, 'os testes da Conversa precisam se pular, não falhar');
    assert.match(saida, /snapshot público da Mesa/, 'o motivo do pulo precisa aparecer');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
