/* Bilhete da Conversa → Mesa.
 *
 * O caminho real: a Conversa escreve um arquivo, a Mesa REIVINDICA por
 * renomeação atômica, entrega ao Pi e só então arquiva. O teste faz o ida e
 * volta em disco (runtime temporário).
 *
 * A parte de desfecho é dirigida por `claimForDelivery`/`beginDelivery`/
 * `settleDelivery`, que é o mesmo trio que o main usa: os cenários de falha
 * (validação, conexão, fase de envio, envio ambíguo, arquivamento quebrado,
 * reinício) são testados aqui sem Electron e sem Pi. O mesmo vale para a MÃO do
 * bilhete (`claimHand`): ela é quem decide quando procurar um pendente e quando
 * soltar o que está na mão, e é testada com bilhetes que chegam depois da
 * primeira mensagem e depois do primeiro desfecho. O que NÃO é testado aqui:
 * um turno de verdade contra o provedor.
 *
 * `chat/` não existe na árvore pública (snapshot da Mesa): os testes que
 * precisam do lado da Conversa são pulados, e os da Mesa seguem rodando.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const fs = require('node:fs');
const desk = require('../handoff.cjs');
const deskDir = dirname(dirname(fileURLToPath(import.meta.url)));
const chatDir = join(dirname(deskDir), 'chat');
const hasChat = existsSync(join(chatDir, 'handoff.cjs'));
const semChat = hasChat ? false : 'chat/ não está nesta árvore (snapshot público da Mesa)';
const chat = hasChat ? require(join(chatDir, 'handoff.cjs')) : null;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-handoff-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

/* Escreve um bilhete válido direto no disco, sem depender do adaptador da
   Conversa: os testes da Mesa precisam rodar também sem `chat/`. */
function writePending(runtime, {goal = 'revisar limites', question = '', refs = [], createdAt = NOW} = {}) {
  mkdirSync(desk.handoffDir(runtime), {recursive: true});
  writeFileSync(desk.pendentePath(runtime), JSON.stringify({v: 1, from: 'conversa', createdAt, goal, question, refs}, null, 2) + '\n');
}

function names(runtime, dir) {
  try {
    return readdirSync(dir(runtime));
  } catch (error) {
    /* Só ausência de pasta é lista vazia: um erro de verdade tem de estourar,
       senão "nenhum arquivo" passa sem nunca ter lido o diretório. */
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/* Todo o texto guardado no runtime, em qualquer subpasta: serve para provar que
   um bilhete continua existindo em ALGUM lugar (nada é apagado em silêncio) sem
   depender de adivinhar em qual pasta ele foi parar. */
function conteudos(runtime) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(readFileSync(full, 'utf8'));
    }
  };
  try {
    walk(desk.handoffDir(runtime));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return out.join('\n');
}

/* ---------- formato ---------- */

test('o bilhete traz objetivo, referências e pergunta', () => {
  const block = desk.buildBlock({
    goal: 'revisar limites laterais',
    question: 'como isolar o x na terceira?',
    refs: ['Limites.pdf', 'Lista 3 · questão 3'],
  });
  assert.match(block, /^\[Da Conversa\]/);
  assert.match(block, /- objetivo: revisar limites laterais/);
  assert.match(block, /- referências trazidas da Conversa:/);
  assert.match(block, /  · Limites\.pdf/);
  assert.match(block, /- pergunta pendente: como isolar o x na terceira\?/);
  assert.doesNotMatch(block, /mais de um dia/, 'bilhete recente não leva aviso');
});

test('só referências não é pedido e não vira bloco', () => {
  const block = desk.buildBlock({refs: ['Limites.pdf'], goal: '', question: '   '});
  assert.equal(block, '', 'a Conversa escreveria um arquivo que a Mesa ignoraria');
});

test('os campos são aparados pelo núcleo, não pelo chamador', () => {
  const block = desk.buildBlock({goal: '  revisar limites  ', question: '  e agora?  '});
  assert.match(block, /- objetivo: revisar limites\n/);
  assert.match(block, /- pergunta pendente: e agora\?\n?$/);
});

