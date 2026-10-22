# Revisão independente r3 — hooks/lib/manifest/testes do mod Mesa (aba Code do Desktop)

- **Data:** 2026-10-05
- **Escopo:** `claude-mod/mesa-study/hooks/**`, `lib/**`, `.claude-plugin/plugin.json`, `package.json`, `tests/mod*.test.mjs` e `tests/integration-bridge.test.mjs`.
- **Modo:** somente leitura de código; único arquivo escrito: este relatório. Nenhum login, inferência, captura real, install/update, carregamento no app, commit ou push.
- **Fora do escopo (não duplicado):** `host/**` e os `tests/host-*.test.mjs` são do outro revisor (`docs/reviews/mesa-mod-host-review-20261005-r3.md`); toquei no host só para conferir o contrato CLI↔`lib/helper.mjs`. O achado A daquele relatório (root obsoleta derruba a página) foi lido e não é repetido aqui.
- **Preservação:** `desk/`, `core/`, `chat/`, bundle, config e sessão não foram tocados. Nenhum material de curso entrou em fixture, log ou reprodução (só PDFs sintéticos/fakes e caminhos `/fake`).

## 1. Snapshot congelado usado

`claude-mod/` está untracked, então conferi contra estes hashes (12 primeiros do sha256; revalidados depois das reproduções, sem mudança):

| Arquivo | mtime | sha256 (12) |
|---|---|---|
| `hooks/register.mjs` | 10-05 21:42 | `593cdb40b283` |
| `hooks/hooks.json` | 10-05 21:29 | `12ca4aa78891` |
| `.claude-plugin/plugin.json` | 10-05 21:06 | `87f79b8dd97c` |
| `package.json` | 10-05 21:06 | `ebe854678736` |
| `lib/mesa.mjs` | 10-05 21:48 | `641862dac3f8` |
| `lib/helper.mjs` | 10-05 21:50 | `051190600d87` |
| `lib/session.mjs` | 10-05 21:48 | `7c99b527a023` |
| `lib/view.mjs` | 10-05 21:42 | `99efb3cf5b9e` |
| `lib/paths.mjs` | 10-05 21:13 | `bf1cea6f9815` |
| `lib/calculator.mjs` | 10-05 21:13 | `2c9123b1ff68` |
| `tests/mod-ui.test.mjs` | 10-05 21:46 | `a97222ff886b` |
| `tests/mod-mesa.test.mjs` | 10-05 21:46 | `fab4060aa7c9` |
| `tests/mod-lib.test.mjs` | 10-05 21:51 | `f6816fb6ef18` |
| `tests/mod-harness.test.mjs` | 10-05 21:44 | `0650253fc83b` |
| `tests/integration-bridge.test.mjs` | 10-05 21:30 | `24f3a588fc93` |

## 2. Evidência própria executada

