# Stack da Mesa: mudanças, tamanho e ordem

Mapa das mudanças de stack pedidas na #96. Tamanho é **P** (até um dia), **M**
(alguns dias) e **G** (semanas ou mais, ou muitos arquivos). Ganho é o que se
espera do aluno/app, não linhas de código. O que não foi medido está no fim.

A decisão está no [ADR 0004](../adr/0004-typescript-aos-poucos.md). Em uma
linha: **Electron + TypeScript, migração por fronteiras, Bend para invariantes,
sem framework de UI e sem bundle do renderer agora.**

## Feito (não muda)

| Item | Número | Observação |
| --- | ---: | --- |
| Electron 45.2.0 (Chromium + Node) | 275 MB em `node_modules` | Base do app; entrega Chromium e Node no mesmo runtime. |
| App instalado (macOS) | 410,34 MiB | Medição de 2026-10-07, depois do corte de 220 MiB. Não é o tamanho de hoje. |
| Janela utilizável (macOS arm64, Electron 44.7.2) | 995–1033 ms | `issue-67-resultado.md`; ruído de ±50 ms. |
| Heap do renderer | 12,3–13,5 MiB | 30 turnos, depois de GC; sem vazamento. |
| Working set com dois PDFs de 1 página | 549–552 MiB | Medição de 2026-10-07; inclui processos do Electron, não o tutor. |
| pdf.js | 35 MB em `node_modules` | `build` no renderer, `legacy` na extração de texto do main. |
| Bend | 68 artefatos, ~1,96 MB | Continua para invariantes (ADRs 0001/0003). |
| `tsc --noEmit` com JSDoc | 150 arquivos | Já roda no `npm test` e no pre-push. |
| Renderer sem build | 202 módulos, 3,88 MB | `measure-boot.mjs`, execução de 2026-11-04. |

## Proposta: TypeScript (depois do próximo release)

| Ordem | Mudança | Tamanho | Ganho esperado | Portão |
| ---: | --- | :---: | --- | --- |
| 1 | `checkJs` no projeto todo, tipos para `src/generated/*`, baseline de erros | M (ferramenta) + G (dívida) | Contratos visíveis sem renomear nada; 1083 erros atuais viram dívida que só cai | `npm run typecheck` com baseline; ~7 s |
| 2 | Fronteira do contrato dos motores em `.mts` | M | Eventos, entrega, capacidades e opções dos dois adaptadores tipados | `verify:ts` |
| 3 | IPC (`preload.cjs`) em `.cts` | M (500 linhas) | `window.desk` deixa de ser inferido; o renderer ganha um contrato real | `verify:ts` + `types/desk-window.d.ts` |
| 4 | Ferramentas do MCP em `.mts` (`tools`, `protocol`, `pdf-tool`) | M (~612 linhas) | Entrada/saída das ferramentas e o JSON-RPC tipados | `verify:ts` + testes do MCP |
| 5 | `verify:ts` no `pretest`/`core-gate` e pre-push | P | Impede o `.mjs`/`.cjs` gerado de ficar velho | comparar byte a byte com o commitado |
| 6 | Resto quando o ticket já mexer no arquivo; quebrar `main.cjs` (797) e `src/main.mjs` (800) | G | Migração incremental; nenhuma reescrita | o ticket que tocar |
| 7 | `strict` | G | Fecha a dívida de tipos | último; sem medição ainda |

O `tsc` é o compilador: já é devDependency (7.0.2) e é o mesmo que faz o
`checkJs`. A saída fica ao lado da fonte e é commitada; o renderer continua
carregando `renderer.mjs` direto do `index.html`.

## Proposta: plataformas e peso

| Ordem | Mudança | Tamanho | Ganho esperado | Onde |
| ---: | --- | :---: | --- | --- |
| 1 | Motores falsos que rodam no Windows (`node script` ou `.cmd`, não `.mjs` direto) | P | Desbloqueia a maior parte dos 81 testes de janela que falham por `spawn EFTYPE` | `tests/helpers.mjs`, `tests/electron-env.mjs` |
| 2 | Rodar `npm run ui` no runner Windows e triar o que restar | M | Separa defeito real de teste; hoje são 15 ok e 81 falhas | `.github/workflows/test.yml` ou workflow próprio |
| 3 | Corrigir os defeitos reais do #108 | M | Caminho do OpenCode, sessão nova, três botões na mesma linha, âncora da rotação, “prompt aceito” | `opencode-install-ui`, `pdf-rotation`, `pi-prompt-capture-ipc-smoke` |
| 4 | Rodar a suíte de janela no Linux sob `xvfb` | M | Cobertura real de Linux, não só unidade | CI Ubuntu |
| 5 | Decidir o Conferir no Linux | G | Hoje é impossível: `conferir-host.cjs:79` só aceita macOS/Windows e `main.cjs:231` só liga captura nesses dois | produto |
| 6 | Tirar do payload o que não é usado (ver abaixo) | P/M | Até ~38 MB no app instalado, se cada corte se provar | `bundle-runtime.cjs` |
| 7 | Filtro de `.mts`/`.cts` no payload instalado | P | Não levar fonte TS para o app | `stageBundlePayload` |