test('referências vazias ou em demasia são cortadas no teto', () => {
  const refs = [];
  for (let i = 0; i < desk.MAX_REFS + 5; i++) refs.push(`arq-${i}.pdf`);
  const block = desk.buildBlock({goal: 'x', refs});
  assert.equal((block.match(/ {2}· /g) || []).length, desk.MAX_REFS, 'o bilhete é curto de propósito');
  const withBlank = desk.buildBlock({goal: 'x', refs: ['  ', 'ok.pdf', null, 42]});
  assert.equal((withBlank.match(/ {2}· /g) || []).length, 1, 'só referência com texto entra');
});

/* ---------- ida e volta entre os dois apps ---------- */

test('ida e volta em disco: a Conversa escreve, a Mesa lê o mesmo bloco', {skip: semChat}, () => {
  withRuntime((runtime) => {
    const out = chat.writeHandoff({goal: 'revisar limites', question: 'como isolar x?', refs: ['Limites.pdf'], runtime, now: NOW});
    assert.equal(out.written, true, out.reason || '');
    assert.ok(!existsSync(`${out.path}.tmp`), 'a escrita atômica não deixa temporário para trás');

    const claimed = desk.claimForDelivery({runtime, now: NOW});
    assert.equal(claimed.problem, '', 'a Mesa deve aceitar o bilhete da Conversa');
    assert.equal(claimed.claim.bilhete.goal, 'revisar limites');
    assert.deepEqual(claimed.claim.bilhete.refs, ['Limites.pdf']);
    assert.equal(claimed.claim.block, desk.buildBlock({goal: 'revisar limites', question: 'como isolar x?', refs: ['Limites.pdf']}));
  });
});

test('os dois apps chegam no mesmo caminho', {skip: semChat}, () => {
  withRuntime((runtime) => {
    assert.equal(chat.handoffPath(runtime), desk.handoffPath(runtime));
    assert.equal(chat.handoffDir(runtime), desk.handoffDir(runtime));
  });
});

test('a Conversa recusa escrever um bilhete sem pedido', {skip: semChat}, () => {
  withRuntime((runtime) => {
    const out = chat.writeHandoff({goal: '  ', question: '', refs: ['Limites.pdf'], runtime, now: NOW});
    assert.equal(out.written, false);
    assert.equal(out.reason, 'sem objetivo e sem pergunta');
    assert.ok(!existsSync(desk.pendentePath(runtime)), 'nada é gravado');
  });
});

test('o payload gravado declara versão e origem', {skip: semChat}, () => {
  withRuntime((runtime) => {
    const out = chat.writeHandoff({goal: 'x', runtime, now: NOW});
    const payload = JSON.parse(readFileSync(out.path, 'utf8'));
    assert.equal(payload.v, desk.VERSION);
    assert.equal(payload.from, 'conversa');
    assert.equal(payload.createdAt, NOW);
  });
});

/* ---------- protocolo: reivindicar antes de ler ---------- */

test('a reivindicação tira o pendente do lugar antes de ler', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const out = desk.claimForDelivery({runtime, now: NOW});
    assert.ok(out.claim, out.problem || '');
    assert.ok(out.claim.path.includes(desk.CLAIM_PREFIX), 'o trabalho segue sobre o arquivo reivindicado');
    assert.ok(!existsSync(desk.pendentePath(runtime)), 'o pendente saiu do lugar sem ser apagado');
    assert.ok(existsSync(out.claim.path), 'e continua no disco');
  });
});

test('bilhete novo escrito depois da reivindicação continua pendente', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'A'});
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    assert.equal(claimed.claim.bilhete.goal, 'A');
    /* O caso que a versão anterior errava: a leitura era de A, o arquivamento
       pegava B, e A sumia sem arquivo e sem entrega. */
    writePending(runtime, {goal: 'B'});
    const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'accepted'});
    assert.equal(settled.action, 'arquivado');
    const archived = JSON.parse(readFileSync(settled.path, 'utf8'));
    assert.equal(archived.goal, 'A', 'arquivou o que foi lido, não o que chegou depois');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'B', 'o bilhete novo fica pendente');
  });
});

/* ---------- a mão do bilhete durante a execução ---------- */

/* A Conversa pode escrever o bilhete DEPOIS da primeira mensagem da Mesa (o
   usuário manda o pedido para cá e só então conversa lá). O que quebrava: a
   Mesa checava o disco UMA vez por execução; o bilhete que chegasse depois
   ficava parado até o próximo reinício. Agora cada mensagem procura um
   pendente, mas um bilhete por vez fica na mão. */

