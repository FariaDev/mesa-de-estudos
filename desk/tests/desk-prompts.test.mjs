/* Instruções de sistema dos dois motores (#40): a ordem do prefixo, o que cada
   sessão recebe e a regra de que o sistema diz QUANDO usar uma ferramenta e a
   descrição dela diz COMO — sem repetir o mesmo texto nos dois lugares, que
   vão juntos em todo turno. R1–R3: base comum escrita uma vez, um trecho por
   motor e o template TUTOR.md sem frase falsa para algum motor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const prompts = require('../src/agents/desk-prompts.cjs');
const pdfGuide = await import('../src/extensions/tutor-pdf/guide.mjs');
const activityGuide = await import('../src/extensions/mesa-activity/guide.mjs');
const figureGuide = await import('../src/extensions/mesa-figure/guide.mjs');
const reviewGuide = await import('../src/extensions/mesa-review/guide.mjs');
const tutorTemplate = fs.readFileSync(new URL('../templates/TUTOR.md', import.meta.url), 'utf8');

const profile = [{name: 'TUTOR.md', text: '# Contrato\nregra do tutor'}, {name: 'LEARNER.md', text: '# Perfil\nregra do aluno'}];

/* Toda combinação de motor e sessão que a Mesa monta. */
const variants = {
  'Pi principal': prompts.piPrompt({materialTools: true}),
  'Pi Livre': prompts.piPrompt({materialTools: true, review: false}),
  'Pi chat lateral': prompts.piPrompt(),
  'Claude principal': prompts.claudePrompt({profile, tools: true}),
  'Claude Livre': prompts.claudePrompt({tools: true, review: false}),
  'Claude chat lateral': prompts.claudePrompt({profile}),
  'OpenCode principal': prompts.openCodePrompt({profile}),
  'OpenCode Livre': prompts.openCodePrompt({profile, review: false}),
  'OpenCode chat lateral': prompts.openCodePrompt({profile, sidechat: true}),
};

/* Ferramentas que cada modo REALMENTE tem: cada oferta no texto precisa citar
   uma delas. O chat lateral só lê e busca nos PDFs; a Livre não tem caderno para revisão. */
const MODE_TOOLS = {
  'Pi principal': ['geogebra', 'ver_figura', 'criar_atividade', 'criar_pdf', 'propor_revisao', 'quiz', 'perguntar', 'calcular', 'listar_materiais', 'salvar_nota'],
  'Pi Livre': ['geogebra', 'ver_figura', 'criar_atividade', 'criar_pdf', 'quiz', 'perguntar', 'calcular', 'listar_materiais', 'salvar_nota'],
  'Pi chat lateral': ['quiz', 'perguntar', 'calcular', 'listar_materiais'],
  'Claude principal': ['geogebra', 'ver_figura', 'criar_atividade', 'criar_pdf', 'propor_revisao', 'quiz', 'perguntar', 'calcular', 'listar_materiais', 'salvar_nota'],
  'Claude Livre': ['geogebra', 'ver_figura', 'criar_atividade', 'criar_pdf', 'quiz', 'perguntar', 'calcular', 'listar_materiais', 'salvar_nota'],
  'Claude chat lateral': ['quiz', 'perguntar', 'calcular', 'listar_materiais'],
  'OpenCode principal': ['geogebra', 'ver_figura', 'criar_atividade', 'criar_pdf', 'propor_revisao', 'quiz', 'perguntar', 'calcular', 'listar_materiais', 'salvar_nota'],
  'OpenCode Livre': ['geogebra', 'ver_figura', 'criar_atividade', 'criar_pdf', 'quiz', 'perguntar', 'calcular', 'listar_materiais', 'salvar_nota'],
  'OpenCode chat lateral': ['quiz', 'perguntar', 'calcular', 'listar_materiais'],
};
const OFFER_TOOLS = [
  [/ferramenta geogebra/, 'geogebra'],
  [/ver_figura/, 'ver_figura'],
  [/um quadro/, 'criar_atividade'],
  [/- um PDF/, 'criar_pdf'],
  [/propor_revisao/, 'propor_revisao'],
  [/- um quiz ou uma pergunta/, 'quiz'],
  [/- calcular/, 'calcular'],
  [/listar_materiais/, 'listar_materiais'],
  [/salvar_nota/, 'salvar_nota'],
];