- **Suíte completa** (`npm test` no pacote, Node v26.10.0): **104/104 passam, 0 falhas, 0 skip** — inclui os 5 testes Poppler reais e a ponte real. Confirma a claim do pai.
- **Recorte do meu escopo** (`node --test tests/mod-*.test.mjs tests/integration-bridge.test.mjs`): **52/52 passam, 0 skip** (11 `mod-ui`, 26 `mod-mesa`, 13 `mod-lib`, 1 autoteste do harness, 1 ponte real).
- **Ponte real** (parte do `integration-bridge.test.mjs`): Node → `host/cli.mjs` → Poppler 26.10.0, PDF sintético de 2 páginas com nome contendo aspas/`$( )`, página pequena com SVG, página grande com `svg:null` + `previewWarning` + PNG, `chmod 0600`, PDF intacto por sha256, 3 chamadas sem reenvio. Executada de verdade (não é espelho do fake).
- **Sondas independentes** (script em `os.tmpdir()/opencode/mesa-r3-probes.mjs`, importando o código real; nada escrito no repo):
  - **P1** — `isInsideDir('/tmp/cache/../etc/passwd','/tmp/cache')` → `true`; `isInsideDir('/etc/passwd','')` → `true`; `isInsideDir('C:\\Cache\\x','C:\\cache')` → `false` (case). Via `createHelper`: com `$.fs.stat` falhando, `snapshotPath` com `..` é **aceito**; com `{resolve:true}` funcionando, o realpath fora do cache é **recusado** (`page-invalida`); com o cache resolvido e o stat do arquivo falhando, caminho lexical sob o symlink é **recusado** (falso negativo seguro).
  - **P2** — corrida de seleção: com `select` de B preso no `fs.stat`, um `next` para A entra em `pendingPage`; quando o select termina, a página 2 de A é carregada **depois** de B e grava `pdfPath` de A com `activeDoc`=B (3 chamadas ao helper).
  - **P2b** — com A e B abertos (B ativo, `pdfPath`=B), voltar para a aba A e pressionar **"Carregar PDF"** com o campo como está re-seleciona B e **volta a aba para B** (`activeDoc` 0 → 1).
  - **P3** — estado máximo de render: árvore válida em desktop, `Svg.source` com exatamente 131.072 chars aceito, maior `Text` = 236 chars, 29 nós; `pagePrompt` com caminho de 4.096 chars = 7.019 chars e com caminho Windows de barras = 6.499 chars (bem abaixo dos tetos de `Text`/10k e de contexto/100k).
  - **P4** — falha transitória de `store.set`: não bloqueia permanentemente; o gesto seguinte grava o estado novo com as duas alterações (`{subject:"um",question:"dois"}`).

## 3. Achados

### A. [Baixo] `pendingPage` pedida durante um `select` executa depois, para o documento antigo, e escreve `pdfPath`/página fora da aba ativa

- **Onde:** `lib/mesa.mjs:322-329` (página enfileirada quando `busy` é `capture`/`list`/`select`), `lib/mesa.mjs:405` (o `select` limpa `pendingPage` só **no início**), `lib/mesa.mjs:448-451` (ao terminar, carrega o documento novo e em seguida `drain` em `:271-284` executa a fila velha), `lib/mesa.mjs:371` (`pdfPath = res.document.path` em qualquer slot).
- **Fluxo normal afetado:** usuário tem A ativo e manda abrir B; enquanto o `fs.stat` de B está em voo, clica "Próxima" (a UI não desabilita as setas durante `select` — `lib/view.mjs:131-133` só usa `dimColor` para `busy === 'page'`). Ao terminar B, a página pedida de A é carregada em segundo plano, gasta um processo do helper e sobrescreve `session.pdfPath` com A, embora a aba ativa seja B.
- **Reprodutor:** P2 acima (fakes; resultado: `activeDoc:1`, `docs[0].page:2`, `pdfPath:/fake/pdfs/a.pdf`, 3 chamadas).
- **Impacto:** estado/UI inconsistentes e chamada extra ao helper; análise e prompt continuam usando o documento ativo (não contamina o `Read`). Sem quebra de segurança.
- **Observação de teste:** a suíte cobre troca de aba durante página em voo (`mod-mesa.test.mjs:603-630`), mas não o `pendingPage` que chega **durante** o `select`.

### B. [Baixo] O campo "Caminho do PDF" segue a última página carregada, não a aba ativa; "Carregar PDF" pode pular de aba

- **Onde:** `lib/mesa.mjs:371` e `:429` (sempre `session.pdfPath = caminho carregado/selecionado`), `lib/mesa.mjs:692-710` (`selectTab` não atualiza `pdfPath`), `lib/view.mjs:73-80` (Input ligado a `session.pdfPath`; botão chama `loadFromPath()` sem valor e `loadFromPath` cai em `session.pdfPath` — `lib/mesa.mjs:681-690`).
- **Fluxo normal afetado:** com A e B abertos, B ativo, o campo mostra B; voltar para a aba A e apertar "Carregar PDF" (sem editar o campo) re-seleciona B e **volta a aba para B**. É o caminho mais provável de "recarregar a página do PDF que estou vendo".
- **Reprodutor:** P2b acima (`activeDoc` 0 → 1).
- **Impacto:** confusão de UX/estado persistido; nenhum dado é perdido. O caminho ativo verdadeiro continua em `docs[activeDoc].path`.