test('a mão pega o bilhete que a Conversa escreveu depois da primeira mensagem', () => {
  withRuntime((runtime) => {
    const hand = desk.claimHand({runtime, now: NOW});
    const vazio = hand.take();
    assert.deepEqual(
      {claim: vazio.claim, fresh: vazio.fresh, problem: vazio.problem},
      {claim: null, fresh: false, problem: ''},
      'sem nada no disco não há bilhete nem motivo',
    );
    writePending(runtime, {goal: 'revisar limites'});
    const depois = hand.take();
    assert.ok(depois.claim, 'a segunda mensagem acha o bilhete que chegou no meio');
    assert.equal(depois.claim.bilhete.goal, 'revisar limites');
    assert.equal(depois.fresh, true, 'é reivindicação nova: a faixa avisa na tela');
    assert.match(depois.claim.block, /revisar limites/);
    assert.ok(!existsSync(desk.pendentePath(runtime)), 'o pendente saiu do lugar');
    assert.equal(names(runtime, desk.handoffDir).length, 1, 'e virou um único reivindicado');
  });
});

test('um segundo bilhete depois do primeiro desfecho é reivindicado', () => {
  withRuntime((runtime) => {
    const hand = desk.claimHand({runtime, now: NOW});
    writePending(runtime, {goal: 'A'});
    assert.equal(hand.take().claim.bilhete.goal, 'A');
    hand.release();
    writePending(runtime, {goal: 'B'});
    const next = hand.take();
    assert.equal(next.fresh, true);
    assert.equal(next.claim.bilhete.goal, 'B', 'a conversa seguinte não fica presa na anterior');
  });
});

test('bilhete que chega com outro na mão espera a vez, sem se perder', () => {
  withRuntime((runtime) => {
    const hand = desk.claimHand({runtime, now: NOW});
    writePending(runtime, {goal: 'A'});
    const first = hand.take();
    writePending(runtime, {goal: 'B'});
    const again = hand.take();
    assert.equal(again.claim.path, first.claim.path, 'a mão devolve o MESMO bilhete');
    assert.equal(again.fresh, false, 'sem reivindicação nova, a faixa não avisa de novo');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'B', 'B continua pendente no disco');
    hand.release();
    assert.equal(hand.take().claim.bilhete.goal, 'B', 'e é a vez de B quando A termina');
  });
});

test('recusa comprovada mantém a mão e o caminho guardado acompanha a fase', () => {
  withRuntime((runtime) => {
    const hand = desk.claimHand({runtime, now: NOW});
    writePending(runtime, {goal: 'A'});
    const held = hand.take();
    /* Mesmo ciclo do envio (desk/send.cjs): marca o envio, o Pi recusa de
       verdade, o bilhete volta para a fase reivindicada. */
    const started = desk.beginDelivery(held.claim.path, {runtime, now: NOW});
    assert.equal(started.started, true);
    /* `deliverPrompt` mantém o caminho do bilhete em dia; aqui a transição é
       feita na mão para pinar o invariante: depois da recusa, a mão guarda um
       arquivo que EXISTE, na fase reivindicada. A versão anterior guardava o
       caminho de antes da marca de envio: a retentativa morria em "não deu para
       marcar o envio" e o bilhete nunca mais saía da mão. */
    const refused = desk.settleDelivery({...held.claim, path: started.path}, {runtime, now: NOW, outcome: 'refused'});
    assert.equal(refused.action, 'mantido-reivindicado');
    held.claim.path = refused.path;
    /* Recusa NÃO chama release() (main.cjs): a próxima tentativa leva o mesmo
       bilhete, e o caminho que a mão guardou tem de continuar existindo. */
    const retry = hand.take();
    assert.equal(retry.fresh, false);
    assert.equal(retry.claim.bilhete.goal, 'A');
    assert.equal(retry.claim.path, refused.path);
    assert.ok(retry.claim.path.includes(desk.CLAIM_PREFIX), 'de volta à fase reivindicada');
    assert.ok(existsSync(retry.claim.path), 'e o arquivo está lá');
    const again = desk.beginDelivery(retry.claim.path, {runtime, now: NOW + 1000});
    assert.equal(again.started, true, 'a retentativa consegue marcar o envio do arquivo guardado');
    const accepted = desk.settleDelivery({...retry.claim, path: again.path}, {runtime, now: NOW + 1000, outcome: 'accepted'});
    assert.equal(accepted.action, 'arquivado');
    assert.equal(hand.release(), true, 'o aceite solta a mão');
    assert.equal(hand.release(), false, 'soltar duas vezes não inventa bilhete');
    assert.equal(hand.take().claim, null, 'e sem pendente novo a mão fica vazia');
  });
});

