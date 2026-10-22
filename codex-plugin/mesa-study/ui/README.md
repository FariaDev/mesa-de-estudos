# `ui/` — painel MCP Apps da Mesa (experimental)

`desk.html` é o recurso MCP Apps do plugin: HTML único, self-contained, sem
dependências, sem rede em runtime e sem caminhos de arquivo como URL. `desk-html.mjs`
é um carregador Node auxiliar usado nos testes; o servidor usa `server/ui.mjs`
para ler e validar o HTML na chamada `resources/read`.

```text
ui/
├── desk.html       # recurso ui://mesa-study/desk-v1.html (text/html;profile=mcp-app)
└── desk-html.mjs   # DESK_URI, DESK_MIME, buildDeskHtml() auxiliar de teste
```

## Contrato consumido pelo painel

O painel foi escrito contra o contrato já documentado em `README.md`/`SKILL.md`:

| Ferramenta | Uso no painel | Forma consumida |
|---|---|---|
| `mesa_open` | resultado inicial (`ui/notifications/tool-result`) | `structuredContent` `{ok,kind:'desk',status,library,page}`, com `status` no formato do `mesa_status` e `page` no formato do `mesa_page` (ou `null`); bloco `image/png` em `content` quando veio `filePath` |
| `mesa_library` | fallback de biblioteca quando `mesa_open` não trouxe `library` (uma vez, sem leitura automática de PDF) | `{ok,kind:'library',files:[{filePath,name}],truncated}` |
| `mesa_page` | navegação (select/botões/zoom) e re-render | `{ok,kind:'page',source:{document:{name,path},page,numPages},image:{bytes,…}}` + bloco `image/png` |
| `mesa_windows` | só depois do clique em **Conferir Xournal++** | `{ok,kind:'windows',windows:[{id,app,title}]}` |
| `mesa_capture` | só no botão **Capturar**, com a janela escolhida | `{ok,kind:'capture',source:{window,capturedAt},image:{bytes,…}}` + bloco `image/png` |

Ponte MCP Apps (manual, JSON-RPC sobre `postMessage`): `ui/initialize` →
`ui/notifications/initialized`; recebe `ui/notifications/tool-input`,
`ui/notifications/tool-input-partial`, `ui/notifications/tool-result`,
`ui/notifications/tool-cancelled`, `ui/notifications/host-context-changed` e a
requisição `ui/resource-teardown`; envia `tools/call`, `ui/message` (com
`content: ContentBlock[]`, alinhado ao SDK `@modelcontextprotocol/ext-apps`
2026-01-26), `ui/update-model-context` (somente referências, nunca imagem),
`ui/request-display-mode` (feature detect por
`hostContext.availableDisplayModes`) e `ui/notifications/size-changed`
(medida por `ResizeObserver` quando existe; o primeiro aviso só sai depois do
handshake — `ui/initialize` respondido e `initialized` enviado — com as
dimensões atuais do layout; a mesma medida não repete; aviso inicial mesmo sem
observer; teto de 20000px; para no teardown). Toda mensagem só é aceita com
`event.source === window.parent`; cada pedido tem timeout limitado (30 s; 15 s
no handshake) e a fila pendente é limitada a 64.

## Aparência (identidade Mesa)

O painel aproxima a identidade visual do app Mesa (`desk/style.css`) só com
CSS/HTML locais — sem fontes, imagens ou CDN (a marca “M” roxa é CSS) e sem
novos controles: os mesmos IDs e chamadas continuam valendo.

- **Cabeçalho** com a marca **Mesa de Estudos** e o botão de tela cheia (só
  quando o host declara `fullscreen`), nas superfícies brancas/quase brancas,
  borda `#e6e6e8` e roxo `#6d28d9` (escuro: `#7c3aed`) do app.
- **Cartão de leitura** no lugar do antigo formulário: título **Enunciado**
  com o seletor de PDF na mesma linha, barra de ferramentas compacta
  (anterior/próxima com ícone, `aria-label` e `title`; campo de página,
  total, `Ir`, − / valor do zoom / + e **Ajustar**, com `aria-pressed` no
  ajuste) e o documento sobre o cinza claro. A legenda fica num rodapé **no
  fluxo** do cartão (sem gradiente sobre o papel). Indica o documento como
  **Último PDF** quando não há prévia ativa. A última referência
  continua no seletor para uma nova tentativa explícita; se a biblioteca estiver
  vazia, uma nota explica essa situação. Uma nova página válida remove o prefixo.
  O rodapé também mostra o estado de carregamento da operação certa (`Carregando página N…` ou
  `Capturando a janela…`, com `aria-busy` no viewport): a prévia provada
  continua visível até o sucesso. No zoom, o rótulo só mostra número quando
  existe zoom explícito; em modo de ajuste mostra **Ajustada**.