### Windows e Linux (#108), o que impede hoje

O ensaio de 2026-11-04 (run 41832721206) passou em atualizar, preservar
`config.json`, aceitar a release assinada e abrir por 30 s. Isso prova que o
app sobe, não que a interface funciona. As travas, em ordem:

1. **Motor falso não executa no Windows.** `LEARNING_DESK_OPENCODE` aponta para
   `tests/fake-opencode.mjs`, e o Windows não roda `.mjs` como executável (EFTYPE).
   A maioria dos 81 testes morre aí; é limite do teste, não da Mesa.
2. **Falhas sem diagnóstico** que podem ser defeito real: `opencode-install-ui`
   (“o comando de login mostra o caminho completo do binário instalado”), “a
   sessão nova é OpenCode”, “em N os três botões ficam na mesma linha”,
   `pdf-rotation` (âncora da página) e “prompt aceito” em
   `pi-prompt-capture-ipc-smoke`.
3. **Linux não tem Conferir.** `conferir-host.cjs:79` recusa qualquer
   plataforma que não seja `darwin`/`win32`; `capture-win.cjs` cobre Windows e
   `visual-check/` é macOS. Se Conferir for requisito no Linux, é projeto
   novo, não ajuste de teste.
4. **Linux não tem ensaio empacotado.** O Windows tem `Ensaio no Windows`
   (zip + abrir por 30 s) e a unidade roda em Ubuntu/Windows; a suíte de janela
   não está no CI e não há zip/empacotado Linux testado. A distribuição Linux
   também não está definida (AppImage, deb etc.) — isso é decisão de release,
   fora do #108.

## Dependências: tamanho real em `node_modules`

Medido com `du -sh` em 2026-11-04, Linux, a partir do `package-lock.json`
deste commit. Tamanho de `node_modules` varia por plataforma por causa dos
opcionais nativos.

| Pacote | Tamanho | Situação |
| --- | ---: | --- |
| `electron` | 275 MB | Base; só sai trocando de stack. |
| `@anthropic-ai/claude-agent-sdk` | 4,8 MB | Runtime do tutor. |
| `@anthropic-ai/sdk` | 18 MB | Peer do SDK; runtime. |
| `@anthropic-ai/claude-agent-sdk-linux-x64` | 285 MB | CLI opcional; **já omitido** do bundle por `externalClaude`. |
| `pdfjs-dist` | 35 MB | `legacy` 17 MB + `build` 12 MB; o resto são cmaps, wasm, fontes, web e types. |
| `@napi-rs/canvas` | 34 MB | Opcional do `pdfjs-dist`; hoje o `runtimePackages` copia. |
| `chart.js` | 6,4 MB | Usado por `activity-protocol.cjs`; **não** está nas raízes de `runtimePackages` — confirmar o app empacotado antes de mexer. |
| `katex` | 4,5 MB | `dist` 3,1 MB; `src` 1,2 MB e `contrib` 208 KB não são servidos pelo protocolo. |
| `dompurify` | 1,7 MB | Runtime do renderer. |
| `marked` | 560 KB | Runtime do renderer. |
| `zod` + `@modelcontextprotocol/sdk` + `hono` + `ajv` + `undici` | 8,2 + 6,3 + 3,7 + 2,5 + 2,2 MB | Peers/transitivos do SDK do Claude; o MCP `mesa` usa o mesmo SDK. |
| `json-schema-to-ts` + `zod-to-json-schema` | 1,2 MB + 656 KB | Transitivos do SDK. |
| `typescript` + `@typescript/typescript-linux-x64` | 3,6 MB + 27 MB | Dev; não vai no payload. |
| `@playwright/test` + `playwright` + `playwright-core` | 64 KB + 5 MB + 14 MB | Dev; só testes de janela. |
| `eslint` + `@eslint` + `globals` + `@eslint/js` | 5,1 + 0,9 + 0,3 MB + 48 KB | Dev; não vai no payload. |
| `@types/*` | 2,8 MB | Dev. |
| **Total de `node_modules`** | **772 MB** | Inclui dev e opcionais; não é o tamanho do app. |

