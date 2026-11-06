# 4. TypeScript aos poucos, sem reescrita

**Status:** decidida em 2026-11-04 (#96), por delegação do autor. Nenhum código
desta decisão entra no próximo release (o que fecha a #87); a migração começa
depois dele.

## Contexto

O autor quer TypeScript para reaproveitar o T3 Code e deixar explícitos os
contratos entre motores, IPC e ferramentas. O app é Electron e o renderer não
tem build: `index.html` carrega `renderer.mjs` direto, e `desk/src/generated/*`
é Bend compilado e commitado. Hoje o `tsconfig.json` lista 152 entradas (150
arquivos de código e 2 `.d.ts`) com `// @ts-check`, com `checkJs:false`; o
resto do JS não entra no `tsc`.

A medição desta decisão (2026-11-04, Linux, TypeScript 7.0.2) ligou
`checkJs:true` em `*.cjs`, `*.mjs`, `src/**` e `types/**/*.d.ts`, excluindo
`tests` e `src/generated`, com `strict:false`: **1083 erros**, dos quais **843
TS2339**, em 130 arquivos, em ~7,1 s. Sem os `types/*.d.ts` o número sobe para
1292/1052; é o recorte com esses tipos que reproduz o número da issue. As
causas dos TS2339:

| Categoria | Erros | Exemplo |
| --- | ---: | --- |
| Classes/mixins do adaptador | 236 | `_emit`, `_generation`, `_turn` fora do typedef da classe |
| Tipo DOM frouxo | 186 | `closest`, `classList`, `dataset` em `object`/`Element` |
| Forma não tipada | 307 | `version`, `id`, `detail` em `{}`/`unknown` |
| Outros | 114 | `PdfPanel`, `EventTarget`, `Node` |

Por pasta: `src/` (arquivos soltos) 397, `src/agents` 326, raiz de `desk/`
194, `src/study-data` 102, `src/cards` 46. Os arquivos piores são
`claude-adapter-query.cjs` (103),
`src/pdf.mjs` (58), `claude-adapter-stream.cjs` (50) e
`claude-adapter-controls.cjs` (41).

## Decisão

A migração é **incremental, sem reescrita**, e o `strict` é a última fatia.

1. **Fatia (a): `checkJs` no projeto todo, sem renomear nada.** O portão ganha
   um **baseline** de erros por arquivo e código: erro novo reprova; a contagem
   só cai. O baseline é dívida visível, não desculpa; o ticket que tocar um
   arquivo baixa a linha dele. Os `desk/src/generated/*.core.js` ganham tipos
   gerados do `.bend` e commitados como os próprios artefatos, para o
   `checkJs` enxergar as chaves e assinaturas reais.
2. **Fatia (b): as fronteiras viram `.mts`/`.cts`.** Contrato dos motores
   (`src/agents/` — `service.cjs` e o contrato de `claude-adapter`), IPC
   (`preload.cjs`) e ferramentas do MCP (`src/extensions/mesa-mcp/`). É
   implementação TypeScript, não só declaração `.d.ts`.
3. **Fatia (c): o resto quando um ticket já mexer no arquivo.** Módulos
   grandes quebram por responsabilidade nessa hora, como o padrão dos
   `*-host.cjs` da #43: `main.cjs` (797 linhas) e `src/main.mjs` (800) são os
   primeiros candidatos.
4. **Fatia (d): `strict` por último**, depois de (a)–(c). O número de erros com
   `strict` não foi medido; a dívida sem `strict` já mostra que não é uma
   troca de flag.

## Compilação

**Compilador: `tsc`.** O TypeScript 7.0.2 já é devDependency e é o mesmo
compilador que faz o `checkJs`; o esbuild não typecheck e exigiria os dois.
Não há bundling novo nesta decisão.

O `.mts`/`.cts` compila para `.mjs`/`.cjs` **ao lado**, e a saída é
**commitada**, como já acontece com `desk/src/generated/*`. O renderer continua
carregando `renderer.mjs` direto de `index.html`, sem build em tempo de
execução.

Por que commitada:

- `desk/updater.cjs` só roda `npm ci` quando `package-lock.json` muda
  (`updater.cjs:229-232` no HEAD; a tag `v1.0.2` tem a mesma regra em
  `188-191`). Quem está na 1.0.2 ou na 1.1.0 não roda build; se o JS gerado
  faltar no release, o app quebra. A tag `v1.1.0` não existe neste clone; o
  `package.json` do HEAD é 1.1.0 e usa o mesmo updater.
- O updater viaja como cópia para o tmpdir e só usa builtins do Node; ele não
  tem como compilar TypeScript.
- O snapshot público leva `desk/` inteiro (`snapshot-fora.txt` não exclui
  `desk/`), então fonte e gerado entram no repositório público e no zip da
  Release. `verify:bend` não cobre a saída do `tsc`; o release precisa rodar
  também o portão novo.

Portão: `npm run verify:ts` compila para um diretório temporário e compara
byte a byte com o commitado. Ele roda no `pretest`/`core-gate` e no pre-push,
junto de `check`, `typecheck` e `lint`. A saída gerada leva o cabeçalho
`// GERADO de <fonte>.mts — não edite` e `// @ts-nocheck`, para o `checkJs` do
projeto não rechecar o gerado; a fonte `.mts` é a checada.

`git blame`: a fonte é o `.mts`/`.cts`; o gerado é artefato. Cada commit de
conversão entra em `.git-blame-ignore-revs`, e a configuração local do git pode
ser ligada no `npm run setup`, como já acontece com os hooks. A história
anterior do `.cjs`/`.mjs` continua acessível por `git log -- <arquivo>`; o
blame do arquivo gerado passa a apontar para a conversão, e é por isso que a
revisão do dia a dia é na fonte.

## O que não muda

- **Electron fica.** A Mesa usa pdf.js, `WebContentsView` do GeoGebra,
  processos Node/MCP e captura de janela. Tauri usa WebView2/Chromium no
  Windows, WKWebView no macOS e WebKitGTK no Linux — três motores diferentes
  ([Tauri, “Webview Versions”](https://v2.tauri.app/reference/webview-versions/),
  atualizado em 2026-05-17). O SDK do Claude e o MCP da Mesa são JavaScript:
  no Tauri eles viram sidecar Node ou reescrita
  ([Tauri, “Embedding External Binaries”](https://v2.tauri.app/develop/sidecar/),
  atualizado em 2026-06-15). O Electron entrega Chromium e Node no mesmo
  runtime ([Electron, “Process Model”](https://www.electronjs.org/docs/latest/tutorial/process-model),
  consultado em 2026-11-04).
- **Bun fica de fora.** O Electron já traz Node; Bun só valeria como ferramenta
  de desenvolvimento.
- **Sem framework de UI.** `src/view-host.mjs` (236 linhas) aplica as árvores
  que vêm do Bend; 34 módulos o importam e há 68 ocorrências de `from` para
  `generated/*.core.js`. React/Vue não tiram CPU nem peso: o trabalho de
  reconciliação já existe no aplicador, e o repouso medido é ~1 layout, ~1
  recálculo de estilo e 1–2 ms de script em 10 s (`issue-67-resultado.md`).
- **Sem bundle do renderer agora.** O `measure-boot` deste commit conta 202
  módulos, 3,88 MB estáticos, 16 folhas (83 KB) e o pdf.js de 861 KB fora do
  caminho. O corte de 220 MiB no payload em 2026-10-07 não mudou a abertura
  (978 → 991 ms, ruído). esbuild só entra se um A/B de abertura mostrar ganho
  de pelo menos 10% ou mais de 100 ms atribuído ao carregamento de módulos.
- **O núcleo Bend continua** para invariantes, com leis e provas (ADRs 0001 e
  0003). TypeScript tipa o formato; não substitui a prova de que a regra vale.

## Consequências

- O portão fica ~7 s mais caro na fatia (a); depois, o baseline só pode cair.
- Passam a existir dois gerados: Bend (`src/generated`) e TS (`.mjs`/`.cjs` ao
  lado da fonte). `verify:bend` cobre o primeiro; `verify:ts`, o segundo.
- O release ganha um passo antes do snapshot: `npm run verify:ts` (e o
  `npm test`, que já roda `typecheck`/`lint`).
- A conversão de uma fronteira perde o blame linha a linha no arquivo gerado;
  a fonte nova e o histórico antigo continuam legíveis.
- `strict` fica visivelmente adiado; a dívida de 1083 erros não some, mas não
  cresce.

## Alternativas consideradas

- **Reescrever tudo de uma vez:** colide com a #87, não dá ganho ao aluno e
  vira um diff impossível de revisar. Rejeitada.
- **Só declarações `.d.ts` para as fronteiras:** preserva 100% do blame e é
  útil como primeiro passo da fatia (b), mas não entrega a implementação TS.
  Fica como etapa, não como destino.
- **esbuild para emitir:** mais rápido, mas não typecheck; precisaria do `tsc`
  de qualquer jeito e mudaria caminhos/imports. Sem ganho de abertura medido.
  Rejeitada por enquanto.
- **Tauri ou Bun:** acima. O critério para reabrir Electron está em
  [`docs/agents/stack.md`](../agents/stack.md).
- **`strict` agora:** transformaria a migração em reescrita. Rejeitada.

## Referências

- Issues #96 (decisão e fatias), #87 (próximo release) e #108 (Windows/Linux).
- ADRs 0001 e 0003 (Bend).
- [`docs/agents/release.md`](../agents/release.md) (updater e snapshot) e
  [`docs/agents/stack.md`](../agents/stack.md) (mapa de stack).
- Medições: [`docs/OTIMIZACOES-ELECTRON-2026-10-07.md`](../OTIMIZACOES-ELECTRON-2026-10-07.md),
  [`docs/reviews/issue-67-resultado.md`](../reviews/issue-67-resultado.md) e
  `desk/scripts/measure-boot.mjs` (execução de 2026-11-04).
