# Ajustes do seletor, do indicador e do GeoGebra: resultado

Três problemas de interface, cada um reproduzido num teste de janela antes da correção (vermelho no código antigo, verde agora), em 1440×900 e 900×650, nos dois temas.

## 1. Indicador de modelo virava ícone com espaço sobrando

**Causa.** Três coisas juntas em `header.css` e `tutor-header.mjs`:

- `fitIndicator` media se o nome inteiro cabia. O nome do OpenRouter vem como "DeepSeek: DeepSeek V4.1 Flash", e o teto de 132px do `.mi-model` já contava como "não cabe". A escada `'' → compact → model → icon` caía no ícone mesmo com a fileira folgada.
- O indicador era `flex:none`: não encolhia para dar lugar ao nome cortado com reticências.
- Com o tutor respondendo, o Parar ganhava `margin-left:auto` além do indicador. O `composer.css` carrega depois do `header.css` e `#stop:not([hidden])` tem a mesma especificidade, então a regra que zerava a margem perdia. Duas margens automáticas dividiam a sobra, e o indicador ia para o meio da fileira: é o print da versão antiga que você mandou.

**Correção.**

- O indicador mostra o nome curto, sem "Fabricante: ": `shortModelName` em `model-picker.mjs`, usado em `state.mjs`.
- O indicador é `flex:0 1 auto`. O degrau `model` vale enquanto o nome tem pelo menos `--mi-model-floor` (72px) à vista, cortado com reticências. Só abaixo disso vira ícone.
- A medida refaz quando as fontes terminam de carregar (`document.fonts.ready`).
- A regra da margem ganhou o prefixo `#composer-box`, e o Parar fica colado no indicador (0–8px).
- Visual de controle: texto em `--fg` (contraste 14,9 no claro e 11,0 no escuro), borda de 1px, cantos de pílula, hover e alvo de 24px ou mais.
- A regra do núcleo (`composerbox.rowFit`) não mudou: mudou só a medida que o aplicador entrega a ela.

**Teste.** `desk/tests/model-indicator-fit-ui.mjs` faz quatro coisas:

- percorre a escada e confere que todo degrau mais folgado transborda ou espreme o nome;
- mede o contraste e o alvo;
- arrasta o divisor de ponta a ponta;
- repete com o tutor respondendo.

No código antigo ele falhava com `icon` em 1440×900.

## 2. Arrastar o divisor do chat com a aba GeoGebra aberta

**Causa.** A view do applet é nativa (`WebContentsView`) e fica por cima do DOM. Durante o arrasto ela continuava no retângulo velho. Quando o chat crescia, ela cobria o divisor e roubava o ponteiro. Já o divisor dos leitores (`splitter`) só move DOM, por isso nunca teve o problema. Pelo teclado, o divisor também não reposicionava a view.

**Correção.**

- No `pointerdown` do divisor, `ggb-freeze` (`geogebra-host.cjs`, IPC em `preload.cjs`) faz duas coisas: captura a view com `capturePage` e a esconde.
- No DOM, a captura entra no lugar da view (`img.ggb-freeze`, sem eventos de ponteiro). O arrasto passa a mexer só DOM, como no splitter.
- No fim do arrasto, `thawGgbView` espera o congelamento terminar (isso cobre o clique rápido), manda o retângulo novo e tira a captura.
- Um `ResizeObserver` em `#references`, limitado a uma vez por quadro, manda o retângulo quando a área muda por outro motivo, como o teclado.

**Teste.** `desk/tests/ggb-divider-drag-ui.mjs` usa o applet falso (`LEARNING_DESK_GGB_PAGE`). Ele confere que:

- durante o arrasto a view está escondida e a captura está no lugar;
- o divisor segue no comando;
- ao soltar, a view volta ao retângulo novo em 2–4 ms (o limite do teste é 500 ms);
- o teclado também move a view;
- um clique simples não a deixa escondida.

Os testes de unidade do host ficam em `geogebra-host.test.mjs`.

## 3. Seletor de modelo com catálogo grande (~450)

**Causa.** A lista foi feita para dezenas de modelos:

- sem ordem por nome;
- o OpenRouter num bloco só de ~390 linhas, todas começando por "Fabricante: ";
- a segunda linha repetia o provedor que já estava no título;
- provedor sem logo com o mesmo ícone genérico;
- os `:free` do OpenRouter fora do grupo Grátis;
- linhas de ~39px, com só 4 inteiras à vista.

