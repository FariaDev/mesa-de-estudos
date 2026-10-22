# Ticket #46 — Dependências do desk em dia e Pi 1.3.0 (resultado)

Branch `claude/dreamy-wing-07076d`, cortada do `main` local (56d98a2). Sem push, sem PR,
sem mexer em issues. Nada de inferência real (Pi nem Claude): só `--version`, os
testes sintéticos e os testes nativos que carregam as extensões sem modelo. Não rodei
`npm run setup`, `update` nem `install-app`, e o bundle `Mesa de Estudos.app` ficou
intocado. O Pi do usuário (1.2.0 do Homebrew) não foi atualizado.

## Versões

| Pacote | Antes | Depois | Commit |
|---|---|---|---|
| `electron` | 44.2.0 | **44.7.2** | `d56cdd2` |
| `dompurify` | 3.4.16 | **3.4.17** | `5093587` |
| `pdfjs-dist` | 6.3.289 | **6.4.299** | `0e71bc6` |
| `marked` | 18.0.11 | **18.1.1** | `4538d29` |
| `katex` | 0.18.5 | **0.18.10**, depois **0.19.0** | `df5033c`, `cfcb831` |
| `@anthropic-ai/claude-agent-sdk` | 0.3.296 | **0.3.301** (pin exato mantido) | `2e99b20` |
| `@playwright/test` | 1.63.0 | **1.64.1** | `e0628e9` |
| Créditos do Sobre + trava de versões | — | — | `6e67ed6` |

Transitiva que mexeu: `@napi-rs/canvas` 1.0.8 → 1.0.11 (dependência opcional do
`pdfjs-dist`). Nenhuma outra dependência mudou; `npm ls` fecha com esses oito.

## O que mudou e o que afeta a Mesa

**Electron 44.2.0 → 44.7.2** (Chromium até 152.0.7977.149, Node 24.21).
- 44.3 endureceu permissões e `<webview>`: `nodeIntegrationInWorker` só vale com Node
  no frame, `getUserMedia` com `chromeMediaSource: 'desktop'` recusa ids de
  WebContents, `execCommand('paste')` pede ativação do usuário. A Mesa não usa
  `<webview>`, workers com Node nem captura por `getUserMedia`; os únicos
  `setPermission*Handler` são `callback(false)` / `() => false`.
- 44.4 passou a validar o nome em `protocol.registerSchemesAsPrivileged()` (RFC 3986);
  `mesa-activity` é válido.
- 44.7.0 trouxe `autoUpdater` do macOS com download em disco; a Mesa tem updater
  próprio (zip), não usa o `autoUpdater` do Electron.
- O resto é correção de Linux/Windows e backports de Chromium/V8/PDFium/ANGLE.

**DOMPurify 3.4.17.** Correções de `IN_PLACE` com `SAFE_FOR_TEMPLATES` e shadow roots,
guarda de `attributeName` SMIL em XHTML e casos de borda de namespaces. A Mesa não
usa `IN_PLACE`; patch de sanitizador entra sempre.

**pdf.js 6.4.299.** Anotações, conversão de fontes, formulários, padrões de
preenchimento, texto selecionável e desempenho; `operationsFilter` ganhou
`operatorList` (api-minor, não usado). **`destroy`:** `PDFDocumentProxy` continua sem
`destroy()` na 6.4.299 (só `PDFDocumentLoadingTask` tem), então o
`job.loadingTask?.destroy()` do #39 (`src/free-study.mjs`) segue sendo o caminho certo e
nada precisou mudar.

**marked 18.1.1.** Conformidade CommonMark/GFM (tabs em cabeçalhos ATX, listas e
blocos de código, autolinks, blockquote preguiçoso, blocos HTML, referências por
rótulo), `walkTokens` linear, correção de backtracking cúbico em destino de link e
rejeição de parênteses desbalanceados em destino de link. Sem mudança de API.