/* ---------- desfechos ---------- */

test('falha de arquivamento preserva o bilhete em vez de apagá-lo', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    /* Reprodução do defeito: um ARQUIVO comum onde deveria existir o diretório
       de arquivo. A versão anterior fazia unlink e dava o bilhete por
       consumido — ele desaparecia sem entrega e sem arquivo. */
    mkdirSync(desk.handoffDir(runtime), {recursive: true});
    writeFileSync(desk.archiveDir(runtime), 'bloqueio');
    const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'accepted'});
    assert.equal(settled.action, 'entregue-preservado');
    assert.ok(settled.reason, 'o motivo precisa ser diagnosticável');
    assert.ok(existsSync(settled.path), 'o bilhete entregue continua no disco, com a marca de entrega');
    assert.ok(settled.path.includes(desk.DELIVERED_PREFIX), 'e a marca diz que já foi entregue');
    assert.match(readFileSync(settled.path, 'utf8'), /revisar limites/, 'o conteúdo continua lá');
  });
});

/* A falha acima é de verdade (o `rename` para dentro do arquivo-comum falha),
   mas ela é uma só. Esta segunda usa outra falha de filesystem — diretório de
   arquivo sem permissão de escrita — e prova as duas metades que importam:
   nada é apagado, e o bilhete volta a arquivar quando o bloqueio sai. */
test('arquivo sem permissão de escrita não vira sucesso falso, e o bilhete volta a arquivar quando o bloqueio sai', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    mkdirSync(desk.archiveDir(runtime), {recursive: true});
    chmodSync(desk.archiveDir(runtime), 0o500);
    try {
      const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'accepted'});
      assert.equal(settled.action, 'entregue-preservado', 'entregue não pode virar "arquivado"');
      assert.match(settled.reason, /EACCES|EPERM/, 'o motivo diz que foi o sistema de arquivos');
      const conteudo = readFileSync(settled.path, 'utf8');
      assert.match(conteudo, /revisar limites/, 'o bilhete entregue fica preservado, ÍNTEGRO');
      assert.equal(names(runtime, desk.archiveDir).length, 0, 'nada entrou no arquivo');
      assert.equal(names(runtime, desk.doubtDir).length, 0, 'e nada foi dado como ambíguo');
    } finally {
      chmodSync(desk.archiveDir(runtime), 0o700);
    }
    /* O bloqueio saiu: a recuperação da próxima abertura termina o serviço, com
       o mesmo conteúdo — e movendo, não copiando. */
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.archived, 1, 'arquiva o que já estava marcado como entregue');
    const recuperado = names(runtime, desk.archiveDir);
    assert.deepEqual(recuperado.length, 1);
    assert.match(readFileSync(join(desk.archiveDir(runtime), recuperado[0]), 'utf8'), /revisar limites/);
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.DELIVERED_PREFIX)).length, 0, 'a origem saiu do lugar por renomeação');
    assert.equal(desk.recoverClaims({runtime}).requeued, 0, 'e nunca volta para a fila: já foi entregue');
  });
});

/* ---------- escrita concorrente ---------- */

test('escrever A, processar A, escrever B e concluir A: A é o entregue e B continua pendente', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'A'});
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    assert.equal(claimed.claim.bilhete.goal, 'A', 'a execução fica com o que reivindicou');
    /* A Conversa escreve de novo ENQUANTO a Mesa processa A. */
    writePending(runtime, {goal: 'B'});
    const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'accepted'});
    assert.equal(settled.action, 'arquivado');
    const [arquivado] = names(runtime, desk.archiveDir);
    assert.match(readFileSync(join(desk.archiveDir(runtime), arquivado), 'utf8'), /"goal": "A"/, 'A é o bilhete entregue');
    const pendente = desk.readHandoff({runtime, now: NOW});
    assert.equal(pendente.bilhete.goal, 'B', 'B continua pendente, não foi arrastado junto');
    assert.equal(desk.claimForDelivery({runtime, now: NOW}).claim.bilhete.goal, 'B', 'e é o próximo da fila');
  });
});

