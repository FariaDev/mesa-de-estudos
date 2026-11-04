/* Link de atividade só abre depois de confirmar (#81). O diálogo em si (o
   `#link-dialog` na janela) é coberto por `activity-link-ui.mjs`; aqui, a regra
   de decisão e o encurtamento do destino, sem Electron. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmOpenLink, linkParts, openConfirmedLink} from '../src/link-confirm.mjs';
import {fakeDialogElement, fakeDocumentWith, fakeLinkDialog} from './fake-link-dialog.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

/* Roda `run` com o `document` falso no lugar do real, e devolve o original. */
async function withDocument(dialog, run) {
  const previous = globalThis.document;
  globalThis.document = fakeDocumentWith(dialog);
  try {
    return await run();
  } finally {
    globalThis.document = previous;
  }
}

test('cancelar não abre o link', async () => {
  const dialog = fakeLinkDialog(false);
  const opened = await openConfirmedLink('https://exemplo.com/ver', dialog);
  assert.equal(opened, false);
  assert.deepEqual(dialog.asked, ['https://exemplo.com/ver'], 'perguntou o destino certo');
  assert.deepEqual(dialog.opened, [], 'nada chegou ao navegador');
});

test('só abre depois do Abrir, com o mesmo endereço que foi mostrado', async () => {
  const dialog = fakeLinkDialog(true);
  const url = 'https://exemplo.com/ver?caso=1';
  assert.equal(await openConfirmedLink(url, dialog), true);
  assert.deepEqual(dialog.opened, [url]);
});

test('falha no diálogo não abre (na dúvida, não abre)', async () => {
  const dialog = fakeLinkDialog(new Error('diálogo indisponível'));
  await assert.rejects(openConfirmedLink('https://exemplo.com/', dialog), /diálogo indisponível/);
  assert.deepEqual(dialog.opened, []);
});

test('linkParts mostra o domínio de verdade, com porta e sem credencial', () => {
  assert.deepEqual(linkParts('https://exemplo.com/a/b?x=1#topo'), {host: 'exemplo.com', path: '/a/b?x=1#topo'});
  assert.equal(linkParts('https://docs.google.com@evil.example/login').host, 'evil.example');
  assert.equal(linkParts('https://exemplo.com:8443/').host, 'exemplo.com:8443');
  assert.equal(linkParts('https://exemplo.com').path, '/', 'sem caminho, mostra a raiz');
});

test('linkParts encurta o caminho longo no meio e guarda começo e fim', () => {
  const long = `/${'a'.repeat(80)}/arquivo-final.html`;
  const {path} = linkParts(`https://exemplo.com${long}`);
  assert.ok(path.length <= 60, `cabe no diálogo (${path.length} caracteres)`);
  assert.ok(path.startsWith('/aaaa'), 'começo do caminho');
  assert.ok(path.endsWith('arquivo-final.html'), 'fim do caminho');
  assert.ok(path.includes('…'));
});

test('linkParts deixa o caminho curto como está', () => {
  assert.equal(linkParts('https://exemplo.com/ver/resposta').path, '/ver/resposta');
});

test('regressão: Cancelar, reabrir antes do close da fila e Abrir abre o segundo link (#81)', async () => {
  const dialog = fakeDialogElement();
  await withDocument(dialog, async () => {
    const first = confirmOpenLink('https://exemplo.com/a');
    dialog.close('cancel');
    const second = confirmOpenLink('https://exemplo.com/b');
    dialog.runQueuedClose();
    assert.equal(await first, false, 'o primeiro foi cancelado');
    assert.equal(dialog.querySelector('#link-host').textContent, 'exemplo.com', 'o diálogo mostra o segundo destino');
    dialog.close('ok');
    dialog.runQueuedClose();
    assert.equal(await second, true, 'Abrir no segundo link responde a ele');
  });
});

test('Esc (fechar sem botão) não abre', async () => {
  const dialog = fakeDialogElement();
  await withDocument(dialog, async () => {
    const answer = confirmOpenLink('https://exemplo.com/');
    dialog.close('');
    dialog.runQueuedClose();
    assert.equal(await answer, false);
  });
});

test('com o diálogo já aberto, outro pedido recusa e não mostra outro destino', async () => {
  const dialog = fakeDialogElement();
  await withDocument(dialog, async () => {
    const first = confirmOpenLink('https://exemplo.com/a');
    assert.equal(await confirmOpenLink('https://evil.example/b'), false, 'segundo pedido recusado');
    assert.equal(dialog.querySelector('#link-host').textContent, 'exemplo.com', 'o destino mostrado continua o primeiro');
    dialog.close('ok');
    dialog.runQueuedClose();
    assert.equal(await first, true);
  });
});

test('sem o <dialog> no HTML, recusa: na dúvida, não abre', async () => {
  await withDocument(null, async () => {
    assert.equal(await confirmOpenLink('https://exemplo.com/'), false);
  });
});

/* #81: o texto fixo do diálogo entra no teto de 80 caracteres dos dois
   idiomas (o mesmo da `ui-text-length` do #90). */
test('textos do diálogo de link cabem em 80 caracteres nos dois idiomas', () => {
  for (const key of ['link.confirm.title', 'link.confirm.lead', 'link.confirm.open']) {
    for (const [language, catalog] of [['pt-BR', ptBR], ['en', en]]) {
      const length = [...catalog[key]].length;
      assert.ok(length <= 80, `${language} ${key}: ${length} caracteres (${catalog[key]})`);
    }
  }
});
