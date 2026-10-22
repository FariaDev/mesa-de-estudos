/* Gera docs/reviews/issue-30/decisoes.json e os dois Markdown do #30
   (livro-razão e inventário) a partir de rows.json, protege.json, lanes.json,
   unit-times.json, ui-run-1.log e hunts-run-1.log. Repetível. */
import fs from 'node:fs';
const here = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const rd = (f) => JSON.parse(fs.readFileSync(here + f, 'utf8'));
const rows = rd('rows.json');
const protege = rd('protege.json');
const lanes = rd('lanes.json');
const unitTimes = fs.existsSync(here + 'unit-times.json') ? rd('unit-times.json') : {};
const logTimes = (f) => {
  const t = {};
  if (!fs.existsSync(here + f)) return t;
  for (const l of fs.readFileSync(here + f, 'utf8').split('\n')) {
    const m = l.match(/^(ok|FALHA|pulado)\s+(\S+) \((\d+)s\)/);
    if (m) t[m[2]] = {s: +m[3], st: m[1]};
  }
  return t;
};
const ui = logTimes('ui-run-1.log');
const hunts = logTimes('hunts-run-1.log');

/* ---- decisões por teste -------------------------------------------------- */
const viewMods = {
  'tabsview.test.mjs': 'tabsview', 'tutorstate.test.mjs': 'tutorstate', 'tutorheader.test.mjs': 'tutorheader',
  'settingsview.test.mjs': 'settingsview', 'attachview.test.mjs': 'attachview', 'composerbox.test.mjs': 'composerbox',
  'deskflags.test.mjs': 'deskflags', 'statusview.test.mjs': 'statusview', 'slashview.test.mjs': 'slashview',
};
const testBlocks = (file) => {
  const src = fs.readFileSync(`${root}desk/tests/${file}`, 'utf8');
  return src.split(/\n(?=test\()/).slice(1).map((p) => ({name: (p.match(/^test\('((?:[^'\\]|\\.)*)'/) || [])[1] || '?', body: p}));
};
const decisoes = {}; // arquivo -> {D:[{name,guardian}], C:[…], F:[…]}
const add = (f, k, name, why) => ((decisoes[f] ||= {D: [], C: [], F: []})[k].push({name, why}));
for (const [file, mod] of Object.entries(viewMods)) {
  const hay = ['laws/', 'proofs/', ''].map((d) => fs.readFileSync(`${root}core/${d}${mod}.bend`, 'utf8')).join('\n');
  for (const {name, body} of testBlocks(file)) {
    let b = body.slice(body.indexOf('\n'));
    b = b.replace(/,\s*'(?:[^'\\\n]|\\.)*'\s*\)\s*;/g, ');');
    const lits = new Set();
    for (const m of b.matchAll(/'((?:[^'\\\n]|\\.)+)'/g)) { const s = m[1].replace(/\\'/g, "'"); if (s.length >= 3 && !/^node:|^\.\.?\//.test(s)) lits.add(s); }
    const miss = [...lits].filter((s) => !hay.includes(s));
    if (lits.size >= 2 && miss.length === 0) add(file, 'D', name, `core/laws/${mod}.bend + core/proofs/${mod}.bend`);
  }
}
const wholeD = {
  'sidechat-scope.test.mjs': 'core/laws/sidechat.bend (scopeLine, scopeRefresh) + core/proofs/sidechat.bend',
  'agent-core.test.mjs': 'core/laws/agentcaps.bend + core/laws/agentdelivery.bend (+ proofs)',
  'send-offline.test.mjs': 'core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend',
};
for (const [f, g] of Object.entries(wholeD)) for (const t of testBlocks(f)) add(f, 'D', t.name, g);
const orfaos = {
  'live-pi.mjs': 'manual, nunca roda na rodada; chama o Pi/provedor de verdade; guardião do contrato do Pi: rpc.test.mjs + framing-parity.mjs',
  'reference-live.mjs': 'manual, sem asserção; guardião: fixtures de referência em tests/fixtures + pdf*.test.mjs',
  'reference-fixture.mjs': 'script de apoio sem asserção; não é chamado por runner nem teste',
  'design-check.mjs': 'script de 6 linhas sem asserção; coberto por syntax-check.mjs e pelo portão `check`',
  'installed-smoke.mjs': 'abre o app instalado do usuário (proibido nesta rodada); a mesma cadeia sobe em app-smoke.mjs',
  'capture-new-ui.mjs': 'só captura telas (69 s) sem asserção; guardiões: as janelas *-ui.mjs que medem as mesmas telas',
};
for (const [f, g] of Object.entries(orfaos)) add(f, 'D', '(arquivo inteiro, sem asserção)', g);
add('study-history-retention.test.mjs', 'D', 'nenhum módulo do Mesa apaga sessão por idade', 'varredura de fonte; o guardião comportamental é "o Pi continua lendo uma sessão de 40 dias" + "a Conversa agrupa…" no mesmo arquivo');
add('study-history-retention.test.mjs', 'D', 'o repositório não tem política de expiração de 7 dias para conversas', 'idem (varredura de fonte)');
add('claude-controls.test.mjs', 'D', 'módulo é puro: sem imports, timers, processos, rede ou ambiente', 'varredura de fonte; o módulo roda no teste sem nenhum host (a pureza é provada pelo próprio uso)');
add('claude-questions.test.mjs', 'D', 'módulo é puro: sem imports, DOM, timers, rede ou ambiente', 'idem');
add('claude-native-controls.test.mjs', 'D', 'portão concorda com canChangeControls do Bend em todas as combinações', 'core/laws/agentdelivery.bend (canChangeControls, 5 casos) + agent-core já coberto');
add('review-undo.test.mjs', 'C', 'token vence no prazo do host e não desfaz depois', 'deletion-undo.test.mjs: "prazo do host: vence no instante exato…" (o módulo compartilhado `deletion-undo.cjs`)');
add('review-undo.test.mjs', 'C', 'token inventado não permite reinserção arbitrária', 'deletion-undo.test.mjs: "token inventado, vazio ou acima do teto nunca vira reinserção"');
add('pdf-notes-undo.test.mjs', 'C', 'token vence no prazo do host', 'deletion-undo.test.mjs: "prazo do host…"');
add('pdf-notes-undo.test.mjs', 'C', 'token inventado não permite reinserção arbitrária', 'deletion-undo.test.mjs: "token inventado, vazio ou acima do teto…"');
add('updateflow.test.mjs', 'C', 'modo git: pull --ff-only; npm ci só quando o lock mudou', 'gitreal.test.mjs "D1: update real com git — pull ff, versão CONFERIDA, sem npm ci sem lock novo" (git de verdade)');
add('updateflow.test.mjs', 'C', 'modo git: clone com trabalho local é recusado antes de qualquer mutação (A5)', 'gitreal.test.mjs "D1: clone com trabalho local… é recusado SEM destruir nada"');
add('updateflow.test.mjs', 'C', 'modo git: pull falha → rollback, git reset e a versão antiga reabre', 'gitreal.test.mjs "D1: remoto divergiu… rollback volta a versão antiga de verdade"');
add('send.test.mjs', 'F', 'último teste: inspeção do fonte do main', 'passa a exercitar o ciclo de `desk/send.cjs` (comportamento), sem mover o handler');
add('hunt-calc-ggb.mjs', 'C', 'blocos do avaliador da calculadora (exemplos do guia, recíprocas/inversas, GRAUS)', 'core.test.mjs (calculator) + calculator-ui.mjs + calcview.test.mjs');
add('calculator-ui.mjs', 'F', 'seção 6 só captura, sem asserção', 'capturas passam a depender de MESA_REVIEW_SHOTS');

const counts = (r) => {
  const d = decisoes[r.f];
  const n = r.tests || 1;
  const D = d ? d.D.length : 0, C = d ? d.C.length : 0, F = d ? d.F.length : 0;
  return {n, D: Math.min(D, n), C, F, R: Math.max(0, n - Math.min(D, n) - C - F)};
};
fs.writeFileSync(here + 'decisoes.json', JSON.stringify(decisoes, null, 1));

/* ---- livro-razão --------------------------------------------------------- */
const laneOf = (f) => rows.find((r) => r.f === f)?.lane;
const secs = (r) => (r.kind === 'unit' ? unitTimes[r.f]?.s : ui[r.f]?.s ?? hunts[r.f]?.s);
const fmt = (s) => (s === undefined ? '—' : `${s} s`);
let md = `# Livro-razão de testes — ticket #30\n\nBase \`87a39ea\`. Uma linha por arquivo de \`desk/tests/\`; R manter · F manter o contrato e consertar a asserção · C consolidar (o absorvedor está nomeado) · D apagar (a prova que fica está nomeada). Arquivo de janela/hunt conta como **1 unidade** (os blocos aparecem nas notas). Tempos: \`unit\` = \`node --test arquivo\` isolado; janela/hunt = rodada \`npm run ui\` / \`npm run hunts\` com 2 por vez (\`tempos\` sob carga).\n\nMétodo de decisão de D nos testes de visão: o teste só é D quando **todos** os valores esperados (literais fora do nome e da mensagem) aparecem na lei/prova do módulo (\`valores-nas-leis.mjs\`); teste cujo valor só existe no teste fica R.\n`;
const byLane = {};
for (const r of rows) (byLane[r.lane] ||= []).push(r);
const tot = {n: 0, R: 0, F: 0, C: 0, D: 0, L: 0};
for (const [lane, rs] of Object.entries(byLane).sort()) {
  md += `\n## Raia ${lane}\n\n| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |\n|---|---|---:|---:|---|---:|---:|---:|---:|---|\n`;
  for (const r of rs.sort((a, b) => a.f.localeCompare(b.f))) {
    const c = counts(r);
    tot.n += c.n; tot.R += c.R; tot.F += c.F; tot.C += c.C; tot.D += c.D; tot.L += r.L;
    const d = decisoes[r.f];
    const note = d ? [...d.D.map((x) => `D: ${x.name.slice(0, 60)} → ${x.why}`), ...d.C.map((x) => `C: ${x.name.slice(0, 60)} → ${x.why}`), ...d.F.map((x) => `F: ${x.name.slice(0, 60)} → ${x.why}`)].join('<br>').replace(/\|/g, '/') : 'R (nada a tirar sem perder contrato; ver camadas no inventário)';
    md += `| ${r.f} | ${r.kind} | ${r.L} | ${fmt(secs(r))} | ${(protege[r.f] || '').replace(/\|/g, '/').slice(0, 110)} | ${c.R} | ${c.F} | ${c.C} | ${c.D} | ${note} |\n`;
  }
}
md += `\n**Totais:** ${rows.length} arquivos, ${tot.n} unidades, ${tot.L} linhas — R ${tot.R} · F ${tot.F} · C ${tot.C} · D ${tot.D}.\n`;
fs.writeFileSync(`${root}docs/reviews/issue-30-livro-razao.md`, md);
console.log(JSON.stringify(tot));
const dl = Object.entries(decisoes).map(([f, d]) => `${f}: D${d.D.length} C${d.C.length} F${d.F.length}`);
console.log(dl.join('\n'));

/* ---- inventário (comentário do ticket) ----------------------------------- */
const sum = (a) => a.reduce((x, y) => x + y, 0);
const laneStats = Object.entries(byLane).sort().map(([lane, rs]) => {
  const c = rs.map(counts);
  const t = sum(rs.map((r) => secs(r) || 0));
  return `| ${lane} | ${rs.length} | ${sum(rs.map((r) => r.L))} | ${t.toFixed(0)} s | ${sum(c.map((x) => x.n))} | ${sum(c.map((x) => x.R))} | ${sum(c.map((x) => x.F))} | ${sum(c.map((x) => x.C))} | ${sum(c.map((x) => x.D))} |`;
});
const kindLines = (pred) => sum(rows.filter(pred).map((r) => r.L));
const dFiles = Object.entries(decisoes).filter(([, d]) => d.D.length || d.C.length || d.F.length);
let inv = `# Inventário de testes do #30 (base \`87a39ea\`)

Publicado **antes** de qualquer remoção. O livro-razão por arquivo está em \`docs/reviews/issue-30-livro-razao.md\`; os insumos (outlines, medições, scripts) em \`docs/reviews/issue-30/\`.

## Linha de base

| Comando | Resultado | Tempo |
|---|---|---|
| \`MESA_GATE_CACHE=0 npm test\` | 1316 testes + 5 de portão, verde | 54,9 s (\`node --test\` 22,9 s; soma isolada dos 130 arquivos: ${sum(Object.values(unitTimes).map((x) => x.s)).toFixed(0)} s) |
| \`npm run hunts\` (2 por vez) | 22 ok, 1 falha (\`hunt-handoff\`: sem \`chat/node_modules\`) | 352 s |
| janelas, uma por vez (46 arquivos) | 41 ok, 5 falham já na base | 736 s |
| \`npm run test:claude-ui\` | 9 ok | 30,8 s |
| **Total** | | **≈ 1174 s**; meta ≤ ≈ 820 s |

Cobertura nativa do \`npm test\`: linhas 75,73 % · ramos 79,25 % · funções 65,85 %. \`desk/tests/\`: 251 arquivos, 52 923 linhas (${rows.length} arquivos contados em rows.json, ${sum(rows.map((r) => r.L))} linhas com os 2 novos de hoje).

Falhas na base (relatadas, não apagadas): \`activity-concurrency-ui\`, \`improvements-ui\`, \`material-preview-ui\`, \`material-template-dialog-ui\`, \`mesa-interactive-ui\`, \`hunt-handoff\` (no worktree); \`layout-rules-ui\` e \`model-indicator-ui\` falharam em pares; \`subjects-ui\` oscila.

## Raias (áreas do Mapa do AGENTS.md)

| raia | arquivos | linhas | tempo | unidades | R | F | C | D |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${laneStats.join('\n')}

Por tipo: unitários ${kindLines((r) => r.kind === 'unit')} linhas · janelas ${kindLines((r) => r.kind === 'win')} · hunts ${kindLines((r) => r.f.startsWith('hunt-'))} · apoio/outros ${kindLines((r) => r.kind === 'other')}.

## Plano de camadas

| camada redundante | guardião que fica | o que sai |
|---|---|---|
| Testes JS de **visão pura** (árvore sem host) ao lado da lei+prova Bend do mesmo valor: tabsview, tutorstate, tutorheader, settingsview, attachview, composerbox, deskflags, statusview, slashview | \`core/laws/<módulo>.bend\` + \`core/proofs/<módulo>.bend\` (o portão \`test:proof\` roda os dois) | só os testes cujo valor esperado inteiro consta na lei; os que dependem de texto/fato só do teste ficam |
| \`sidechat-scope\`, \`agent-core\`, \`send-offline\` contra \`sidechat\`, \`agentcaps\`/\`agentdelivery\`, \`pending\` | as leis desses módulos | arquivos inteiros |
| Armazéns de desfazer (\`review-undo\`, \`pdf-notes-undo\`) repetem a matriz do módulo compartilhado | \`deletion-undo.test.mjs\` | prazo do host e token inventado em cada armazém |
| Fluxo do atualizador em modo git com exec simulado (\`updateflow\`) ao lado de git real | \`gitreal.test.mjs\` (D1, repositório de verdade) | 3 testes de modo git simulado |
| Órfãos sem asserção ou fora da rodada (\`live-pi\`, \`reference-*\`, \`design-check\`, \`installed-smoke\`, \`capture-new-ui\`) | janelas que medem as mesmas telas; \`app-smoke\` | arquivos inteiros |
| Varreduras de fonte (\`study-history-retention\` ×2, "módulo é puro" ×2) | testes comportamentais do mesmo arquivo | 4 testes |
| Cálculo da calculadora repetido no hunt (\`hunt-calc-ggb\`) | \`core.test.mjs\` (calculator), \`calculator-ui\`, \`calcview.test\` | blocos do avaliador |

Não é camada redundante, e fica: \`tabsview\` paridade com o \`renderTabs\` antigo, aplicadores de DOM (calcview, firstrun, readersheet, auxview, shortcutview, talkview, pdfview, pdfpageview, toast-view, dialogsview, accent-state), \`pdfnav\` (forma gerada), \`*-parity.mjs\`, \`gitreal\`, \`handoff\`, \`send\`.

### Infraestrutura de tempo (já feita, commit 5c801ac)

\`npm run ui\` (\`tests/run-ui.mjs\`, mesmo corredor de \`hunts\`: \`tests/run-suite.mjs\`, 2 por vez, saída 77 = pulado). Primeira rodada completa: **49 arquivos em 383 s** (43 ok, 6 falham, os mesmos da base). Limpeza de runtimes/capturas na saída e fim dos vazamentos (\`git status --ignored\` limpo).

## Candidatos a decidir com mais evidência (não apagados)

- Família \`claude-*\` (adapter 1835 linhas, native-controls 809, environment 560, turn-policy 533, questions 486, controls 468): há camadas mockadas sobre o mesmo contrato; falta provar por teste qual guardião é mais forte antes de cortar.
- Janelas que medem a mesma tela e podem virar uma só (uma subida do Electron): tutor-header-ui + model-indicator-ui; responsive-ui + responsive-chat-calc-ui + layout-rules-ui; reader-bar-ui + reader-empty-ui; settings-sections-ui + settings-resources-ui; trio de sidechat-*.
- ≈ 256 \`waitForTimeout\` fixos nas janelas/hunts (~222 s de espera): trocar por espera de condição.
- Hunts mais caros: hunt-activity-isolation, hunt-chaos, hunt-chat, ui-smoke (100 s).

## Honestidade sobre a meta

Com a barra de retenção, o que se prova redundante hoje é **${tot.D} testes + ${tot.C} consolidações + ${tot.F} correções** (≈ ${3} % das linhas, estimado; o número real sai do commit de cada raia). A meta de −20 % de linhas só se alcança com a fusão de janelas e a redução da família \`claude-*\`, que dependem de decisões acima. O ganho de tempo vem do corredor (\`npm run ui\`: 736 → 383 s) e de tirar capturas/esperas fixas.

## Cobertura antes

75,73 % linhas / 79,25 % ramos / 65,85 % funções (\`node --test --experimental-test-coverage tests/*.test.mjs\`).
`;
fs.writeFileSync(`${root}docs/reviews/issue-30-inventario.md`, inv);