**Candidatos a sair ou encolher** (só lista; cada um precisa de prova antes):

- `@napi-rs/canvas` — 34 MB. O renderer desenha em canvas do Chromium; a
  extração de texto do `legacy` provavelmente não precisa do canvas nativo.
  Se `npm test` e o app empacotado passarem sem ele, é o maior corte isolado.
- `pdfjs-dist/types` (892 KB), `web` (1,6 MB) e talvez `image_decoders`
  (636 KB) — o protocolo serve `build`, `legacy`, `cmaps`, `standard_fonts` e
  `wasm`; o resto não é referenciado no código.
- `katex/src` (1,2 MB), `contrib` (208 KB) e `types` (60 KB) — o
  `activity-protocol` serve só `dist`.
- `chart.js` (6,4 MB) — não está no bundle atual; decidir se entra (gráficos
  no app instalado) ou se sai da dependência. Não deixar como está sem
  conferir.
- CLI opcional do Claude (285 MB) — já fora do bundle; manter a regra
  `externalClaude`.
- `electron` (275 MB) — só com Tauri, rejeitado abaixo.

Corte esperado, se os três primeiros se confirmarem: **~38 MB** (~9% de um app
instalado de 410 MiB). Não medido no app empacotado.

## Gatilhos para rever o Electron

Electron fica. Reabre-se a discussão só se, **medido depois do próximo
release**, um destes acontecer:

- janela utilizável passar de ~2 s, ou working set com dois PDFs e o tutor
  passar de ~700 MiB, e a causa não for corrigível na Mesa;
- uma integração necessária (captura de janela, `WebContentsView` do GeoGebra,
  MCP/processos) ficar impossível no Electron;
- Tauri conseguir dispensar o Node **e** manter essas integrações sem sidecar.
  Hoje não consegue: o SDK do Claude e o MCP continuam em JavaScript.

Medir com `node tests/perf-probe.mjs --runs 3` e
`node scripts/measure-boot.mjs --json`, não por impressão.

## Rejeitado

| Alternativa | Razão |
| --- | --- |
| Tauri | Troca o Chromium por WebView2/WKWebView/WebKitGTK, que variam por sistema, e ainda precisaria de Node como sidecar para SDK/MCP. Perde `WebContentsView`, controle de processos e captura. |
| Bun | O Electron já traz Node; Bun só valeria como ferramenta de desenvolvimento. |
| React/Vue/Svelte | `view-host.mjs` já aplica as árvores do Bend; o framework adiciona runtime e reescrita sem tirar CPU ou peso. |
| Reescrita total em TS | Colide com a #87 e não dá ganho ao aluno. |
| esbuild para o renderer agora | Não há ganho de abertura medido; o corte de 220 MiB em 2026-10-07 não mudou a abertura. Só volta com A/B de ≥10% ou >100 ms. |
| esbuild no lugar do tsc para emitir | Não typecheck; precisaria do tsc de qualquer jeito e mudaria caminhos/imports. |
| `strict` agora | A dívida atual (1083 erros sem strict) mostra que seria reescrita. Fica para a fatia (d). |
| Declarações `.d.ts` como destino | Preservam o blame, mas não entregam implementação TS. Ficam como primeiro passo da fronteira, não como fim. |

## O que não foi medido

- `perf-probe` não foi rodado nesta máquina (compartilhada; não abri janela).
  Os números de abertura/memória são de `issue-67-resultado.md` (Electron
  44.7.2, macOS arm64) e do doc de 2026-10-07, não do Electron 45.2.0.
- Erros com `strict` não foram contados.
- A suíte de janela não foi rodada em Windows nem em Linux; os 15/81 são do
  ensaio de 2026-11-04 no runner.
- Nenhum protótipo Tauri foi montado; a comparação é documental.
- Os cortes de dependência não foram aplicados nem medidos no app empacotado.
- A tag `v1.1.0` não existe neste clone; o updater foi conferido no HEAD 1.1.0
  e na tag `v1.0.2`.