**Correção.** As funções puras ficam em `model-picker.mjs`, com teste. Os nós ficam em `model-picker-rows.mjs` (novo, separado de `model-picker-ui.mjs`).

1. **Monograma.** O provedor sem logo ganha as iniciais (`monogramLetters`) e uma das seis cores `--mesa-chart-*`, escolhida por hash do id (FNV-1a com o misturador do murmur3, em `monogramSlot`). Cada entrada do trilho tem `data-tip` e `aria-label` com o nome do provedor.
2. **Ordem por nome** dentro dos grupos, também no Grátis. Usa `Intl.Collator('pt-BR', {sensitivity:'base', numeric:true})`, então caixa e acento não contam, e "Qwen 9B" vem antes de "Qwen 12B".
3. **Subgrupos por fabricante.** `sectionsOf` só divide um provedor com 20 ou mais modelos e pelo menos dois fabricantes. Os subtítulos ficam em ordem A–Z, com "Outros" no fim. A linha mostra só o nome curto e guarda o nome completo no `aria-label` e na dica. A busca continua achando pelo nome completo e pelo fabricante.
4. **Segunda linha.** No grupo do provedor, `factsOf` mostra contexto ("131 mil", "1 mi"), visão, raciocínio e preço do pago em US$ por milhão. Nos grupos mistos (Recentes, Favoritos, Grátis, busca) continua o provedor.
5. **Grátis do OpenRouter** no núcleo. Vale o sufixo `:free` ou o custo zero comprovado; o roteador automático nunca conta como grátis.
   - Regra: `isRouterFree` e `isFreeModel` em `core/freemodels.bend`.
   - Seis leis novas em `core/laws/freemodels.bend`, com provas em `core/proofs/freemodels.bend`.
   - O artefato `freemodels.core.js` foi regenerado e commitado.
   - O host (`opencode-host.cjs`, `annotateRouter`) marca o modelo com política vazia, que aparece como "Sem informação de privacidade".
6. **Densidade.** Linha de 35px, com o nome em 14px e os fatos em 12px. Agora 10 linhas ficam inteiras à vista em 1440×900 (antes, 4).
7. **Desempenho.** Com `content-visibility:auto` nas linhas de modelo, o navegador pula as que estão fora da vista. A medida de reserva é a do conteúdo (31px mais 4px de padding), igual à linha desenhada; com 35px de reserva, a linha pulada media 39px e o alinhamento do topo ao abrir errava. Não foi preciso renderizar em lotes.

**Testes.**

- Unidade: `model-picker-catalog.test.mjs` e `provider-icons.test.mjs`.
- Janela: `model-picker-catalog-ui.mjs`, com `FAKE_PI_MANY_MODELS=450` e o catálogo determinístico de `tests/fake-pi-catalog.mjs`.
- Ajustados para a ordem nova: `model-picker-ui.mjs`, `model-indicator-ui.mjs` e `free-models-ui.mjs`. No `free-models-ui.mjs`, o pago agora mostra o preço, e a asserção continua garantindo que ele não leva selo nem política de grátis.

**Textos.** Seis chaves novas nos dois catálogos (`modelPicker.section.unnamed` e `modelPicker.meta.*`), com paridade (2395 chaves em cada). O `index.html` não mudou.

## Desempenho (450 modelos, 1440×900)

Medição na janela, com reflow forçado incluído:

| Medida | Antes (`main`, b64e4ea) | Depois |
| --- | --- | --- |
| Abrir o seletor: mediana / pior de 5 | 45,5 / 75,9 ms | 18,9 / 35,4 ms |
| Cada tecla ("deepseek v4"): mediana / pior | 2,0 / 16,3 ms | 1,7 / 11,1 ms |
| Pior quadro ao rolar a lista inteira | — | 15 ms (136 quadros) |
| `groupModels` + `flattenGroups`, por chamada (unidade) | — | < 25 ms (limite do teste) |

O teste de janela cobra 50 ms para abrir, para cada tecla e para cada quadro ao rolar. Os números da última rodada, nos quatro cenários: abrir em 31–39 ms, tecla com média de 2,8 ms e pior de 9 ms, quadro de rolagem com pior de 15 ms.

## Antes e depois

As capturas ficam fora do repositório, no scratchpad da sessão. Usam curso sintético e Pi de mentira, sem material de curso. Foram tiradas por `shots.mjs`, no mesmo lugar, contra `main` (b64e4ea) e contra esta branch.