**KaTeX 0.18.10 → 0.19.0.** 0.18.6–0.18.10: `\reflectbox`, `\mapsfrom`, linhas finais
de `array`/`align`, tipos dos módulos `contrib` e fonte matemática do navegador como
reserva. A 0.18.11 (lançada junto da 0.19.0) fez o aviso "No character metrics" passar
pelo `strict` com o código `symbolNotInFont`, e a 0.19.0 só marca isso como
*breaking* (callback de `strict` que devolve `undefined`/`null` passa a avisar). **Não
quebra a Mesa:** o `strict` de `src/materials/template.mjs` sempre devolve `'ignore'`.
Efeito medido (script no escopo, comparando 0.18.10 e 0.19.0): para um glifo sem
métrica (ex. emoji em `\text{}`), o callback agora recebe `unknownSymbol` **e**
`symbolNotInFont`, e o `console.warn` some; as demais entradas (acentos, cirílico,
`\mathrm{日本語}`) saem iguais. O `symbolNotInFont` entra como aviso não bloqueante
(severidade `warning`), logo o diálogo de modelo de PDF pode mostrar um aviso a mais
por glifo desses. Não tratei: é cosmético; se incomodar, filtrar `symbolNotInFont`
em `evaluateMath`.

**Claude Agent SDK 0.3.301.** O binário de reserva que acompanha o SDK passou a ser o
**Claude Code 2.1.301** (`claude --version` do pacote da plataforma confirmou), então
`CLAUDE_PINNED_VERSION` em `src/agents/claude-environment.cjs` subiu de 2.1.296 para
2.1.301 e os testes/fixtures trocaram o par. `2.1.296` entrou na lista de versões não
revisadas do teste #28 (agora é recusada antes do login). Mudanças do SDK 0.3.297–.301:
política de permissão por ferramenta em servidores MCP do SDK, exports
`BUILTIN_TOOL_NAMES`/`LEGACY_TOOL_NAME_ALIASES`, `addPlugins` em `reloadPlugins()`,
`updatedInput` de hooks validado e com chaves desconhecidas descartadas, nomes MCP
reservados recusados (`__proto__` etc.), correção de `setModel()` no limite de uso e
mudança de código de erro quando disco cheio impede renovar login
(`invalid_request`/`api_error_status: null`). Os comentários do código que citavam
"SDK 0.3.296" foram atualizados com o pin (os testes de tipos contra o `sdk.d.ts`
real seguem verdes).

**Ponto de atenção — `updatedInput` validado (0.3.300).** A Mesa usa `updatedInput`
num hook PreToolUse: `activity-call-gate.cjs` injeta o `callRef` na entrada de
`criar_atividade` (`activity-bridge.cjs`, `injectRef`), e é o `callRef` que autoriza a
publicação. O SDK passou a validar esse `updatedInput` "como a entrada do próprio
Claude" e a **descartar chaves desconhecidas**. Pela leitura do código isso é seguro:
`callRef` está declarado como campo opcional do esquema da ferramenta
(`CREATE_FIELDS` em `src/extensions/mesa-activity/guide.mjs`, `zodShape` no servidor
MCP), então é uma chave conhecida. **Mas os testes não provam:** o SDK falso
(`tests/fixtures/claude-sdk-fake.mjs`) não reproduz a validação nova, e não rodei
turno real. Se o `callRef` fosse descartado, o sintoma seria "Referência de chamada
inválida; atividade não publicada." em toda atividade do Claude. Vale uma conferência
manual com um turno real pedindo uma atividade antes de liberar a atualização.