test('reiniciar no meio do processamento não apaga A nem B', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'A'});
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    writePending(runtime, {goal: 'B'});
    /* Fecha o app com A reivindicado (não entregue) e B pendente. */
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.requeued, 0, 'não devolve A por cima do pendente mais novo');
    const tudo = conteudos(runtime);
    assert.match(tudo, /"goal": "A"/, 'A continua no disco, guardado com motivo');
    assert.match(tudo, /"goal": "B"/, 'e B também');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'B', 'B segue sendo o pendente');
    assert.equal(names(runtime, desk.failureDir).length, 1, 'A ficou em falha/, preservado e nomeado');
    assert.equal(names(runtime, desk.doubtDir).length, 0, 'A não é dado como entregue: não foi');
    assert.ok(!existsSync(claimed.claim.path), 'o nome de reivindicado não fica pendurado');
  });
});

/* A restauração do pendente era "checar se não existe, depois renomear": um
   bilhete novo que chegasse entre a checagem e o rename era sobrescrito em
   silêncio. Agora quem decide é a própria criação atômica do destino. Esta
   injeção escreve B exatamente no instante da restauração — é a janela. */
test('bilhete novo que chega na janela da restauração não é sobrescrito', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'A'});
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente', 'a fila está vazia enquanto A é processado');
    const link = fs.linkSync;
    let injected = false;
    fs.linkSync = (from, to) => {
      if (!injected) {
        injected = true;
        writePending(runtime, {goal: 'B'});
      }
      return link(from, to);
    };
    let recovery;
    try {
      recovery = desk.recoverClaims({runtime, now: NOW});
    } finally {
      fs.linkSync = link;
    }
    assert.equal(injected, true, 'a injeção precisa acontecer na restauração, não depois');
    assert.equal(recovery.requeued, 0, 'a recuperação não devolve A por cima de B');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'B', 'B continua sendo o pendente');
    const tudo = conteudos(runtime);
    assert.match(tudo, /"goal": "A"/, 'A não sumiu: foi preservado com motivo');
    assert.match(tudo, /"goal": "B"/, 'e B também está no disco');
    assert.equal(names(runtime, desk.doubtDir).length, 0, 'A não é dado como entregue: nunca saiu daqui');
    assert.equal(names(runtime, desk.failureDir).length, 1, 'A fica em falha/, nomeado como superado');
    assert.ok(!existsSync(claimed.claim.path), 'o nome reivindicado não fica pendurado');
  });
});

/* A restauração usa link + unlink. Queda entre os dois deixa os dois nomes
   apontando para o mesmo conteúdo; a abertura seguinte tem de retomar, não
   tratar A como superado nem duplicar o bilhete. */
test('queda entre o link e o unlink da restauração é retomada, sem duplicar nem perder', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'A'});
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    fs.linkSync(claimed.claim.path, desk.pendentePath(runtime));
    assert.equal(names(runtime, desk.failureDir).length, 0);
    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 1, 'a restauração interrompida é retomada');
    assert.equal(names(runtime, desk.failureDir).length, 0, 'A não é tratado como superado');
    assert.equal(names(runtime, desk.handoffDir).filter((n) => n.startsWith(desk.CLAIM_PREFIX)).length, 0, 'o nome reivindicado não fica pendurado');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'A', 'e a fila tem A');
    assert.equal(desk.claimForDelivery({runtime, now: NOW}).claim.bilhete.goal, 'A', 'uma vez só: não virou dois bilhetes');
  });
});

test('falha de validação de anexo não consome o bilhete', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    /* Validação acontece antes de qualquer escrita no Pi: nada é decidido, e o
       arquivo segue reivindicado. */
    assert.equal(desk.settleDelivery(null, {runtime, now: NOW, outcome: 'refused'}).action, 'nenhuma');
    assert.ok(existsSync(claimed.claim.path));
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.requeued, 1, 'reiniciar devolve o bilhete para a fila');
    assert.ok(existsSync(desk.pendentePath(runtime)));
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'revisar limites');
  });
});

