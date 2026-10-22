/* Painel Backup em inglês (#41 fase 3): as partes puras do painel seguem o
   idioma da interface, sem sobra de português. O idioma muda pelo mesmo
   caminho do renderer (`setUiLanguage`), com um documento mínimo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setUiLanguage} from '../src/ui-text.mjs';
import {buildBackupPanelView, renderBackupPanelView, formatWhen, reasonLabel} from '../src/backup-panel.mjs';

const fakeDocument = {documentElement: {}, querySelectorAll: () => []};
globalThis.document = fakeDocument;
globalThis.window = Object.assign(new EventTarget(), {desk: undefined});

const PORTUGUESE = /\b(Backup e compartilhar|Restaurar|Compartilhar|Escolher|pasta|versões|matéria|arquivo|ontem|hoje|nenhum)\b/i;

test('painel em inglês: view, seções e rótulos não trazem português', () => {
  setUiLanguage('en');
  try {
    const view = buildBackupPanelView({section: 'compartilhar', course: {name: '', hasCourse: false}});
    assert.equal(view.title, 'Backup and share');
    assert.equal(view.status.lastAt, 'no backup yet');
    const rendered = renderBackupPanelView(view);
    const everything = `${rendered.nav} ${rendered.sections}`.replace(/data-bkp-[a-z-]+="[^"]*"/g, '');
    assert.doesNotMatch(everything, PORTUGUESE);
    assert.match(rendered.sections, /Active course: none/);
    assert.match(rendered.sections, /every <input/);
    assert.equal(reasonLabel('pre-update'), 'before updating');
  } finally {
    setUiLanguage('pt-BR');
  }
});

test('formatWhen: hoje, ontem e dias atrás seguem o idioma', () => {
  const now = new Date('2026-10-17T12:00:00');
  setUiLanguage('en');
  try {
    assert.match(formatWhen('2026-10-17T09:00:00', now), /today/);
    assert.match(formatWhen('2026-10-16T09:00:00', now), /yesterday/);
    assert.match(formatWhen('2026-10-12T09:00:00', now), /5 days ago/);
  } finally {
    setUiLanguage('pt-BR');
  }
  assert.match(formatWhen('2026-10-12T09:00:00', now), /há 5 dias/);
});