function sentences(text) {
  return text.split(/(?<=[.;:])\s+/).map((part) => part.trim()).filter((part) => part.length >= 40);
}

test('paridade: a base comum abre o prompt dos dois motores, igual, uma vez só', () => {
  for (const [name, text] of Object.entries(variants)) {
    assert.ok(text.startsWith(prompts.DESK_BASE_PROMPT + '\n\n'), `${name} não começa pela base`);
    assert.equal(text.split(prompts.DESK_BASE_PROMPT).length, 2, `${name} repete a base`);
  }
  assert.equal(prompts.PI_DESK_PROMPT, prompts.DESK_BASE_PROMPT + '\n\n' + prompts.PI_ENGINE_PROMPT);
  assert.equal(prompts.CLAUDE_DESK_PROMPT, prompts.DESK_BASE_PROMPT + '\n\n' + prompts.CLAUDE_ENGINE_PROMPT);
  /* A sessão principal é a mesma nos três motores. */
  const piMain = variants['Pi principal'].slice(prompts.PI_DESK_PROMPT.length);
  const claudeMain = prompts.claudePrompt({tools: true}).slice(prompts.CLAUDE_DESK_PROMPT.length);
  assert.equal(piMain, claudeMain);
});

test('cada motor fala só do que tem', () => {
  const piOnly = [/PI_LEARNING_ASSET_DIR/, /subagente/i, /outros aplicativos/];
  for (const name of ['Claude principal', 'Claude Livre', 'Claude chat lateral']) {
    for (const pattern of piOnly) assert.doesNotMatch(variants[name], pattern, `${name}: ${pattern}`);
  }
  for (const name of ['Pi principal', 'Pi chat lateral']) assert.doesNotMatch(variants[name], /\bRead\b/, name);
  /* R2: na sessão principal do Pi a imagem gerada não compete com o quadro. O SVG em linha deixou de ser
     "imagem gerada" na #60 (é figura do chat, com a cerca `plot`), então só o Mermaid segue de fora. */
  assert.doesNotMatch(variants['Pi principal'], /Mermaid/);
  assert.ok(variants['Pi chat lateral'].endsWith(prompts.PI_SIDECHAT_PROMPT));
});

test('a busca no material vem antes de varrer a aula, com o nome do motor (A2)', () => {
  for (const name of ['Pi principal', 'Pi chat lateral']) assert.match(variants[name], /mesa_buscar_material antes de varrer a aula com mesa_ler_pdf/, name);
  for (const name of ['Claude principal', 'Claude Livre', 'Claude chat lateral']) assert.match(variants[name], /mcp__mesa__buscar_material antes de varrer a aula com mcp__mesa__ler_pdf/, name);
  assert.match(variants['OpenCode principal'], /mesa_buscar_material antes de varrer a aula com mesa_ler_pdf/);
});

test('o GeoGebra abre sozinho: os dois motores o oferecem na sessão principal e nenhum pede a aba aberta (#53)', () => {
  for (const name of ['Pi principal', 'Claude principal']) {
    assert.match(variants[name], /ferramenta geogebra/, name);
    assert.doesNotMatch(variants[name], /aba GeoGebra aberta/, name);
  }
  for (const name of ['Pi chat lateral', 'Claude chat lateral']) assert.doesNotMatch(variants[name], /ferramenta geogebra/, name);
});

test('nenhuma frase se repete dentro de um prompt', () => {
  for (const [name, text] of Object.entries(variants)) {
    const seen = new Set();
    for (const sentence of sentences(text.replace(/^(TUTOR|LEARNER)\.md\n[\s\S]*$/m, ''))) {
      assert.equal(seen.has(sentence), false, `${name} repete: ${sentence}`);
      seen.add(sentence);
    }
  }
});