**Playwright 1.64.1.** Só testes. A 1.64.0 trazia a regressão de `_electron.launch`
perdendo intermitentemente a primeira janela de app empacotado (playwright#43247) e
a de rotas com redirecionamento cross-origin (#43242); a 1.64.1 corrige as duas. A
rodada completa de 59 janelas passou sem nenhuma perda de janela.

## Portões

Em cada commit rodei `MESA_GATE_CACHE=0 npm test` (pretest do núcleo incluso) mais os
testes de janela e hunts da área tocada:

| Commit | `npm test` | Janelas | Hunts |
|---|---|---|---|
| electron | verde | `npm run ui` completo, 59 ok | — (cobertos na rodada final) |
| dompurify | verde | `activity,chat`, 13 ok | `hunt-activity,hunt-chat`, 6 ok |
| pdfjs-dist | verde | `pdf,reader,material-preview`, 7 ok | `hunt-pdf`, 6 ok |
| marked | verde | `material,pdf-models,chat`, 13 ok (ver intermitência) | `hunt-chat`, 1 ok |
| katex 0.18.10 | verde | `material,pdf-models,activity`, 8 ok | — |
| katex 0.19.0 | verde | `material,pdf-models,activity,chat`, 17 ok | `hunt-activity`, 5 ok |
| SDK | verde (1323 testes) | `npm run test:claude-ui`, 9 corredores ok | — |
| playwright | verde | `npm run ui` completo, 59 ok | — |
| créditos | `about-credits-versions` 3 ok | `about,settings`, 4 ok | — |

**Rodada final** (HEAD `6e67ed6`, nesta ordem, tudo exit 0):
`npm run verify:bend` · `MESA_GATE_CACHE=0 npm test` · `npm run ui` (59 ok em 413 s)
· `npm run hunts` (23 ok, 1 pulado) · `npm run test:claude-ui` ·
`node tests/native-{tutor-pdf,activity-tool,tool-parity}.mjs` (Pi 1.2.0 do usuário e
Pi 1.3.0 temporário).

O pulado é o `hunt-handoff` (sem `chat/node_modules` no worktree). Rodei
`npm ci` em `chat/` (a pasta é ignorada pelo git; código da Conversa intocado) e o
`hunt-handoff` passou depois, em 8 s, com o Pi de mentira.

## Testes intermitentes (sem relação com a atualização)

Não tentei consertar; registro para um ticket próprio.

1. **`study-search.test.mjs:177`** ("resultado cobre conversa, lateral, caderno,
   anotação, livre, matéria e PDF com página"): falhou uma vez na linha de base, antes
   de qualquer pacote mudar (`texto do PDF na página certa`, 14 s). Passou 2 de 2
   isolado, e nas rodadas seguintes. Parece depender da extração de texto do PDF sob
   carga da rodada completa.
2. **`chat-library-ui.mjs` e `material-preview-ui.mjs`**: estouraram os 600 s do
   corredor juntos, os dois primeiros da fila do filtro `material,pdf-models,chat`,
   na etapa do `marked`. Isolados passaram em 6 s e 3 s, e o filtro inteiro (13
   janelas) passou em 46 s logo depois, com o mesmo `marked`. Não repetiu nas rodadas
   completas seguintes. Hipótese: travada na subida do Electron no começo da fila
   (sem evidência de causa; a pasta de artefatos da falha ficou em
   `desk/tests/artifacts/`, ignorada pelo git).

## Créditos e licenças (Sobre)

`desk/index.html` → Créditos e licenças agora cita versão, licença e copyright de
cada biblioteca embutida: Electron 44.7.2 (MIT), PDF.js 6.4.299 (Apache-2.0), KaTeX
0.19.0 (MIT), Chart.js 4.5.1 (MIT), Claude Agent SDK 0.3.301 (© Anthropic PBC) e duas
que **não constavam**: marked 18.1.1 (MIT, com o aviso do Markdown de John Gruber que
o `LICENSE` dele carrega) e DOMPurify 3.4.17 (Apache-2.0 ou MPL-2.0). Os textos
foram conferidos nos `LICENSE`/cabeçalhos dos pacotes instalados. O Playwright é
só de desenvolvimento e não é distribuído, então não entra. O aviso do T3 Code ficou
como estava. `tests/about-credits-versions.test.mjs` trava a lista: a versão citada
tem de ser a de `node_modules` e todo pacote de `dependencies` tem de estar
creditado (provei que falha com um número velho). O `about-ui` segue medindo o
diálogo cabendo em 900×650.

## Pi 1.3.0

Instalado em pasta temporária (`@earendil-works/pi-coding-agent@1.3.0`, fora do
repositório e do Homebrew). Os testes nativos resolvem o Pi por `resolvePi()`, então
apontei com `PATH=<temp>/node_modules/.bin:$PATH`; confirmei que `resolvePi` devolvia
o 1.3.0 (e `/opt/homebrew/bin/pi` sem o PATH).

| Teste | Pi 1.2.0 | Pi 1.3.0 |
|---|---|---|
| `native-tutor-pdf` | PASS | PASS |
| `native-activity-tool` | PASS | PASS |
| `native-tool-parity` | ok | ok |

**RPC.** Comparei as *formas* (chaves e tipos, nunca valores) de `get_state`,
`get_session_stats`, `get_commands`, `get_messages` e `get_available_models` num Pi
em `--mode rpc` com diretório de agente vazio: **idênticas** entre 1.2.0 e 1.3.0,
sem evento espontâneo em nenhuma. O CHANGELOG do 1.3.0 também não lista mudança de
protocolo RPC.

**Extensões.** Sem mudança na API de extensões: as duas da Mesa (`tutor-pdf`,
`mesa-activity`) carregam e publicam `criar_pdf`, `criar_atividade` e
`previsualizar_atividade` com a mesma descrição e o mesmo esquema do Claude. Única
correção que toca extensões: `ctx.ui.custom({overlay: true})` fechava o overlay do
topo em vez do próprio (a Mesa não usa).

**O que o 1.3.0 muda e interessa à Mesa:**
- Argumento de ferramenta com JSON malformado deixa de rodar "pela metade": agora
  falha na validação e o modelo vê o argumento bruto. Também corrigiu a perda de
  campos quando a string tem escape `\u` inválido, como `\usepackage` (LaTeX nos
  materiais do tutor).
- Sessão retomada mantém as ferramentas ativas (`--tools +nome`/`-nome` vale por cima).
- Troca de modelo descarta o raciocínio do modelo anterior em vez de mandá-lo como
  texto.
- `--model` com vários provedores passa a preferir o que tem credencial.
- Nova configuração `sessionShareDestination`; `models.json` do `kimi-coding` exige
  `/v1` na URL base; dependências internas do Pi ficam com versão exata.

**Não executei (por regra de não-inferência):**
- `hunt-handoff` com `REAL_PI=1`: é o único jeito de o teste usar o Pi de verdade, e
  isso manda um turno real ao provedor com as credenciais do usuário. Rodou no modo
  padrão (Pi de mentira), onde a versão do Pi não entra; o que ele cobre do Pi vem
  dos três testes nativos acima e da comparação RPC.
- `tests/native-rpc.mjs` (opt-in, usa Pi e provedor reais) e `npm run test:pi`:
  o `test:pi` falhou **igual** no 1.2.0 e no 1.3.0 com o diretório de agente isolado
  (`get_session_stats` sem `contextUsage` porque não há modelo/janela de contexto
  configurados ali). Não é regressão do 1.3.0, mas também não prova o contrato;
  deixei de rodá-lo contra o `~/.pi` do usuário para não tocar nas credenciais.

## Pendências

- **Conferir à mão** uma atividade no Claude Code (ponto de atenção do `updatedInput`
  acima): só um turno real prova o `callRef` atravessando o hook no SDK 0.3.301.
- **Conversa (`chat/`)** segue com `electron` 44.4.1 e o próprio SDK/Pi; o ticket
  falava em "ticket irmão se valer" e o escopo proibia mexer em `chat/`.
- **KaTeX 0.18.11** foi pulada pelo caminho (0.18.10 pedida → 0.19.0 avaliada).
- Aviso de `symbolNotInFont` duplicado ao lado de `unknownSymbol` (ver KaTeX).
- Os dois intermitentes acima.
