# Issue #59 — seletor de modelo organizado: resultado

## O que mudou

- O `<select id="model-select">` do `#model-pop` virou uma caixa de busca (`role=combobox`, o foco fica nela) e uma lista (`role=listbox` com linhas `role=option`), em `desk/src/model-picker-ui.mjs`.
- Agrupar, filtrar, ordenar, os recentes e o índice ativo são funções puras em `desk/src/model-picker.mjs` (`// @ts-check`, JSDoc, `desk/tests/model-picker.test.mjs`, listado no `tsconfig.json`).
- Grupos, na ordem: **Recentes** (até 5 por motor), **Grátis** e um grupo por provedor (A–Z). O título vem de um mapa id → nome; id desconhecido aparece cru. Um recente que saiu do catálogo não aparece.
- Busca por nome, id e provedor, sem acento e sem diferença de caixa. Teclado como o menu `@` (#53): ↑↓ com volta, ⏎ escolhe, Esc fecha o popover e devolve o foco ao indicador.
- Visual no estilo do seletor do T3 Code (referência enviada pelo usuário): trilho de provedores à esquerda (Recentes com relógio, Grátis com faíscas, cada provedor com a letra), busca sublinhada com lupa e lista com grupos. Clicar numa entrada do trilho pula para o grupo e leva a linha ativa ao primeiro modelo dele, sem tirar o foco; o trilho some com o Claude e com um grupo só. É só visual (`aria-hidden`): os grupos já têm título para leitor de tela. Pura: `railEntries` em `model-picker.mjs`. O texto da busca ficou "Buscar modelos…" para caber. Não foram feitos favoritos (estrela) nem atalhos ⌘1–3 da referência.
- Os grátis seguem com `data-free`; o Zen pago segue com `data-zen-paid` e a pergunta de cobrança, feita uma vez (`main.mjs`).
- Os recentes ficam no estado de interface (`desk.json`, `modelRecents`, sanitizado em `desk-state-sanitize.cjs`), fora do `config.json`. Os defaults de `desk/config.cjs` não mudaram.
- O Claude usa a mesma lista, sem grupos e sem recentes.
- Textos novos nos dois catálogos (`modelPicker.*`), com paridade. O `index.html` não aumentou de linhas.
- Saiu `desk/src/model-options.mjs` (e o teste), substituído pelo agrupamento.

## Commits (locais, sem push)

1. `708d06a` funções puras do seletor
2. `a730dd0` recentes no `desk.json`
3. `edc79d7` UI, locales, ligação em `state.mjs`/`main.mjs`
4. `3cb6a99` testes de janela, helpers, `fake-pi`, mapa de features
5. este relatório e o ajuste do locator do `model-picker-ui.mjs` (`b21ce7b`)
6. visual no estilo T3 Code: trilho de provedores, busca sublinhada, linha em uso centrada ao abrir

## Antes e depois

Capturas fora do repositório (scratchpad da sessão, não versionadas):

- Antes: `…/scratchpad/antes/seletor-antigo-*/{light,dark}-{1440x900,900x650}-lista.png`. O popover mostrava um `<select>` nativo ("Pi de teste · test") e a lista só existia no menu nativo do sistema: sem grupos, sem recentes, sem busca.
- Depois (já com o visual T3): `…/scratchpad/depois/seletor-modelo-*/{light,dark}-{1440x900,900x650}-{lista,busca,sem-resultado}.png`. Trilho de provedores, busca no topo, títulos de provedor, a linha em uso com o check e à vista dentro da lista, que rola sozinha (o popover não rola).

## Portões rodados

| Portão | Resultado |
| --- | --- |
| `npm run typecheck`, `eslint tests src` | verdes |
| `MESA_GATE_CACHE=0 npm test` | 1770 testes, 0 falhas (inclui sintaxe, typecheck, lint, `build:bend`) |
| `npm run verify:bend` | 68 artefatos reproduzíveis, "All terms check" |
| `npm run ui -- model-indicator,composer,settings,language,claude-controls,opencode,free-models,model-picker,ui-smoke` | 12 janelas, todas ok (depois de um ajuste no teste, abaixo) |
| `npm run test:claude-ui` | todas as janelas ok |
| `rg -l "model-select\|model-pop" tests` | `ui-smoke`, `model-indicator-ui`, `language-ui` e `model-picker-ui` rodaram na janela; `tutorheader.test` e `escape-policy.test` rodaram no `npm test` |

Uma falha na primeira rodada: `model-picker-ui.mjs` reusava o locator da busca depois de relançar o app (`Target page … closed`). Era erro do teste, não do app; o locator passou a ser refeito após o relançamento e o teste passou.

## O que ficou sem prova

- **"Esconder provedores nas Configurações"** (opcional na issue) **não foi feito.**
- `subjects-ui.mjs` é opt-in (usa o Pi real) e não pôde rodar. Foi atualizado para os helpers novos, mas sem execução.
- `tests/fake-pi.mjs` ganhou a env `FAKE_PI_MANY_MODELS=1` (mais provedores no catálogo); o comportamento padrão não mudou.
- Não testei com catálogo real do Pi, do OpenCode ou do Claude; os grupos foram provados com o catálogo do Pi de mentira. O mapa de nomes de provedor cobre os ids que conheço; os demais aparecem crus.
- Na lista com muitas linhas, quando o modelo em uso está no fim, a primeira linha visível pode aparecer cortada pela metade no topo (a rolagem leva a linha em uso para a vista). É cosmético e não foi tratado.
- Não houve teste com leitor de tela; os papéis ARIA e o `aria-activedescendant` foram verificados por asserções no DOM.

## Acabamento visual

O pedido foi deixar o seletor com a cara do T3 Code e pôr favoritos. A lógica de antes não mudou.

### O que mudou

- **Uma superfície só, com 360px de largura.** O título "Modelo" virou `aria-label` da busca e da lista. Saíram as bordas da caixa, do trilho e do campo de esforço. A largura de antes nunca valia: o `.chat-pop` do `tutor-chat.css` vem depois na cascata e ganhava do `.model-pop`, que tem a mesma especificidade, por isso o popover ficava em `max-content` (~240px). A regra agora é `.chat-pop.model-pop`, em `desk/src/model-picker.css`, carregado pelo `desk-areas.css` logo depois do `header.css`. O `header.css` só aponta para lá.
- **Trilho com logos.** No topo vem a estrela (Favoritos), depois o relógio (Recentes), a faísca (Grátis) e o logo de cada provedor, com um traço de acento à esquerda do item ativo. `railEntries` devolve `provider` em vez da letra.
- **Linhas em duas camadas.** Em cima fica o nome, com o selo "Grátis" quando o modelo é grátis. Embaixo ficam o logo e o nome do provedor e, no grátis, a política de dados, que também vai no `title` da linha. À direita ficam o check do modelo em uso e a estrela, que aparece com o ponteiro na linha e fica acesa (`--warn`, preenchida) no favorito. A linha em hover ou ativa ganha fundo arredondado. O `data-zen-paid` e a pergunta de cobrança do Zen pago seguem iguais.
- **Favoritos.** A estrela liga e desliga o favorito sem escolher o modelo. O grupo "Favoritos" fica no topo, acima dos Recentes, na ordem em que os modelos foram marcados. Um favorito que saiu do catálogo não aparece, e na busca o grupo sai, mas a estrela segue acesa na linha. O Claude, que usa a lista plana, não tem favoritos. A parte pura está em `model-picker.mjs` (`toggleFavorite`, `normalizeFavorites`, `FAVORITE_LIMIT` = 50, contra arquivo editado à mão). O estado fica no `desk.json` (`modelFavorites`, por motor, sanitizado em `desk-state-sanitize.cjs`), fora do `config.json`.
- **Faixa de esforço no rodapé.** O `<select id="thinking-select">` saiu e entrou `desk/src/effort-strip.mjs`: um `role=radiogroup` com foco itinerante. ←→ e ↑↓ andam com volta e já escolhem, e Home/End vão às pontas. Os níveis são os que o motor oferece. Os caps e o `#effort-field` não mudaram. A faixa travada usa `aria-disabled`, e quando o host confirma o nível ela só troca as marcas, sem reconstruir os botões, para o foco não se perder no meio das setas. A linha do composer e as faixas `data-fit` não foram tocadas.
- **Abertura e rolagem.** Ao abrir, a linha em uso vai para o meio e a rolagem para no começo de um item (`alignedScrollTop`, pura e com teste), então nenhuma linha fica cortada no topo. A barra de rolagem é fina (`scrollbar-width: thin`) e só ganha cor com o ponteiro na lista.
- O `index.html` perdeu uma linha: saíram o `<label>`/`<select>` do esforço e entrou o crédito do Simple Icons.

### Logos (Simple Icons 16.35.0, CC0)

Os caminhos SVG estão embutidos em `desk/src/provider-icons.mjs`, com `fill: currentColor`, e nada é buscado na rede. O crédito está no Sobre (`about.credit.simpleIcons`, nos dois catálogos). Conferi marca por marca no pacote:

| Provedor (id) | Logo |
| --- | --- |
| `anthropic`, `google`, `google-vertex` (Google Cloud), `opencode`, `openrouter`, `mistral` (Mistral AI), `deepseek`, `huggingface` | Simple Icons |
| `openai`, `openai-codex`, `azure-openai-responses`, `xai`, `groq`, `cerebras`, `amazon-bedrock`, `zai` | genérico (`cpu` em `icons.mjs`): não existem no Simple Icons. O `x` de lá é o X/Twitter, não o xAI. |
| `github-copilot`, `minimax` | genérico: existem, mas com licença própria (MIT do Primer e licença da marca, respectivamente), não CC0 |
| id desconhecido | genérico |

### Capturas (fora do repositório, sem material de curso)

Ficam no scratchpad desta sessão (`/private/tmp/claude-501/…/scratchpad/`) e não são versionadas.

- Antes (worktree temporária em `e4e1037`, já removida): `antes/seletor-modelo-*/{light,dark}-{1440x900,900x650}-{lista,busca,sem-resultado}.png`.
- Depois: `depois/seletor-modelo-*/{light,dark}-{1440x900,900x650}-{lista,busca,sem-resultado}.png`, `depois/model-indicator-*/{claro,escuro}-{1440x900,900x650}-popover.png` (com o desligado) e `depois/modelos-gratis-*/seletor.png` (selo "Grátis" e política no OpenCode).

### Portões rodados

| Portão | Resultado |
| --- | --- |
| `npm run typecheck`, `eslint` dos arquivos mexidos | verdes |
| `MESA_GATE_CACHE=0 npm test` | 1782 testes, 0 falhas |
| `npm run verify:bend` | 68 artefatos reproduzíveis, "All terms check" |
| `npm run test:claude-ui` | todas as janelas ok, até o fim (inclui `claude-ui-smoke`, `claude-controls-ui` e `claude-host-recovery`) |
| `npm run ui -- model-picker,model-indicator,composer,settings,language,claude-controls,opencode,free-models,ui-smoke,about` | 13 janelas ok, 0 falhas |
| `rg -l "model-select\|model-pop\|thinking-select\|effort-field\|model-picker" tests` | `escape-policy.test`, `tutorheader.test` e `model-picker.test` no `npm test`; `ui-smoke`, `language-ui`, `model-indicator-ui` e `model-picker-ui` na bateria `ui`; `claude-controls-ui` e `claude-ui-smoke` no `test:claude-ui` |

Na primeira rodada, o `model-picker-ui` pegou dois problemas. O primeiro era do teste: a dica de tela da Mesa troca o `title` por `data-tip` no hover, e o teste passou a conferir o trilho pelo `data-group`. O segundo era do app: a faixa perdia o foco quando o host confirmava o nível. Foi corrigido no `bb4cf4f`, e o teste prova que o foco anda junto.

### O que ficou sem prova ou de fora

- A estrela só responde ao mouse, porque o foco fica na busca. Não há atalho de teclado para favoritar, e o estado de favorito não é anunciado ao leitor de tela (a estrela é `aria-hidden`).
- No motor OpenCode, o nível `default` da faixa aparece como "Padrão do Claude" (`effort.default`). O texto já era esse no `<select>` antigo e não mudei nesta tarefa.
- `subjects-ui.mjs` (opt-in, usa o Pi real) foi atualizado para `pickEffort`/`effortState`, mas não rodou.
- Os logos foram vistos com o catálogo de mentira (Anthropic, OpenCode Zen e genéricos), não com o catálogo real do Pi.
