import test from 'node:test';
import assert from 'node:assert/strict';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {createI18n} from '../src/i18n.mjs';
import {
  STEPS, TOUR, initialSetup, stepId, setupBlocked, nextSetup, backSetup, goToStep, primaryKey, hintKey,
  setupTrail, speechOf, activeRegion, pdfPreview, clearFolder,
} from '../src/setup-flow.mjs';

/* #64: a primeira abertura em tela cheia, um passo por vez. */
const pt = createI18n({catalogs: {'pt-BR': ptBR, en}, language: 'pt-BR'});
const at = (id, extra = {}) => ({...goToStep(initialSetup('setup'), id), ...extra});
const walk = (state, times) => Array.from({length: times}).reduce((s) => nextSetup(s), state);

test('seis passos na ordem do protótipo; "empty" já começa no nome', () => {
  assert.deepEqual([...STEPS], ['welcome', 'tour', 'name', 'folder', 'tutor', 'ready']);
  assert.equal(stepId(initialSetup('setup')), 'welcome');
  assert.equal(stepId(initialSetup('empty')), 'name');
});

test('o passeio vai quadro a quadro e o Voltar refaz o caminho', () => {
  let s = nextSetup(initialSetup('setup'));
  assert.equal(stepId(s), 'tour');
  assert.deepEqual(TOUR.map((frame) => activeRegion(walk(s, TOUR.indexOf(frame)))), ['readers', 'writer', 'tutor', 'top']);
  s = walk(s, TOUR.length);
  assert.equal(stepId(s), 'name');
  s = backSetup(s);
  assert.equal(stepId(s), 'tour');
  assert.equal(s.frame, TOUR.length - 1, 'do nome volta ao último quadro');
  assert.equal(backSetup(at('tour', {frame: 2})).frame, 1);
  assert.equal(stepId(backSetup(at('tour'))), 'welcome');
  assert.equal(stepId(backSetup(initialSetup('setup'))), 'welcome', 'o primeiro não volta');
});

test('nome e pasta travam o avanço; o tutor é opcional', () => {
  assert.equal(setupBlocked(at('name')), true);
  assert.equal(setupBlocked(at('name', {name: '   '})), true, 'só espaço não vale');
  assert.equal(stepId(nextSetup(at('name'))), 'name', 'travado não sai do lugar');
  assert.equal(stepId(nextSetup(at('name', {name: 'Cálculo I'}))), 'folder');
  assert.equal(setupBlocked(at('folder', {name: 'Cálculo I'})), true);
  assert.equal(stepId(nextSetup(at('folder', {name: 'Cálculo I', folder: '/pdfs'}))), 'tutor');
  assert.equal(setupBlocked(at('tutor')), false);
  assert.equal(setupBlocked(at('ready', {name: 'Cálculo I', folder: '/pdfs'})), false);
  assert.equal(setupBlocked(at('ready', {name: 'Cálculo I'})), true, 'sem pasta, não cria');
});

test('o último passo não avança sozinho: a matéria nasce no botão Criar a matéria', () => {
  const ready = at('ready', {name: 'Cálculo I', folder: '/pdfs'});
  assert.equal(nextSetup(ready), ready);
  assert.equal(pt.t(primaryKey(ready)), 'Criar a matéria');
});

test('o botão principal diz o que faz em cada passo', () => {
  const labels = STEPS.map((id) => pt.t(primaryKey(at(id))));
  assert.deepEqual(labels, ['Começar', 'Próximo', 'Continuar', 'Continuar', 'Pular por agora', 'Criar a matéria']);
  assert.equal(pt.t(primaryKey(at('tutor', {online: true}))), 'Continuar', 'com o tutor ligado não é "pular"');
});

test('a dica diz o que falta só quando falta', () => {
  assert.equal(pt.t(hintKey(at('name'))), 'Falta o nome da matéria.');
  assert.equal(hintKey(at('name', {name: 'Física'})), '');
  assert.equal(pt.t(hintKey(at('folder'))), 'Falta a pasta dos PDFs.');
  assert.equal(hintKey(at('tutor')), '');
});

test('a trilha marca o feito com ✓ e o atual', () => {
  const trail = setupTrail(at('folder'));
  assert.deepEqual(trail.map((item) => item.status), ['done', 'done', 'done', 'current', 'todo', 'todo']);
  assert.deepEqual(trail.map((item) => item.mark), ['✓', '✓', '✓', '4', '5', '6']);
  assert.deepEqual(STEPS.map((id) => pt.t(`setup.step.${id}`)), ['Boas-vindas', 'Como funciona', 'Nome', 'PDFs', 'Tutor', 'Pronto']);
});