test('falha de conexão ou de envio recusa sem perder o bilhete', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'refused'});
    assert.equal(settled.action, 'mantido-reivindicado');
    assert.ok(existsSync(claimed.claim.path));
    assert.equal(desk.recoverClaims({runtime}).requeued, 1, 'a próxima abertura tenta de novo');
  });
});

test('envio aceito é definitivo: falha depois não desfaz a entrega', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'accepted'});
    assert.equal(settled.action, 'arquivado');
    assert.ok(existsSync(settled.path), 'foi para o arquivo, não para a fila');
    /* A leitura de estado vem DEPOIS; ela falhar não pode devolver o bilhete. */
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.requeued, 0, 'nada volta para a fila depois de entregue');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente');
  });
});

test('desfecho ambíguo vai para dúvida e não volta para a fila', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    const settled = desk.settleDelivery(claimed.claim, {runtime, now: NOW, outcome: 'ambiguous'});
    assert.equal(settled.action, 'guardado-em-duvida');
    assert.ok(existsSync(settled.path));
    assert.ok(settled.path.includes(desk.DUVIDA));
    assert.equal(desk.recoverClaims({runtime}).requeued, 0, 'não repete contexto que talvez já esteja na conversa');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente');
  });
});

/* ---------- recuperação após reinício ---------- */

test('reinício devolve o reivindicado à fila e arquiva o já entregue', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const perdido = desk.claimForDelivery({runtime, now: NOW});
    /* Simula o app fechando no meio: o arquivo ficou reivindicado. */
    assert.ok(existsSync(perdido.claim.path));
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.requeued, 1);
    assert.equal(recovery.archived, 0);
    assert.ok(existsSync(desk.pendentePath(runtime)), 'o bilhete não entregue volta a ficar pendente');
    assert.ok(!existsSync(perdido.claim.path));
  });
});

test('reinício não devolve à fila o que já estava marcado como entregue', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    const marked = desk.markDelivered(claimed.claim.path, {runtime, now: NOW});
    assert.equal(marked.delivered, true);
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.archived, 1, 'tenta arquivar de novo');
    assert.equal(recovery.requeued, 0);
    assert.ok(existsSync(recovery.details.find((d) => d.action === 'arquivado') ? desk.archiveDir(runtime) : runtime));
  });
});

test('um pendente mais novo supera o reivindicado antigo sem apagá-lo', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'antigo'});
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    writePending(runtime, {goal: 'novo'});
    const recovery = desk.recoverClaims({runtime});
    assert.equal(recovery.requeued, 0, 'não sobrescreve o pendente mais novo');
    assert.ok(existsSync(claimed.claim.path) === false, 'o antigo saiu do lugar');
    assert.ok(names(runtime, desk.failureDir).length === 1, 'mas foi guardado em falha/, não apagado');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'novo');
  });
});

/* O destino do arquivo superado era nomeado só pelo relógio: dois no mesmo
   milissegundo recebiam o mesmo nome e o `rename` levava o primeiro — perda de
   bilhete, justo num caminho de recuperação. A regressão fixa o relógio e ocupa
   de antemão o nome que a recuperação usaria. */
test('dois superados no mesmo instante, e um destino já ocupado, não se sobrescrevem', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'A'});
    desk.claimForDelivery({runtime, now: NOW});
    writePending(runtime, {goal: 'B'});
    desk.claimForDelivery({runtime, now: NOW});
    writePending(runtime, {goal: 'C'});
    /* Arquivo de outra execução com o nome exato que a recuperação tentaria. */
    mkdirSync(desk.failureDir(runtime), {recursive: true});
    const ocupado = join(desk.failureDir(runtime), `${NOW}-superado.json`);
    writeFileSync(ocupado, 'destino preexistente');

    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 0, 'C é mais novo: nenhum dos antigos volta para a fila');
    assert.deepEqual(recovery.details.map((d) => d.action), ['guardado-em-falha', 'guardado-em-falha']);

    const guardados = names(runtime, desk.failureDir).filter((n) => n !== `${NOW}-superado.json`);
    assert.equal(guardados.length, 2, 'os dois superados continuam no disco, com nomes exclusivos');
    const textos = guardados.map((n) => readFileSync(join(desk.failureDir(runtime), n), 'utf8')).join('\n');
    assert.match(textos, /"goal": "A"/, 'A foi preservado');
    assert.match(textos, /"goal": "B"/, 'e B também');
    assert.equal(readFileSync(ocupado, 'utf8'), 'destino preexistente', 'o destino que já estava lá não é sobrescrito');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'C', 'C segue pendente');
    const tudo = conteudos(runtime);
    for (const goal of ['A', 'B', 'C']) {
      assert.match(tudo, new RegExp(`"goal": "${goal}"`), `o bilhete ${goal} continua em algum lugar do runtime`);
    }
  });
});