- **Tutoria** (composer) com o título da seção, o resumo do contexto ativo
  (página do PDF ou janela capturada — limpo quando não há prévia válida), a
  caixa de texto bordada (`Pergunte ou peça uma dica…`), as ações
  **Conferir Xournal++** (secundário) e **Pedir ajuda** (roxo, `ui/message`),
  e o aviso visível de envio pendente (`Enviando o pedido ao tutor…`); o
  rodapé do cartão lembra que a resposta aparece na conversa do Codex. A nota
  de status global fica quieta no caso normal.
- **Layout responsivo**: abaixo de 720px o leitor ocupa a largura toda e o
  composer fica logo abaixo, no fluxo normal da rolagem, sem cobrir o PDF
  mesmo com o campo expandido ou o painel de janelas aberto; a partir de 720px o leitor e os controles de estudo ficam lado a
  lado; não há mais o teto de 880px de largura que sobrava margem no painel.
  Quando o host declara `fullscreen` **e** está nesse modo
  (`data-display="fullscreen"`), o palco ganha altura extra, ainda limitada
  (`clamp`); sem a capacidade declarada, nada muda.
- **Teclado**: `Enter` no campo de página vai; `←`/`→` mudam de página só
  fora de campos editáveis, sem modificadores, sem IME em composição e com a
  página visível; `Enter` no composer pede ajuda (um pedido por vez, anotação
  preservada em falha/recusa, sem retry automático) e `Shift+Enter` quebra
  linha. Enter no composer é uma ação explícita de envio. Navegação nunca
  pede ajuda nem captura; não há atalho de captura. O painel nunca chama
  `focus()` — o campo do usuário fica onde está.

## Feature detect do host (schema MCP Apps 2026-01-26)

Os gates do painel seguem o contrato executável do repo oficial
`modelcontextprotocol/ext-apps` (revisão de spec **2026-01-26**), nos arquivos
`src/spec.types.ts` (`McpUiHostCapabilities`) e `src/generated/schema.ts`
(`McpUiHostCapabilitiesSchema`):

| Campo opcional de `hostCapabilities` | Uso no painel |
|---|---|
| `serverTools` | habilita `tools/call` (navegação, biblioteca, janelas, captura) |
| `message.text` | habilita **Pedir ajuda** (`ui/message`, content de texto) |
| `updateModelContext.structuredContent` | habilita `ui/update-model-context` (só referências, nunca imagem) |

Cada modalidade é opcional no schema: chave ausente = não declarada, e o
painel **não tenta** (gate mantido). Sem `hostCapabilities`
(host fora do padrão), ferramentas ficam desativadas; mensagens e atualização
de contexto tentam o pedido e mostram a recusa real da ponte como erro honesto.
A API `App.sendMessage`/`App.updateModelContext` só
verifica o handshake — o feature detect é responsabilidade do View.
A prosa da spec (`specification/2026-01-26/apps.mdx`, seção *Host
Capabilities*) lista só um subconjunto antigo (sem `message`/
`updateModelContext`); o contrato que o SDK usa é o tipos+schema acima
(ver evidência e hashes em
`docs/reviews/mesa-codex-ui-capabilities-20261006.md`).

**No app real (pendente):** o teste manual deve registrar o JSON cru de
`hostCapabilities` da resposta de `ui/initialize` — é ele que decide se o
painel habilita ajuda/contexto no Codex. Depois do handshake o painel registra
esse JSON uma única vez no console do host
(`[mesa] hostCapabilities {…}`), sem enviar nada à conversa nem à rede; se o
console do iframe não estiver acessível no app, capture pelas mensagens da
ponte do host. Sem esse registro, a compatibilidade do Codex continua **não
validada**, sem garantia.