### C. [Baixo — endurecimento] `isInsideDir` é lexical: aceita `..` e diretório vazio quando o `realpath` não decide

- **Onde:** `lib/helper.mjs:86-98` (`normalizeSeparators` não resolve `..`/`.`/segmentos vazios; `isInsideDir` compara prefixo; `dir` vazio aceita qualquer caminho absoluto) e `lib/helper.mjs:107-133` (`snapshotInsideCache` cai no lexical quando `$.fs.stat` falha ou não existe).
- **Julgamento contra o contrato real (não ameaça exótica):** com a API real, `$.fs.stat(snapshotPath,{resolve:true})` devolve `realPath` com `.`/`..` dobrados (`claude-code.d.ts:4139-4149`) e o caminho com `..` é **recusado** (P1). O fallback lexical só decide quando o stat falha/está ausente; o emissor é o CLI local confiável do próprio plugin (mesmo processo/usuário). Não há bypass prático do confinamento: quando o arquivo existe, o realpath decide; quando não existe, o modelo só receberia um `Read` de caminho inexistente.
- **Riscos residuais reais:** (1) se algum call site futuro usar `isInsideDir` como **única** guarda, a fraqueza vira exploração; (2) `dir` vazio é inalcançável hoje porque `normalizeOptions` força `cacheDir` absoluto (`lib/mesa.mjs:36-38`); (3) no Windows a comparação é case-sensitive (`C:\Cache` × `C:\cache` → falso negativo, P1) e o stat do arquivo falhando com o cache resolvido também gera falso negativo seguro (P1, terceiro caso).
- **Reprodutor:** P1 acima. Sem bloqueador.

### D. [Informativo] `roots` é lido de `options`, mas não é declarado no `userConfig`

- **Onde:** `lib/mesa.mjs:39-51` (`normalizeOptions` lê `options.roots`) × `.claude-plugin/plugin.json:16-29` (só `nodePath` e `cacheDir`).
- **Efeito:** o caminho existe e é testado (`mod-lib.test.mjs:92-108`), mas o usuário não consegue configurá-lo pelo manifesto; as roots de sessão vêm da UI ("Usar pasta"). Código morto inofensivo — ou campo a declarar, se for intenção.

## 4. Claims do brief e da r1/r2 conferidas (por código + teste)