test('sem ênfase solta: nada de CAPS nem NUNCA/SEMPRE', () => {
  for (const [name, text] of Object.entries({...variants, 'TUTOR.md': tutorTemplate})) {
    assert.doesNotMatch(text, /\b(NUNCA|SEMPRE|NÃO|IMPORTANTE|CRÍTICO|DEVE)\b/, name);
    assert.doesNotMatch(text, /estritamente necess/i, name);
  }
});

test('Claude: o fixo vem antes do variável (base, sessão principal, perfil da matéria, transcrição)', () => {
  const text = prompts.claudePrompt({profile, transcript: 'user: oi', tools: true});
  const at = (needle) => text.indexOf(needle);
  assert.equal(at(prompts.CLAUDE_DESK_PROMPT), 0);
  assert.ok(at(prompts.CITATION_PROMPT) > 0);
  assert.ok(at('TUTOR.md\n# Contrato') > at('Guardar para revisar'));
  assert.ok(at('LEARNER.md\n# Perfil') > at('TUTOR.md'));
  assert.ok(at('Transcrição importada') > at('LEARNER.md'));
  /* Duas matérias diferentes dividem o mesmo começo até o perfil. */
  const other = prompts.claudePrompt({profile: [{name: 'TUTOR.md', text: 'outra'}], tools: true});
  const shared = prompts.CLAUDE_DESK_PROMPT + '\n\n' + prompts.mainSessionPrompt();
  assert.ok(text.startsWith(shared) && other.startsWith(shared));
});

test('A4/B2: cada oferta cita ferramenta que existe no modo; lateral e Livre não prometem o que não há', () => {
  for (const [name, text] of Object.entries(variants)) {
    for (const [pattern, tool] of OFFER_TOOLS) {
      if (pattern.test(text)) assert.ok(MODE_TOOLS[name].includes(tool), `${name} oferece ${tool}, que não existe no modo`);
    }
  }
  const side = variants['OpenCode chat lateral'];
  assert.equal(side.includes(prompts.mainSessionPrompt()), false, 'o lateral não leva as ofertas da principal');
  assert.equal(side.includes(prompts.CITATION_PROMPT), false, 'o lateral não ensina a citação com link');
  assert.ok(side.includes(prompts.OPENCODE_SIDECHAT_PROMPT));
  for (const name of ['Pi Livre', 'Claude Livre', 'OpenCode Livre']) {
    assert.equal(variants[name].includes('propor_revisao'), false, `${name}: sem caderno, sem oferta de revisão`);
  }
  for (const name of ['Pi principal', 'Claude principal', 'OpenCode principal']) {
    assert.match(variants[name], /propor_revisao/, `${name}: a matéria oferece revisão`);
  }
});

test('Claude: Livre sem perfil; chat lateral sem ferramentas nem citação com link', () => {
  const free = variants['Claude Livre'];
  /* Nem o nome: `free-host-ipc.test.mjs` confere o prompt da Livre assim. */
  assert.equal(free.includes('TUTOR'), false);
  assert.equal(free.includes('LEARNER'), false);
  const side = variants['Claude chat lateral'];
  assert.equal(side.includes(prompts.mainSessionPrompt()), false);
  assert.equal(side.includes(prompts.CITATION_PROMPT), false);
  assert.ok(side.includes('regra do tutor'));
});

test('Pi: a sessão principal leva citação e o que oferecer; o chat lateral, não', () => {
  const main = variants['Pi principal'];
  assert.ok(main.startsWith(prompts.PI_DESK_PROMPT));
  assert.ok(main.endsWith(prompts.mainSessionPrompt()));
  assert.equal(variants['Pi chat lateral'].includes(prompts.CITATION_PROMPT), false);
  assert.equal(require('../rpc.cjs').DESK_PROMPT, prompts.PI_DESK_PROMPT);
});

