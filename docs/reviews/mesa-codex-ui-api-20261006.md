# Mesa no Codex — painel visual via MCP Apps: contrato de UI, ponte e compatibilidade

Data: 2026-10-06 · Autor: sub-agente de pesquisa (host/UI) · Escopo: **read-only documental** de fontes oficiais.
Projeto: `codex-plugin/mesa-study` (plugin experimental da Mesa de Estudos para o Codex).

O que **não** foi feito (limites honestos):

- O app Codex real (painel embutido) **não** foi aberto nem testado — inacessível por segurança do CUA. Nada aqui é alegação de teste real no host.
- Nenhum `npm install`, nenhum modelo/inferência chamado, nenhuma credencial/sessão/config pessoal lida, nenhum PDF de curso tocado, sem commit/push/restart.
- Nenhuma alteração de implementação: este é o único arquivo escrito (`docs/reviews/mesa-codex-ui-api-20261006.md`).
- Testes de bridge/host são **recomendados** aqui; nenhum foi implementado ainda.

Fontes primárias usadas (links no fim): spec estável **MCP Apps 2026-01-26** (SEP-1865), repo oficial `modelcontextprotocol/ext-apps` (README, `src/app.ts`, `src/generated/schema.ts`, API TypeDoc v1.1.2, Patterns), docs OpenAI de plugins/UI (`developers.openai.com/plugins/build/chatgpt-ui`, `plugins/reference`), changelog do Codex, doc oficial do MCP (`modelcontextprotocol.io`) e a matriz de extensões. Do lado local, leitura read-only de `server/CONTRACT.md`, `server/server.mjs` e do SDK instalado `@modelcontextprotocol/sdk@1.32.0`.

---

## 1. Resumo executivo

