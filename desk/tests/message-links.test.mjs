/* Links no corpo da resposta do tutor (auditoria de UI/UX, rodada 1, F): só
   `https:` pede o diálogo da Mesa; âncora e qualquer outro esquema não fazem
   nada. A regra de decisão é pura (sem Electron) e o diálogo na janela é
   coberto por `message-links-ui.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageLinkAction} from '../src/message-links.mjs';

test('https abre pelo diálogo da Mesa', () => {
  assert.equal(messageLinkAction('https://exemplo.com/guia'), 'confirm');
  assert.equal(messageLinkAction('https://exemplo.com:8443/a?b=1#c'), 'confirm');
});

test('âncora interna não faz nada', () => {
  assert.equal(messageLinkAction('#topo'), 'none');
  assert.equal(messageLinkAction(''), 'none');
});

test('outro esquema não faz nada', () => {
  for (const href of ['http://exemplo.com/legado', 'javascript:alert(1)', 'file:///etc/passwd', 'mailto:alguem@exemplo.com', 'data:text/plain,oi', '/relativo', 'guia.pdf', 'ftp://exemplo.com/x']) {
    assert.equal(messageLinkAction(href), 'none', href);
  }
});