/* A fase `enviando-*` é a única que não pode voltar à fila em nenhuma
   hipótese: o envio pode ter chegado ao Pi. */
test('envio iniciado sem confirmação vai para dúvida e nunca volta para a fila', () => {
  withRuntime((runtime) => {
    writePending(runtime);
    const claimed = desk.claimForDelivery({runtime, now: NOW});
    const started = desk.beginDelivery(claimed.claim.path, {runtime, now: NOW});
    assert.equal(started.started, true, started.reason || '');
    assert.ok(started.path.includes(desk.SENDING_PREFIX), 'a fase de envio iniciado tem nome próprio');
    assert.ok(!existsSync(claimed.claim.path), 'o reivindicado saiu do lugar');

    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 0, 'envio iniciado não volta para a fila');
    assert.equal(recovery.doubtful, 1);
    assert.equal(names(runtime, desk.doubtDir).length, 1, 'fica em dúvida, com o conteúdo');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente');
    assert.equal(desk.claimForDelivery({runtime, now: NOW}).claim, null, 'e não fica disponível para nova entrega');
    assert.match(conteudos(runtime), /revisar limites/);
  });
});

test('reinício com um envio interrompido e um reivindicado novo devolve só o reivindicado à fila', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: 'antigo'});
    const antigo = desk.claimForDelivery({runtime, now: NOW});
    desk.beginDelivery(antigo.claim.path, {runtime, now: NOW});
    desk.recoverClaims({runtime, now: NOW});
    /* O app reinicia, o envio interrompido vai para dúvida, chega um bilhete
       novo, e a execução cai de novo — agora antes de qualquer envio. */
    writePending(runtime, {goal: 'novo'});
    desk.claimForDelivery({runtime, now: NOW});
    const recovery = desk.recoverClaims({runtime, now: NOW});
    assert.equal(recovery.requeued, 1, 'o reivindicado volta para a fila');
    assert.equal(recovery.doubtful, 0, 'e o envio interrompido não é tocado de novo');
    assert.equal(desk.readHandoff({runtime, now: NOW}).bilhete.goal, 'novo', 'o bilhete novo é o pendente');
    assert.equal(names(runtime, desk.doubtDir).length, 1, 'o antigo continua em dúvida, preservado');
  });
});

test('recuperar sem nada pendente não inventa trabalho', () => {
  withRuntime((runtime) => {
    const recovery = desk.recoverClaims({runtime});
    assert.deepEqual({requeued: recovery.requeued, archived: recovery.archived}, {requeued: 0, archived: 0});
  });
});

/* ---------- arquivos que não viram contexto ---------- */

test('bilhete sem pedido significativo é guardado em falha, com motivo', () => {
  withRuntime((runtime) => {
    writePending(runtime, {goal: '', question: '', refs: ['Limites.pdf']});
    const out = desk.claimForDelivery({runtime, now: NOW});
    assert.equal(out.claim, null);
    assert.match(out.problem, /sem objetivo e sem pergunta/);
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'ausente', 'saiu da fila');
    assert.equal(names(runtime, desk.failureDir).length, 1, 'e ficou preservado, não apagado');
  });
});