test('figuras: margem, rótulo e cores do tema saem da mesma fonte em todo motor', () => {
  for (const [name, text] of Object.entries(variants)) {
    assert.equal(text.split(figureGuide.FIGURE_RULES).length, 2, `${name}: a regra entra uma vez`);
    assert.match(text, /text-anchor/, name);
    assert.match(text, /var\(--plot-1\)/, name);
  }
  assert.ok(figureGuide.FIGURE_CHOICE.includes(figureGuide.FIGURE_RULES_EN));
  assert.equal(figureGuide.FIGURE_CHOICE.includes(figureGuide.FIGURE_RULES), false, 'as regras da descrição são em inglês; as do sistema seguem em português');
  /* M1: as regras de figura já vão na base em toda sessão com criar_pdf; o
     guia do PDF aponta para ver_figura em vez de repeti-las (~300 tokens). */
  assert.equal(figureGuide.PDF_FIGURE_GUIDE.includes(figureGuide.FIGURE_RULES), false);
  assert.match(figureGuide.PDF_FIGURE_GUIDE, /ver_figura/);
});

test('o que oferecer: quadro, PDF, quiz/pergunta e Guardar para revisar', () => {
  const pi = prompts.offerPrompt();
  const claude = prompts.offerPrompt();
  for (const pattern of [/o GeoGebra/, /cerca `plot`[\s\S]*SVG simples[\s\S]*GeoGebra/, /ver_figura/, /um quadro/, /kind "visualizacao"[\s\S]*kind "atividade"/, /um PDF/, /propor_revisao/, /nunca em toda resposta/, /"Guardar para revisar"/, /- calcular/, /listar_materiais/, /salvar_nota/]) {
    assert.match(pi, pattern);
    assert.match(claude, pattern);
  }
  assert.match(pi, /quiz/);
  assert.match(claude, /quiz/);
  assert.doesNotMatch(prompts.offerPrompt({review: false}), /propor_revisao/);
  /* O "quando usar" é curto: o texto antigo (760 e 900 caracteres; o GeoGebra entrou na #53 com 70) repetia a
     ferramenta com outras palavras, o que a busca de frase não pega. A #60 acrescentou a linha da figura
     (~150 caracteres: plot, SVG ou GeoGebra); o limite subiu de 570 para 720. */
  assert.ok(pi.length <= 900, `o que oferecer com ${pi.length} caracteres: o como vai na descrição da ferramenta`);
});

test('o sistema diz quando usar; a descrição da ferramenta diz como — sem frase repetida', () => {
  const tools = [pdfGuide.TOOL_DESCRIPTION, activityGuide.CREATE_DESCRIPTION, activityGuide.PREVIEW_DESCRIPTION, figureGuide.FIGURE_DESCRIPTION, reviewGuide.REVIEW_DESCRIPTION].join('\n');
  /* Margem, rótulo e cor da figura são a mesma frase na base e na ferramenta:
     a descrição sozinha não segurou o modelo (hex e rótulo em cima do traço). */
  const figureRules = new Set(sentences(figureGuide.FIGURE_RULES));
  for (const text of Object.values(variants)) {
    for (const sentence of sentences(text)) {
      if (figureRules.has(sentence)) continue;
      assert.equal(tools.includes(sentence), false, `repetida na ferramenta: ${sentence}`);
    }
  }
  /* As regras que moravam só no sistema seguem valendo, agora na ferramenta. */
  assert.match(pdfGuide.TOOL_DESCRIPTION, /without a clear request, leave `modelo` out/);
  assert.match(pdfGuide.TOOL_DESCRIPTION, /ready to review in the dialog, never that the PDF has already been saved/);
  assert.match(activityGuide.CREATE_DESCRIPTION, /with units and checked calculations/);
});

test('R1: o TUTOR.md do repositório vale para os dois motores e não repete a base', () => {
  assert.doesNotMatch(tutorTemplate, /JSONL|\bPi\b|programa curto/);
  assert.match(tutorTemplate, /citando o arquivo e a página/);
  assert.match(tutorTemplate, /calculadora da Mesa/);
  for (const sentence of sentences(prompts.DESK_BASE_PROMPT)) assert.equal(tutorTemplate.includes(sentence), false, sentence);
  assert.doesNotMatch(tutorTemplate, /somente leitura/);
});