test('a fala diz o que aconteceu ou o que fazer, sem falar como personagem', () => {
  const say = (state) => {
    const {key, args} = speechOf(state);
    return pt.t(key, args);
  };
  assert.equal(say(initialSetup('setup')), 'Vamos montar a sua Mesa.');
  assert.equal(say(at('tour', {frame: 3})), '', 'o quadro fala pelo desenho, sem balão repetido');
  assert.equal(say(at('name')), 'Como se chama a matéria?');
  assert.equal(say(at('name', {writing: true})), 'Como se chama a matéria?', 'digitar não troca a fala');
  assert.equal(say(at('name', {name: ' Física II '})), 'Matéria: Física II.');
  assert.equal(say(at('folder')), 'Escolha a pasta dos PDFs.');
  assert.equal(say(at('folder', {alert: true})), 'Solte os PDFs aqui.');
  assert.equal(say(at('folder', {folder: '/pdfs', pdfCount: 12})), '12 PDFs encontrados.');
  assert.equal(say(at('folder', {folder: '/pdfs', pdfCount: 0})), 'A pasta ainda não tem PDFs. Dá para pôr depois.');
  assert.equal(say(at('tutor', {online: true})), 'Tutor ligado.');
  assert.equal(say(at('tutor')), '', 'o tutor opcional não repete o cartão');
  assert.equal(say(at('ready')), 'Tudo pronto. Crie a matéria para começar.');
});

/* #67: o teste cobre o catálogo todo. Exceções: o "©" dos créditos do Sobre (é o símbolo
   legal, não emoji) e a fala de apresentação do tutor, que já ficava fora desde a #64. A "★"
   de Favorita é marcador, não emoji: o ICU do Node 22 a conta como pictográfica e o do
   Node 24 não, então ela sai do texto antes da conferência. */
const TONE_EXCEPTIONS = /^(about\.copyright|about\.credit\.|firstrun\.tutor\.lead$)/;

test('nenhum texto do catálogo (#67; antes só setup, Guia, mascotes e celular) tem o tom infantil que a #64 tirou', () => {
  for (const catalog of [ptBR, en]) {
    for (const [key, value] of Object.entries(catalog)) {
      if (TONE_EXCEPTIONS.test(key)) continue;
      assert.doesNotMatch(value.replaceAll('★', ''), /Bora|Zzz|!|\ba gente\b|eu pego|I’ll|\p{Extended_Pictographic}/u, `${key}: ${value}`);
    }
  }
});

test('a linha da pasta mostra até quatro nomes e quantos sobram', () => {
  assert.deepEqual(pdfPreview(['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf', 'e.pdf'], 12), {shown: ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'], more: 8});
  assert.deepEqual(pdfPreview(['a.pdf'], 1), {shown: ['a.pdf'], more: 0});
  assert.deepEqual(pdfPreview(undefined, 0), {shown: [], more: 0});
});

test('o guia e a primeira abertura não dizem mais que a Mesa exige Xournal++ ou mesa digitalizadora', () => {
  for (const catalog of [ptBR, en]) {
    for (const key of ['guide.lead.comecar', 'guide.comecar.s2.title', 'guide.comecar.s2.body']) {
      assert.doesNotMatch(catalog[key], /digitalizadora|tablet|continua no Xournal|stays in Xournal|^Resolva no Xournal|in Xournal\+\+$/i, key);
    }
  }
  assert.equal(ptBR['guide.lead.comecar'], 'A Mesa mostra o material e o tutor. A resolução fica com você: no Xournal++, em outro programa de escrita ou no caderno de papel.');
  assert.equal(ptBR['guide.comecar.s2.title'], 'Resolva do seu jeito');
});

test('"plano pago" sugeria que a Mesa tem plano; o que se dispensa é a assinatura de IA (#67)', () => {
  for (const catalog of [ptBR, en]) {
    for (const [key, value] of Object.entries(catalog)) assert.doesNotMatch(value, /plano pago|paid plan/i, `${key}: ${value}`);
  }
  assert.match(en['freeModels.settings.lead'], /^OpenCode Zen key\./);
  assert.equal(ptBR['guide.tutor.t10.title'], undefined, 'o guia não anuncia modelos grátis (#93)');
  assert.equal(en['guide.tutor.t10.title'], undefined);
  assert.equal(ptBR['freeModels.badge'], undefined, 'a marca Grátis saiu do catálogo (#93)');
  assert.equal(en['freeModels.badge'], undefined);
});

/* #70: a pasta escolhida por engano não tinha como sair do passo PDFs. */
test('#70: tirar a pasta volta ao quadro vazio e trava o Continuar', () => {
  const chosen = {...goToStep(initialSetup('setup'), 'folder'), name: 'Cálculo', folder: '/cursos/calculo', pdfCount: 3};
  assert.equal(setupBlocked(chosen), false);
  const cleared = clearFolder(chosen);
  assert.equal(cleared.folder, '');
  assert.equal(cleared.pdfCount, 0);
  assert.equal(cleared.name, 'Cálculo', 'o nome digitado fica');
  assert.equal(stepId(cleared), 'folder', 'continua no passo PDFs');
  assert.equal(setupBlocked(cleared), true);
});