test('arquivo torto, versão estranha ou origem desconhecida são guardados com motivo', () => {
  withRuntime((runtime) => {
    const file = desk.pendentePath(runtime);
    mkdirSync(desk.handoffDir(runtime), {recursive: true});

    writeFileSync(file, '{ isso não é json');
    assert.equal(desk.readHandoff({runtime, now: NOW}).reason, 'json inválido');
    assert.equal(desk.claimForDelivery({runtime, now: NOW}).problem, 'bilhete guardado em falha: json inválido');

    writeFileSync(file, JSON.stringify({v: 99, from: 'conversa', goal: 'x'}));
    assert.match(desk.readHandoff({runtime, now: NOW}).reason, /versão 99/);

    writeFileSync(file, JSON.stringify({v: 1, from: 'outro-app', goal: 'x'}));
    assert.match(desk.readHandoff({runtime, now: NOW}).reason, /origem outro-app/);
  });
});

test('o motivo nunca carrega o conteúdo do bilhete', () => {
  withRuntime((runtime) => {
    const segredo = 'ZEBRA-CONFIDENCIAL-42';
    writePending(runtime, {goal: '', question: '', refs: [segredo]});
    const out = desk.claimForDelivery({runtime, now: NOW});
    assert.ok(out.problem);
    assert.doesNotMatch(out.problem, /ZEBRA-CONFIDENCIAL-42/, 'diagnóstico não expõe conteúdo privado');
    const [name] = names(runtime, desk.failureDir);
    assert.doesNotMatch(name, /ZEBRA-CONFIDENCIAL-42/, 'nem o nome do arquivo de falha');
  });
});

/* ---------- aviso de bilhete antigo ---------- */

test('bilhete de outro dia avisa em vez de passar por assunto de agora', () => {
  withRuntime((runtime) => {
    writePending(runtime, {createdAt: NOW - 2 * DAY});
    const read = desk.readHandoff({runtime, now: NOW});
    assert.equal(read.stale, true);
    assert.match(read.block, /mais de um dia/);
    writePending(runtime, {createdAt: NOW - 60 * 1000});
    assert.equal(desk.readHandoff({runtime, now: NOW}).stale, false);
  });
});

/* ---------- apresentação ---------- */

test('o bloco do bilhete não aparece no transcript, mesmo sem contexto da Mesa', async () => {
  const {displayUserText} = await import('../text.mjs');
  /* `studyContext: false` desliga o bloco `[Contexto da Mesa]`: era o caso em
     que o bilhete ficava visível na conversa. */
  const soBilhete = 'quanto vale o limite?\n\n[Da Conversa]\n- objetivo: revisar limites\n- pergunta pendente: como isolar x?';
  assert.equal(displayUserText(soBilhete), 'quanto vale o limite?');
  const comContexto = 'confere minha resposta\n\n[Contexto da Mesa]\n- matéria: Cálculo I\n\n[Da Conversa]\n- objetivo: revisar limites';
  assert.equal(displayUserText(comContexto), 'confere minha resposta');
  const comReferencias = 'e agora?\n\n[Da Conversa]\n- objetivo: x\n- referências trazidas da Conversa:\n  · /tmp/a.pdf';
  assert.equal(displayUserText(comReferencias), 'e agora?');
});

test('o preview da sessão corta o bloco do bilhete', () => {
  const {sessionPreviewFromJsonl} = require('../lib.cjs');
  const line = (text) => JSON.stringify({type: 'message', message: {role: 'user', content: [{type: 'text', text}]}});
  const raw = [line('quanto vale o limite?\n\n[Da Conversa]\n- objetivo: revisar limites\n- pergunta pendente: como isolar x?')].join('\n');
  const preview = sessionPreviewFromJsonl(raw);
  assert.ok(preview, 'o preview precisa sair');
  assert.doesNotMatch(preview, /\[Da Conversa\]/, 'o marcador não aparece na lista de conversas');
  assert.doesNotMatch(preview, /revisar limites/, 'nem o conteúdo que veio com ele');
});

/* ---------- ordem no handler ---------- */

/* A ordem do envio (validar anexo → conectar → escrever → confirmar → ler o
   estado) e o momento em que `lastContextKey` é atualizado saíram do main para
   `desk/send.cjs`. Quem trava isso agora é `tests/send.test.mjs`, com falhas de
   verdade em cada ponto. A versão anterior deste teste comparava a POSIÇÃO das
   linhas no texto do main: passava sem nunca provocar uma falha, e continuaria
   passando se o bilhete fosse perdido no caminho. */