| Afirmação | Status | Base |
|---|---|---|
| ChatGPT renderiza componentes MCP Apps (iframe + bridge `postMessage`) | **Documentado** | `plugins/build/chatgpt-ui`; matriz de clientes (`io.modelcontextprotocol/ui` ✓) |
| O Codex app tem painéis MCP embutidos (engenharia) | **Sinal oficial, sem contrato de dev** | changelog do Codex (`26.423/26.429`, `26.609`; PRs #45805, #48764) |
| O Codex é host MCP Apps suportado/documentado | **Não** | ausente na matriz oficial de clientes e nos docs de UI (que citam ChatGPT; Codex aparece só no requisito de fallback textual) |
| `_meta.ui.resourceUri` + resource `text/html;profile=mcp-app` é o padrão correto a implementar | **Sim** | spec 2026-01-26; `plugins/reference` |
| Bridge `app.connect/callServerTool/sendMessage/updateModelContext` funciona no Codex | **Experimental — não alegar** | bridge é padrão MCP Apps; host Codex não documentado; testar antes |
| PNG via `data:` no painel funciona em todo host | **Provável por spec; não garantido** | CSP padrão da spec inclui `img-src 'self' data:`; docs ChatGPT não citam `data:`; validar no host |

Regra de ouro (doc oficial OpenAI): **as ferramentas têm de continuar úteis sem UI**, porque "ChatGPT **and Codex** can complete the workflow without UI". O painel é camada opcional/experimental.

---

## 2. Contrato de UI/tool/resources (MCP Apps padrão)

### 2.1 Identificadores

- Extensão: `io.modelcontextprotocol/ui` (negociada em `initialize` → `capabilities.extensions`).
- Resource de UI: URI **`ui://`** (reservado), MIME **`text/html;profile=mcp-app`** (constante `RESOURCE_MIME_TYPE` no SDK `ext-apps`). Outros formatos ficam fora do MVP.
- Link tool→UI: **`_meta.ui.resourceUri`** no descritor da tool. O formato plano `_meta["ui/resourceUri"]` está **deprecado** ("will be removed before GA") — não usar.
- Aliases ChatGPT (compatibilidade, opcionais): `_meta["openai/outputTemplate"]` equivale a `_meta.ui.resourceUri`. Novas UIs devem usar o campo padrão.

### 2.2 Tool descriptor (exemplo mínimo para a Mesa)

```json
{
  "name": "mesa_show",
  "title": "Mostrar painel da Mesa",
  "description": "Renderiza no painel a última página/captura pedida. Sem UI, devolve a imagem e os metadados como mesa_page/mesa_capture.",
  "inputSchema": { "type": "object", "properties": { "filePath": { "type": "string" }, "page": { "type": "integer" }, "windowId": { "type": "integer" } } },
  "_meta": {
    "ui": { "resourceUri": "ui://mesa-study/panel.html", "visibility": ["model", "app"] }
  },
  "annotations": { "readOnlyHint": false }
}
```

Regras de comportamento:

- Host que suporta MCP Apps busca o resource via `resources/read` (pode pré-carregar/cachear antes da chamada) e renderiza o resultado da tool no iframe.
- Host sem MCP Apps trata a tool como tool comum (fallback texto/imagem). `content` precisa continuar significativo mesmo com UI.
- O resource **tem de existir** no mesmo servidor. "Resource URI é cache key": mudança bruta de HTML/JS/CSS ⇒ publicar URI novo (versionar, ex.: `.../panel.v2.html`).
- Servidores **podem** omitir resources UI-only de `resources/list`.

### 2.3 Resource contents (o que o `resources/read` devolve)

```json
{
  "contents": [{
    "uri": "ui://mesa-study/panel.html",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!DOCTYPE html>…",
    "_meta": {
      "ui": {
        "prefersBorder": true
      }
    }
  }]
}
```

Campos de `_meta.ui` (no **contents**, não no config do `registerResource`):

| Campo | Uso na Mesa |
|---|---|
| `csp.connectDomains` | Não usar (painel não faz rede) |
| `csp.resourceDomains` | Não usar (tudo inline) |
| `csp.frameDomains` | Não usar (subframes bloqueados por padrão) |
| `csp.baseUriDomains` | Não usar |
| `permissions` (camera/microphone/geolocation/clipboardWrite) | Não usar |
| `domain` | Omitir no experimento local; exigido em submissão ChatGPT (único por plugin; default `https://web-sandbox.oaiusercontent.com`); formato host-dependente |
| `prefersBorder` | `true` recomendado (valores explícitos evitam default variável entre hosts) |

OpenAI-specific (opcional, só ChatGPT): `_meta["openai/ui"].availableDisplayModes` (ex.: `["inline","fullscreen"]`), `openai/widgetDescription`, `openai/widgetPrefersBorder`, `openai/widgetDomain`, `openai/widgetCSP` (legado snake_case; `redirect_domains` só existe nele). Nada disso é necessário para o padrão.

### 2.4 Negociação e degradação

- Cliente host anuncia: `capabilities.extensions["io.modelcontextprotocol/ui"] = { "mimeTypes": ["text/html;profile=mcp-app"] }`.
- Servidor **deveria** checar (helper `getUiCapability` no `ext-apps/server`) antes de registrar tools com UI; pode registrar variantes texto-only. Para o MVP experimental, registrar sempre é aceitável **desde que** o fallback textual já exista (é o caso das tools atuais).
- O **SDK 1.32 instalado já modela `extensions`** em `ClientCapabilities` (`types.d.ts`), então a checagem é viável sem atualizar dependências.

### 2.5 Formato atual da Mesa (o que o painel consome)

`mesa_page`/`mesa_capture` devolvem hoje (`server/CONTRACT.md`):

- `content = [{type:"image", data:<base64 PNG>, mimeType:"image/png"}, {type:"text", text:<meta JSON>}]`
- `structuredContent = meta` (sem bytes)
- erro: `isError:true` + um bloco texto `{ok:false,error:{code,message,detail?}}`

No painel, o `ui/notifications/tool-result` entrega esse `CallToolResult` inteiro — o `data` base64 vira `data:image/png;base64,<…>` no `<img>`. Nenhuma mudança no formato das tools é necessária.

Atenção a uma divergência entre fontes: a spec MCP Apps diz que `structuredContent` é "optimized for UI rendering (**not added to model context**)"; a referência OpenAI diz que `structuredContent` é "surfaced to the model and the component". Comportamento é do host — por isso **não colocar bytes de imagem em `structuredContent`** (a Mesa já não coloca; manter assim).

---

## 3. Ponte (View ↔ Host): mensagens e cliente `App`

### 3.1 Fluxo e mensagens

Iframe sandbox (`allow-scripts allow-same-origin`, origem distinta; host web exige sandbox proxy de duas camadas) fala JSON-RPC 2.0 por `postMessage`. O View age como cliente MCP do host.

| Direção | Método | Para que serve |
|---|---|---|
| View→Host | `ui/initialize` (request) | handshake; envia `appCapabilities`/`appInfo`/`protocolVersion` |
| Host→View | resposta de `ui/initialize` | `hostCapabilities`, `hostInfo`, `hostContext` (tema, locale, displayMode, containerDimensions, styles, safeAreaInsets…) |
| View→Host | `ui/notifications/initialized` | fim do handshake; host não pode mandar nada antes disso |
| Host→View | `ui/notifications/tool-input` (obrigatória, ≤1x) e `tool-input-partial` (0..n) | argumentos da tool (parcial = JSON "curado", não confiável para lógica) |
| Host→View | `ui/notifications/tool-result` | `CallToolResult` completo |
| Host→View | `ui/notifications/tool-cancelled` | cancelamento |
| Host→View | `ui/notifications/host-context-changed` | atualização parcial de tema/displayMode/etc. |
| View→Host | `ui/notifications/size-changed` | resize (SDK envia via ResizeObserver, `autoResize` default) |
| Host→View | `ui/resource-teardown` (request) | aviso antes de destruir; responder para não perder estado |
| View→Host | `tools/call` | chamar tool do **mesmo** servidor (proxy do host) |
| View→Host | `resources/read` | ler resource do mesmo servidor |
| View→Host | `ui/message` | mensagem no chat (hoje `role:"user"`); host PODE pedir consentimento |
| View→Host | `ui/update-model-context` | contexto para turnos futuros; **substitui** o anterior; host costuma adiar para a próxima mensagem |
| View→Host | `ui/open-link` | abrir URL externa; host pode negar |
| View→Host | `ui/request-display-mode` | inline/fullscreen/pip; host responde o modo efetivo |
| View→Host | `notifications/message` | log (não entra na conversa) |

Regras relevantes: ferramentas `visibility:["app"]` são **chamáveis pelo app** mas o host **não pode** listá-las ao modelo e **deve rejeitar** `tools/call` de app para tools sem `"app"`; chamadas cross-server são sempre bloqueadas. O host **deve** impor CSP a partir do `_meta.ui.csp`; `default-src 'none'`, `object-src 'none'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `media-src 'self' data:`, `connect-src 'none'` no default restritivo. Ou seja: **HTML único inline (script/style inline) roda no default; nada de rede por padrão**.

### 3.2 Cliente `App` (`@modelcontextprotocol/ext-apps`, pacote oficial — API v1.1.2)

O pacote é conveniência; a spec permite JSON-RPC cru. Assinaturas verificadas no fonte `src/app.ts`:

```ts
const app = new App({ name: "Mesa Panel", version: "0.1.0" }, /* capabilities */ {});

// 1) conecta: transport default = PostMessageTransport(window.parent, window.parent)
await app.connect();                 // Promise<void>; faz ui/initialize + initialized; lança se já conectado
// app.close() para permitir reconectar

// 2) dados da tool (registrar handlers ANTES de connect; registrar depois emite warning)
app.ontoolinput  = (params) => {/* params.arguments */};
app.ontoolinputpartial = (params) => {/* preview */};
app.ontoolresult = (result)  => {/* result.content / structuredContent / _meta / isError */};
app.onhostcontextchanged = (ctx) => {/* merge de tema/displayMode/etc. */};

// 3) ações
await app.callServerTool({ name: "mesa_page", arguments: { filePath, page } }); // params SEMPRE objeto {name, arguments}
await app.sendMessage({ role: "user", content: [{ type: "text", text: "…" }] }); // content: ARRAY de ContentBlock
await app.updateModelContext({ content: [{ type: "text", text: "…" }] });        // e/ou structuredContent
app.getHostCapabilities(); // { serverTools?, serverResources?, openLinks?, logging?, sandbox? } | undefined
app.getHostContext();      // tema, displayMode, containerDimensions, availableDisplayModes, locale, styles…
```

Detalhes que evitam bug:

- `callServerTool("mesa_page")` (string) **lança erro amigável** — sempre `{name, arguments}`.
- Todas as chamadas de host exigem `connect()` concluído; antes disso o SDK emite warning ("called before connect() completed").
- `callServerTool` opta por `resetTimeoutOnProgress` — hosts interativos/longos podem manter a request viva.
- `sendMessage.params.content` é **array** (`z.array(ContentBlockSchema)` em `src/generated/schema.ts`), apesar do exemplo em prosa da spec mostrar um único objeto; siga o schema do SDK.
- `updateModelContext` sobrescreve; só a última atualização vai ao modelo; pode ser dedupado.
- `ui/message` e `ui/open-link` podem ser negados/consentimento; feature-detect host capabilities (`serverTools`, `openLinks`, `logging`).
- Display modes: declarar em `appCapabilities.availableDisplayModes` no init; checar `hostContext.availableDisplayModes` antes de `requestDisplayMode`; o host pode responder modo diferente (tratar).
- Tema: host pode passar variáveis CSS (`--color-*`, `--font-*`, etc.) e fontes; usar fallback próprio. Não assumir que passa.
- `ontoolresult` e afins substituem handler anterior (semântica DOM `onclick`); `addEventListener` para múltiplos.

---

## 4. CSP e PNG em `data:` — o que é seguro e o que é experimental

Fatos oficiais:

1. A construção de CSP recomendada pela spec (Security Implications) é:
   `img-src 'self' data: <resourceDomains>; media-src 'self' data: <resourceDomains>; connect-src 'self' <connectDomains>; …`.
   Portanto, **`data:` é permitido para imagens no default da spec**, mesmo declarando domínios. `resourceDomains` são *origens* (https), não schemes — não existe campo oficial para declarar `data:`/`blob:`.
2. Sem declarar `_meta.ui.csp`, o host usa o default restritivo (acima) — que já basta para um painel 100% inline com `data:`.
3. Restrições reais:
   - O teto atual do servidor é **8 MiB** por PNG (`MESA_STUDY_MAX_IMAGE_BYTES`), e base64 infla ~33% ⇒ data URL de ~10,7 MiB. A doc de Patterns reconhece que "some host platforms have size limits on tool call responses" e recomenda **chunking por tool app-only** para binários grandes (padrão oficial `read_data_bytes` com `structuredContent` em blocos de ~500 KB).
   - Hosts podem restringir mais que a spec ("MAY further restrict"). A doc ChatGPT lista campos de `_meta.ui.csp`/`openai/widgetCSP`, mas **não** documenta explicitamente `data:` — tratar como "provável, validar no host".
   - `blob:` **não** está no default; se algum dia precisar de `URL.createObjectURL`, será preciso testar host a host (e o default não permite).
   - `structuredContent` não deve carregar bytes (ver §2.5); usar o `content[0].data` que já chega no `tool-result`.
   - Sem storage como fonte de verdade: `localStorage` é citado só como estado de UI recuperável no padrão; estado autoritativo fica no servidor.
4. Recomendação Mesa: **não declarar `_meta.ui.csp`** (painel sem rede, menor superfície); montar `data:image/png;base64,` a partir de `content[0].data`; se o PNG exceder o limite prático do host, cair para o layout textual/meta (já existe) e, numa segunda fase, oferecer uma tool app-only de chunk (padrão oficial). Não inventar permissões/esquemas.

---

## 5. `visibility`: app vs model

- Default `["model", "app"]`: a tool aparece para o modelo e pode ser chamada pelo iframe.
- `["app"]`: some de `tools/list` do modelo; só o app chama. Útil para refresh/polling/estado sem poluir a lista de tools do modelo.
- `["model"]`: só o modelo; host deve **rejeitar** `tools/call` do app.
- App cobre apenas o **próprio** servidor (cross-server bloqueado).
- Compat OpenAI: `openai/widgetAccessible` (bool, default false) e `openai/visibility` (`public`/`private`) são legados; a referência manda preferir `_meta.ui.visibility` + `tools/call`.
- Para a Mesa: o render tool `mesa_show` fica no default (modelo pode abrir o painel); ferramentas de refresh podem continuar sendo `mesa_page`/`mesa_capture` (já são `["model","app"]` por default) — se surgir uma tool puramente de UI, marcar `["app"]`.

---

## 6. Sinais de compatibilidade: Codex vs ChatGPT

Evidências oficiais coletadas:

| Fonte | Sinal |
|---|---|
| `plugins/build/chatgpt-ui` | "Components run inside an iframe **in ChatGPT**"; "Keep the MCP tools useful without a component so **ChatGPT and Codex** can complete the workflow **without UI**" |
| Matriz de clientes MCP (`modelcontextprotocol.io/extensions/client-matrix`) | ChatGPT ✓ `io.modelcontextprotocol/ui`; **Codex ausente** |
| `plugins/reference` | `_meta.ui.resourceUri`/`visibility` padrão; aliases ChatGPT (`openai/outputTemplate`, `openai/widgetAccessible`, `openai/visibility`); extras ChatGPT-only (`window.openai`, `openai/ui.availableDisplayModes`, `openai/widgetCSP`) |
| Changelog Codex | "Kept embedded MCP app panels from restarting or losing state during fullscreen changes and thread reloads" (app **26.423/26.429**); "MCP app sizing after **right-pane** transitions" (app **26.609**) |
| PRs do repo `openai/codex` (citados no changelog) | #45805 "Preserve MCP App UI metadata in tool-call events and history"; #48764 "Preserve MCP app resource URIs without defaulting display mode" |
| `plugins/build/chatgpt-ui` (extensões) | `window.openai` é explicitamente "ChatGPT provides"; feature-detect, **nunca** ramificar por nome de host/produto |

Leitura correta:

- **ChatGPT**: host MCP Apps documentado; aceita o padrão e também aliases/extensões OpenAI.
- **Codex**: há painel embutido (sinais de engenharia no changelog: fullscreen, reload de thread, **right-pane**, tamanho), mas **não há contrato de desenvolvedor documentado** nem entrada na matriz de clientes. Não alegar que o painel renderiza no Codex até um teste real; implementar de forma que, se não renderizar, tudo funcione sem UI.
- Sinais de detecção em runtime que o painel pode registrar (sem depender deles): presença de `window.openai` (ChatGPT-only), `hostCapabilities.serverTools`/`openLinks`, `hostContext.availableDisplayModes`, e — para diagnóstico no servidor — `extensions["io.modelcontextprotocol/ui"]` nas client capabilities do `initialize`.

---

## 7. Mínimo funcional experimental para `codex-plugin/mesa-study`

Sem novas dependências (SDK 1.32 já instalado), sem tocar nas tools existentes:

1. **Resource único** `ui://mesa-study/panel.html` registrado com `server.registerResource(...)` (existe no SDK 1.32; contents suportam `_meta`). HTML **auto-contido** (CSS+JS inline, zero rede), `_meta: { ui: { prefersBorder: true } }`, sem `csp`, sem `domain`. HTML pequeno (poucos KB) e válido HTML5.
2. **Tool de render** `mesa_show` com `_meta.ui.resourceUri` apontando para o resource, default `["model","app"]`. O handler reutiliza os handlers existentes (`mesa_page`/`mesa_capture`) e devolve exatamente o shape atual (imagem + texto + `structuredContent`), preservando o comportamento textual/sem-UI. (O padrão "decoupled" — data tool separada de render tool — fica como evolução; o passo único mínimo é este.)
3. **Painel (HTML)**: bridge JSON-RPC cru (a spec dispensa SDK):
   - envia `ui/initialize` e espera resposta; manda `ui/notifications/initialized`;
   - escuta `ui/notifications/tool-input`/`tool-result` (e `host-context-changed` para tema);
   - usa `window.parent.postMessage(..., "*")` com filtro `event.source === window.parent` e `jsonrpc === "2.0"`;
   - exibe `content[0].data` como `data:image/png;base64,…`; mostra meta (arquivo/página/janela) e estados de erro (`isError`);
   - botões: atualizar/outra página → `tools/call` para `mesa_page`/`mesa_capture`; opcional "levar ao chat" → `ui/message`; opcional `ui/update-model-context` com a visualização atual;
   - `ResizeObserver` → `ui/notifications/size-changed`; responder `ui/resource-teardown` com `{}`; feature-detect `hostCapabilities.serverTools` antes de habilitar refresh.
4. **Negociação** (opcional no MVP): helper `clientSupportsUi(clientCapabilities)` lendo `extensions["io.modelcontextprotocol/ui"].mimeTypes`; decisão documentada nos testes. O registro incondicional é seguro porque o fallback sem UI já existe.
5. **Não fazer**: depender de `window.openai`, declarar CSP/domínios, carregar CDN/fontes, guardar credenciais/estado em `localStorage` como fonte de verdade, ou prometer renderização no Codex.

Arquivos sugeridos (para os agentes de implementação, fora do escopo desta pesquisa): `server/panel-resource.mjs` (ou bloco em `server/server.mjs`) + `server/panel.html` (ou string embutida) + `_meta` em `server/tools.mjs` + testes em `tests/mcp-panel.test.mjs`.

---

## 8. Testes de bridge/host recomendados (antes de qualquer alegação)

Todos dependency-free (`node:test`), PDFs/PNGs sintéticos, sem abrir app real:

- **T1 — metadados**: `tools/list` contém `_meta.ui.resourceUri` **só** em `mesa_show`; demais tools inalteradas; `visibility` esperada em cada uma; schema inválido continua recusado.
- **T2 — resource**: `resources/read` devolve `text/html;profile=mcp-app`, texto não vazio, `_meta.ui.prefersBorder`; assertivas negativas: sem `http://`/`https://`, sem `fetch(`, sem `<iframe`, sem `import(`/`require(` no HTML.
- **T3 — negociação**: fixtures de client capabilities com/sem `extensions["io.modelcontextprotocol/ui"]`; a decisão (registrar sempre vs condicional) tem de estar explícita e testada.
- **T4 — mini-host em Node (bridge real, sem navegador)**: par de emissores simulando `postMessage`; rodar o script do HTML em `node:vm` com `window`/`document` mínimos; host shim implementa `ui/initialize`, encaminha `tools/call` a um servidor MCP real via transporte in-memory e devolve `ui/notifications/tool-result`; assertar: sequência initialize→initialized→tool-input→tool-result, shape `{jsonrpc,id,method:"tools/call",params:{name,arguments}}`, e que o painel monta `data:image/png;base64,`. Rótulo honesto: **simulador de host**, não iframe real.
- **T5 — PNG e limites**: PNG sintético 1×1 → data URL correta; resultado `IMAGE_TOO_LARGE`/erro → painel mostra erro sem quebrar e sem imagem antiga; caminho de chunk (se implementado) recompõe bytes byte a byte.
- **T6 — ciclo de vida**: `ui/resource-teardown` respondido; `size-changed` emitido em resize (stub de ResizeObserver); nenhuma chamada antes de `connect` completar.
- **T7 — host real (pendente, só com o usuário no comando)**: no Codex app, registrar: painel renderiza? lado direito? `window.openai` existe? capabilities `io.modelcontextprotocol/ui` presentes? `data:` PNG aparece? modos de display? Se não renderizar, confirmar fallback textual/imagem. Sem isso, o doc/README deve dizer **experimental não testado no Codex**.

---

## 9. Lacunas e riscos

1. Bridge MCP Apps no Codex: sem contrato de dev documentado; garantias exatas são experimentais até teste real.
2. `data:` para PNG em hosts reais não é citado nas docs ChatGPT; validar. Alternativas futuras: chunking app-only (padrão oficial) ou resource próprio servido à UI.
3. Limites de tamanho de resultado/`iframe`/memória do host são desconhecidos para o Codex; o teto da Mesa (8 MiB) pode precisar cair.
4. `structuredContent` tem semântica divergente entre spec MCP Apps e referência OpenAI (modelo vê ou não); evitar bytes nele.
5. Submissão pública ChatGPT exigiria `_meta.ui.domain`, iframe policy etc. — fora do escopo experimental local.
6. Nenhum teste real no app; nenhum código alterado. Se o host/UI testar e o Codex ignorar o `_meta`, a correção é só readback textual — sem regressão, desde que o fallback seja mantido.

---

## 10. Fontes

- OpenAI — Add UI to your MCP server: <https://developers.openai.com/plugins/build/chatgpt-ui>
- OpenAI — Plugins reference (`window.openai`, `_meta.ui.*`, CSP, aliases): <https://developers.openai.com/plugins/reference>
- OpenAI — Codex changelog: <https://developers.openai.com/codex/changelog>
- MCP — MCP Apps (overview): <https://modelcontextprotocol.io/docs/extensions/apps>
- MCP — Build an MCP App: <https://modelcontextprotocol.io/extensions/apps/build>
- MCP — Extension Support Matrix (ChatGPT ✓ / Codex ausente): <https://modelcontextprotocol.io/extensions/client-matrix>
- MCP Apps — spec estável 2026-01-26 (SEP-1865): <https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx>
- MCP Apps — README/SDK: <https://github.com/modelcontextprotocol/ext-apps>
- MCP Apps — `App` class (TypeDoc v1.1.2): <https://apps.extensions.modelcontextprotocol.io/api/classes/app.App.html>
- MCP Apps — Patterns (app-only tools, chunking, CSP/CORS, teardown): <https://apps.extensions.modelcontextprotocol.io/api/documents/Patterns.html>
- MCP Apps — fonte `src/app.ts` (assinaturas `connect/callServerTool/sendMessage/updateModelContext`): <https://github.com/modelcontextprotocol/ext-apps/blob/main/src/app.ts>
- MCP Apps — schema (`McpUiMessageRequest` = `content` array): <https://github.com/modelcontextprotocol/ext-apps/blob/main/src/generated/schema.ts>
- Local (read-only): `codex-plugin/mesa-study/server/CONTRACT.md`, `server/server.mjs`, `node_modules/@modelcontextprotocol/sdk@1.32.0` (`types.d.ts`, `server/mcp.d.ts`).

Status: pesquisa documental + leitura do SDK instalado. **Não** é validação de app; painel no Codex, `data:` PNG e bridge no host real continuam **pendentes de teste**.