test('a citação ensinada é a que o leitor transforma em link (core/pdfref.bend)', async () => {
  const {default: refCore} = await import('../src/generated/pdfref.core.js');
  const sample = prompts.CITATION_PROMPT.match(/`([^`]+)`/)[1];
  const [, name, page] = sample.match(/^(.+\.pdf), p\. (\d+)$/);
  assert.equal(sample, refCore.refLabel(name, Number(page)));
});

/* Idioma do tutor (#41): o mesmo texto entra pela base comum nos dois motores,
   em toda sessão, e só a frase de idioma muda entre as três opções. */
const TUTOR_LANGUAGES = ['follow', 'pt-BR', 'en'];

function everySession(tutorLanguage) {
  return {
    'Pi principal': prompts.piPrompt({materialTools: true, tutorLanguage}),
    'Pi chat lateral': prompts.piPrompt({tutorLanguage}),
    'Claude principal': prompts.claudePrompt({profile, tools: true, tutorLanguage}),
    'Claude Livre': prompts.claudePrompt({tools: true, review: false, tutorLanguage}),
    'Claude chat lateral': prompts.claudePrompt({profile, tutorLanguage}),
    'OpenCode principal': prompts.openCodePrompt({profile, tutorLanguage}),
    'OpenCode oferta Livre': prompts.openCodePrompt({profile, review: false, tutorLanguage}),
    'OpenCode chat lateral': prompts.openCodePrompt({profile, sidechat: true, tutorLanguage}),
  };
}

test('idioma do tutor: cada opção leva a própria frase, na base, em toda sessão dos dois motores', () => {
  for (const tutorLanguage of TUTOR_LANGUAGES) {
    const line = prompts.TUTOR_LANGUAGE_LINES[tutorLanguage];
    for (const [name, text] of Object.entries(everySession(tutorLanguage))) {
      assert.ok(text.startsWith(prompts.deskBasePrompt(tutorLanguage) + '\n\n'), `${name} (${tutorLanguage}): base`);
      assert.equal(text.split(line).length, 2, `${name} (${tutorLanguage}): a frase entra uma vez`);
      for (const other of TUTOR_LANGUAGES.filter((value) => value !== tutorLanguage)) {
        assert.equal(text.includes(prompts.TUTOR_LANGUAGE_LINES[other]), false, `${name} (${tutorLanguage}) traz a frase de ${other}`);
      }
    }
  }
});

test('idioma do tutor: sem opção o prompt é o de acompanhar as mensagens, e valor estranho também', () => {
  assert.equal(prompts.DESK_BASE_PROMPT, prompts.deskBasePrompt('follow'));
  assert.equal(prompts.piPrompt({materialTools: true}), prompts.piPrompt({materialTools: true, tutorLanguage: 'follow'}));
  assert.equal(prompts.claudePrompt({tools: true, tutorLanguage: 'klingon'}), prompts.claudePrompt({tools: true}));
  assert.match(prompts.tutorLanguageLine('follow'), /última mensagem do aluno/);
  assert.match(prompts.tutorLanguageLine('pt-BR'), /português do Brasil/);
  assert.match(prompts.tutorLanguageLine('en'), /em inglês/);
});

test('idioma do tutor: só a frase muda, o resto do prompt é igual nas três opções', () => {
  const [follow, ptBR, english] = TUTOR_LANGUAGES.map((value) => prompts.piPrompt({materialTools: true, tutorLanguage: value}));
  const strip = (text, value) => text.replace(prompts.TUTOR_LANGUAGE_LINES[value], '');
  assert.equal(strip(follow, 'follow'), strip(ptBR, 'pt-BR'));
  assert.equal(strip(follow, 'follow'), strip(english, 'en'));
});

test('idioma do tutor: no estilo das R1 a R3, curta e sem ênfase solta', () => {
  for (const [value, line] of Object.entries(prompts.TUTOR_LANGUAGE_LINES)) {
    assert.ok(line.length <= 160, `${value}: ${line.length} caracteres`);
    assert.doesNotMatch(line, /\b(NUNCA|SEMPRE|NÃO|IMPORTANTE|CRÍTICO|DEVE)\b/, value);
    assert.match(line, /porque|escolheu/, `${value}: diz o motivo`);
  }
  assert.equal(new Set(Object.values(prompts.TUTOR_LANGUAGE_LINES)).size, 3);
});

/* O Conferir aceita outros programas de escrita além do Xournal++: a base cita o
   escolhido e, sem escolha, fala do caderno digital sem nome fixo. */
test('programa de escrita: sem escolha a base é genérica; com escolha, cita o nome, nos dois motores', () => {
  const generic = prompts.deskBasePrompt();
  assert.match(generic, /resolve à mão no caderno digital, ao lado\./);
  for (const text of [generic, prompts.piPrompt({materialTools: true}), prompts.claudePrompt({tools: true})]) {
    assert.equal(text.includes('Xournal'), false, 'sem escolha nenhum programa é citado');
  }
  for (const text of [prompts.piPrompt({materialTools: true, writingApp: 'GoodNotes'}), prompts.claudePrompt({tools: true, writingApp: 'GoodNotes'})]) {
    assert.match(text, /resolve à mão no GoodNotes, ao lado\./);
    assert.equal(text.includes('caderno digital'), false);
  }
});

test('writingAppName tira caracteres de controle, limita o tamanho e ignora o que não é texto', () => {
  assert.equal(prompts.writingAppName(' Xournal++\n'), 'Xournal++');
  assert.equal(prompts.writingAppName('Um\nNome\u0000 estranho'), 'Um Nome estranho');
  assert.equal(prompts.writingAppName('x'.repeat(200)).length, 60);
  for (const value of [undefined, null, 5, {app: 'x'}, '   ']) assert.equal(prompts.writingAppName(value), '', `valor ${JSON.stringify(value)}`);
});

test('quadro: as chaves do attempt seguem a língua da conversa, sem português fixo', () => {
  const guide = fs.readFileSync(new URL('../src/extensions/mesa-activity/guide.mjs', import.meta.url), 'utf8');
  assert.match(guide, /readable keys in the language of this conversation/);
  assert.equal(guide.includes('legíveis em português'), false);
});

test('descrições de ferramenta em inglês: a linha da base aponta para a regra de idioma nos três motores e nas três opções', () => {
  assert.ok(prompts.TOOL_DESCRIPTIONS_ENGLISH_LINE.length <= 120, prompts.TOOL_DESCRIPTIONS_ENGLISH_LINE);
  for (const tutorLanguage of TUTOR_LANGUAGES) {
    for (const [name, text] of Object.entries(everySession(tutorLanguage))) {
      assert.equal(text.split(prompts.TOOL_DESCRIPTIONS_ENGLISH_LINE).length, 2, `${name} (${tutorLanguage}): a linha entra uma vez`);
    }
  }
});

test('as descrições das ferramentas da Mesa são em inglês mesmo com o tutor em português', () => {
  assert.match(activityGuide.CREATE_DESCRIPTION, /^Show a board in the conversation/);
  assert.match(activityGuide.PREVIEW_DESCRIPTION, /^Preview of the board/);
  assert.match(figureGuide.FIGURE_DESCRIPTION, /^Shows you, as an image/);
  assert.match(reviewGuide.REVIEW_DESCRIPTION, /^Proposes a card in the review notebook/);
  assert.match(pdfGuide.TOOL_DESCRIPTION, /^Prepare the PDF content/);
});

test('OpenCode (#57): base, motor, sessão principal com PDF e o perfil por último', () => {
  const text = variants['OpenCode principal'];
  assert.ok(text.startsWith(prompts.OPENCODE_DESK_PROMPT + '\n\n' + prompts.mainSessionPrompt()));
  assert.match(text, /ferramenta geogebra/);
  assert.match(text, /um quadro/);
  assert.match(text, /- um PDF/);
  assert.match(text, /quiz ou uma pergunta/);
  assert.doesNotMatch(text, /\bRead\b|PI_LEARNING_ASSET_DIR/);
  assert.ok(text.endsWith('LEARNER.md\n# Perfil\nregra do aluno'));
  assert.match(prompts.openCodePrompt({transcript: 'user: oi'}), /Transcrição importada[\s\S]*user: oi$/);
});