Toda troca de estado do painel passa por um **commit** com época global:
página, captura e “mesa sem página” incrementam o mesmo token e zeram o busy,
de modo que resposta antiga de `mesa_page`/`mesa_capture` (incluindo a que
chega depois de um `ui/notifications/tool-result` novo) não sobrescreve o
estado atual. Falha de prévia limpa a imagem, libera o busy e desliga a ajuda
em qualquer caminho (inclusive `mesa_open` com PNG divergente do metadado).

Acessibilidade: imagem de prévia com `aria-label`, erro com `role="alert"`,
status/avisos com `role="status"`/`aria-live` (inclusive o carregamento do
leitor e o envio pendente do pedido), `aria-busy` no viewport, resumo do
contexto ligado ao botão por `aria-describedby`, ícones de navegação/zoom com
`aria-label` e `title`, e `<label for>` em cada controle de formulário. As
seções usam título (`Tutoria`) como nome acessível.

O que o painel **não** faz: captura automática, varredura de pastas, leitura de
PDF sem escolha explícita, anexar a imagem da página no `ui/message`/contexto,
rede, `innerHTML` com dado de ferramenta (tudo entra por `textContent`) e
calculo/ink. `Pedir ajuda` manda texto pedindo que o tutor chame
`mesa_page`/`mesa_capture`; navegar páginas não envia um pedido `ui/message`.
O destino dos resultados de imagem MCP depende do hospedeiro: não há garantia
de que a prévia fique exclusivamente local ou fora do contexto do modelo.

## Registro no servidor

```js
import {readDeskHtml, DESK_RESOURCE_URI as DESK_URI, DESK_RESOURCE_MIME as DESK_MIME} from './ui.mjs';

server.registerResource('mesa-desk', DESK_URI, {}, async () => ({
  contents: [{
    uri: DESK_URI,
    mimeType: DESK_MIME,
    text: await readDeskHtml(),
    _meta: {ui: {prefersBorder: true, csp: {connectDomains: [], resourceDomains: []}}},
  }],
}));

// mesa_open: _meta do registerTool
_meta: {
  ui: {resourceUri: DESK_URI},
  'openai/outputTemplate': DESK_URI,
},

// os demais data tools (mesa_page, mesa_library, mesa_windows, mesa_capture,
// mesa_status, mesa_context) NÃO declaram template — só mesa_open é render tool.
// Não declare visibility: ['app']: o padrão ['model','app'] mantém as
// ferramentas chamáveis pelo painel e visíveis ao modelo.
```

A URI é a chave de cache do recurso: mudança quebrantável no HTML pede `desk-v2.html`
e atualização do `mesa_open`.

## Verificação

`tests/ui-client.test.mjs` executa o script inline em `node:vm` com um DOM mínimo
e uma ponte hospedeira **simulada** (sem Codex, sem rede, sem Xournal++ real).
Isso cobre handshake, render, navegação, corridas/teardown/timeout, época de
commit, validação de PNG, tamanho (`size-changed`, inclusive a ordem em
relação ao handshake), teclado/foco (Enter/setas/IME sem navegação implícita)
e segurança de texto; **não**
prova a exibição do painel dentro do Codex — essa validação continua manual (ver
`README.md` e `tests/manual-study.md`).

Provas de navegador (evidência de bancada, não do Codex): o recurso final foi
carregado num iframe real com um host-simulado (mesmas mensagens MCP Apps) para
medir o zoom e ver o `data:image/png`. A 125% no viewport estreito
(`clientWidth` 839, imagem 1053px), a imagem fica com `offsetLeft` 11px e
`scrollWidth` cobre a borda direita: as duas bordas são alcançáveis (o caminho
antigo com `justify-content:center` cortava ~93px à esquerda). Isso é medição
no Chromium do harness, não validação do painel dentro do Codex.

### Composer em painel estreito

Na revisão de UI/UX, o composer sticky cobria 134px de um leitor de 200px
em 360×420. Um corte por altura corrigiu esse caso, mas ainda permitia
sobreposição com textarea expandida em 360×650. A decisão final deixa o
composer no fluxo normal em toda largura abaixo de 720px. PDF e controles
continuam acessíveis por rolagem, sem uma área cobrir a outra.

As medições são de um hospedeiro MCP Apps simulado no navegador T3,
com ferramentas locais e PDF sintético reais; não provam exibição no Codex.