| Claim | Status | Evidência |
|---|---|---|
| `/mesa` registra comando e abre painel, sem turno do modelo | **Confirmado** | `hooks/register.mjs:28-45`, `lib/mesa.mjs:748-774`; testes `mod-mesa.test.mjs:65-92` (`commandRegister` 1, `process`/`promptSubmit` 0) |
| Navegação/calculadora locais, nada ao modelo | **Confirmado** | `lib/mesa.mjs:303-383,723-740`; `mod-ui.test.mjs:98-112`; `mod-mesa.test.mjs:525-544` |
| Captura e análise são ações explícitas separadas | **Confirmado** | botões distintos (`lib/view.mjs:170-184`); `capture`/`analyzeCapture` só por callback (`lib/mesa.mjs:508-549,606-622`); testes `mod-mesa.test.mjs:546-574` |
| Prompt textual com `Read` do PNG local, sem anexos, sem claim de leitura | **Confirmado** | `pagePrompt`/`capturePrompt` (`lib/mesa.mjs:77-113`) com caminho JSON completo; `sendPrompt` envia só `{ text }` (`:551-578`); `mod-ui.test.mjs:135-168,170-197` |
| Prévia SVG ≤131.072 ou `null` + aviso, PNG sempre | **Confirmado** | `lib/helper.mjs:157-183`; host devolve PNG com `svg:null`; `mod-mesa.test.mjs:688-715`; ponte real |
| Helper por argv sem shell | **Confirmado** | `lib/helper.mjs:240-270` (array `[nodePath, cli, JSON]`); `mod-lib.test.mjs:165-187`; ponte real com metacaracteres |
| Imports do sandbox (sem Node/DOM/WASM/timers/globais não oficiais) | **Confirmado** | `hooks/register.mjs` e `lib/*` importam só arquivos do plugin; grep sem `setTimeout`/`window`/`document`/`process`/`require`/`WebAssembly`/`eval`; só `Date.now`/`Date.parse` (intrínseco ECMAScript) |
| Hooks/matchers exatos do contrato | **Confirmado** | `register.mjs:28-59` × `claude-code.d.ts` (`command.run`→`command`, `ui.render`→`component`+`requestId`, `ui.open`/`ui.close`→`id`; `ui.panes().isPlaced` em `:10884-10907`; `ui.log {to:'debug'}` em `:10805-10820`) |
| Store serializado/coalescido, erro visível, corrompido/incompatível bloqueia até "Substituir" | **Confirmado** | `lib/mesa.mjs:205-251`, `lib/session.mjs:82-110`; `mod-mesa.test.mjs:399-511`; P4 |
| Retomada sem helper (metadados) | **Confirmado** | `lib/session.mjs:151-176`; `mod-mesa.test.mjs:399-423` (2ª engine restaura página/matéria/questão/notas com 0 `process`) |
| `parseInt`/`jump` estrito, page clamp, dedupe de clique | **Confirmado** | `lib/mesa.mjs:64-70,654-679`; `mod-mesa.test.mjs:207-283` |
| Fallbacks de superfície (terminal sem Svg, mobile sem Input/Select) | **Confirmado** | `lib/view.mjs:32-42`; `mod-ui.test.mjs:63-96`; tipos por superfície em `claude-code.d.ts:3105-3168` |
| Manifest/pacote | **Confirmado** | `plugin.json`: `name`/`version`/`description`/`author`/`license`/`keywords`/`displayName` válidos e `userConfig` com `type:"directory"` + `title` + `description` + `default` (schema oficial do manifest); `hooks/hooks.json` com `"modules":[...]` é o formato de mod; `package.json` coerente |

## 5. Limites de prova (o que continua **não** validado)

- **Desktop:** nada foi carregado no app; `$.process.run` ("CLI only" no tipo), `$.fs.stat({resolve})`/`realPath`, `$.ui.open` retornando `{isPlaced}` (ou `void`), o teto do `Svg` aceitar `null`, o renderizador do Desktop e o `Read` do PNG não foram executados. Os 52 testes do meu recorte são engine fake + ponte Node/Poppler; só a ponte e os 5 Poppler são reais.
- **Captura real/TCC:** não executada (evitei listar janelas); o fluxo de captura é validado por fake e pelo relatório do host.
- **Windows:** `paths.mjs`/`isInsideDir` só têm testes de string; case-sensitivity e separadores reais não foram exercitados.
- **Inferência autenticada:** não executada.
- **Ponte sem Poppler:** o `integration-bridge` tem `skip: !ready` — em máquina sem `pdfinfo`/`pdftocairo` ele passa a pular silenciosamente (aqui rodou de verdade, 0 skip).

## 6. Veredito

**Nenhum bloqueador** nos hooks/lib/manifest/testes do mod. O estado, a serialização/retomada do store, a guarda de análise (documento/página corretos, sem anexos, sem claim de conclusão), a degradação por capacidade (`$.process` ausente, `svg:null` com PNG preservado) e o empacotamento estão coerentes com os tipos públicos 2.1.277 e com o contrato do host; a suíte real (104/104, 0 skip) reproduz as claims do pai. Os achados são **A e B (Baixos, estado/UX com reprodutor)** e **C (Baixo, endurecimento do confinamento lexical — não explorável com a API real e CLI confiável)**, mais o informativo D. A validação no Desktop (incluindo `$.process.run`, `Svg`/`null`, captura/TCC e o `Read` do PNG) continua pendente e é o próximo passo necessário, como o README já registra.