- Antes: `/private/tmp/claude-501/-Users-would-Developer-learning-canvas--claude-worktrees-busy-fermi-2c97eb/eb131c68-9a46-4d96-9b42-21622a645dcf/scratchpad/shots/antes/`
- Depois: `/private/tmp/claude-501/-Users-would-Developer-learning-canvas--claude-worktrees-busy-fermi-2c97eb/eb131c68-9a46-4d96-9b42-21622a645dcf/scratchpad/shots/depois/`

O que cada par mostra:

- **`indicador-{light,dark}.png`**: antes, só o ícone; depois, "DeepSeek V4.1 Flash · desligado".
- **`indicador-respondendo-light.png`**:
  - antes, o indicador só com o ícone, a 58px do Parar (o caso do print);
  - depois, o nome à vista, a 4px do Parar.
- **`seletor-{light,dark}.png` e `seletor-busca-*.png`**:
  - antes, 4 linhas inteiras à vista e nomes com "Fabricante: ";
  - depois, 10 linhas, monogramas no trilho, Grátis com os `:free` do OpenRouter e subgrupos por fabricante.
- **`ggb-{parado,arrastando,depois}.png`**: a janela composta como o usuário vê, com a view nativa por cima.
  - Antes, durante o arrasto, a view fica no retângulo velho e cobre o chat.
  - Depois, a captura acompanha o divisor e a view volta no lugar.

## Portões rodados

| Portão | Resultado |
| --- | --- |
| `npm run verify:bend` | 68 artefatos reproduzíveis, nenhum byte mudou, todas as provas fecham |
| `npm run lint`, `npm run typecheck` | verdes |
| `MESA_GATE_CACHE=0 npm test` | 1871 testes, 0 falhas (mais 5 da etapa inicial) |
| `npm run test:claude-ui` | até o fim, código de saída 0 |
| `npm run ui -- …` com a lista pedida, os 3 testes novos e todos os de janela que o `rg` acha (45 arquivos, em duas metades) | 44 ok; `activity-ggb-overlay-ui` falha (abaixo) |
| `npm run hunts` dos achados pelo `rg` | 9 ok |
| `native-tool-parity.mjs`, `performance-smoke.mjs`, `npm run test:watchdog` (opt-in achados pelo `rg`) | ok |

O comando pedido foi `npm run ui -- model-indicator,model-picker,composer,splitter,activity-ggb,tutor-geogebra,sidechat-layout,free-models,opencode,ui-smoke`. Os testes de janela rodaram um lote por vez, depois da liberação.

**`activity-ggb-overlay-ui`** falha em `screencapture -l <janela>` com "could not create image from window": o processo não tem permissão de Gravação de Tela no macOS. O mesmo teste falha igual no `main` sem estas mudanças (conferido numa worktree temporária), então é ambiente, não regressão. Ele precisa rodar num terminal com essa permissão.

Os `*.test.mjs` achados pelo `rg` (`FAKE_PI|fakePiSource` e os de indicador, seletor e GeoGebra) rodaram dentro do `npm test`.

## Commits (locais, sem push e sem PR)

1. `9e8301b` fix: indicador com nome curto, encolhe antes de virar ícone, margem do Parar
2. `8ec91b8` test: degrau do indicador; catálogo grande no `fake-pi`
3. `ed722de` feat: `ggb-freeze` no host e no preload
4. `b9046ad` fix: divisor do chat congela e devolve a view do GeoGebra
5. `b987e74` test: arrasto e teclado no divisor com o GeoGebra
6. `e5bdd77` feat(core): grátis do OpenRouter no núcleo, com leis e provas
7. `54fe721` feat: o host marca os grátis do OpenRouter
8. `b7707e6` feat: funções puras do seletor (ordem, subgrupos, fatos)
9. `8e2d214` feat: monograma
10. `e364877` feat: lista, trilho, CSS, textos
11. `dd404ee` test: seletor com 450 modelos na janela
12. `2cb187d` fix: `content-visibility` só nas linhas de modelo (a linha "Padrão do OpenCode" saía sem texto logo ao abrir)
13. `bd43470` test: ordem por nome no Grátis e no indicador; o pago mostra o preço
14. este relatório

Os defaults de `desk/config.cjs` não mudaram. Não rodei `setup`, `update` nem `install-app`, e não li credenciais nem logs do usuário.
