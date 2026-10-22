# Pesquisa de API — Mesa de Estudos como mod do Claude Code (aba Code do Claude Desktop)

- **Data:** 2026-10-05
- **Autor:** sub-agente de pesquisa (OpenCode / DeepSeek V4.1 Flash), a pedido do agente raiz
- **Objetivo:** contrato de API implementável para um protótipo de **Mesa de Estudos como mod** do Claude Code na aba Code do Claude Desktop; foco em leitura de PDF, navegação e captura Xournal++.
- **Regras seguidas:** sem conta real, sem login, sem instalar/atualizar Claude ou Desktop, sem tocar no app aberto, sem commit/push, sem ler credenciais/sessões/runtimes/PDFs de curso/bundle instalado da Mesa. Nada foi implementado.
- **Fontes públicas baixadas para consulta do root:** `/tmp/mesa-mod-api-research-20261005/` (ver Anexo B).

---

## 1. Veredito rápido

| Pergunta | Veredito | Evidência |
|---|---|---|
| `/mesa` como comando que abre um painel e roda função sem turno do modelo? | **Sim** | docs [`api#add-a-command`](https://code.claude.com/docs/en/plugins/mods/api#add-a-command), `CommandSpec` (`claude-code.d.ts:1565`), `command.run` (`:3472`) |
| Pane com abas, botões, Input/Select no Desktop? | **Sim** | [`interface#build-a-pane-with-tabs`](https://code.claude.com/docs/en/plugins/mods/interface#build-a-pane-with-tabs), `Elementos` por superfície (`claude-code.d.ts:3105`), `InputProps`/`SelectProps`/`ButtonProps` |
| Render **fiel** de página PDF no pane, sem webview? | **Não** | Sem `Image`/`Raster`/DOM no Desktop; único folha vetorial é `Svg` com teto de 131.072 chars; página sintética de 55 linhas = 315.581 chars (2,4× o teto). §4.1 |
| Render **parcial** de PDF (recorte/zoom) via `Svg`? | **Parcialmente / não recomendado** | Recorte de 1/4 de página = 136.380 chars (ainda > teto); 1/6 = 99.024 chars (cabe). Navegação vira janela de recortes. §4.1 e §5.1 |
| Enviar imagem via `prompt.submit` (bytes/attachment)? | **Não** | `PromptSubmitAttachment` = "its kind, never its bytes" (`claude-code.d.ts:7166-7185`); `PromptSubmitArgs` não tem `context` nem bytes (`:7163`) |
| Caminho alternativo para o modelo "ver" imagem? | **Sim, indireto** | Salvar PNG no disco e submeter prompt pedindo `Read <path>` (a imagem entra como resultado de ferramenta); ou o usuário anexar manualmente. §5.2 |
| `$.store`, `$.fs`, `$.process`, `$.clock`, `$.session`? | **Sim** (com ressalvas de versão e de permissão macOS) | `claude-code.d.ts:2738-3030`; §3.3 |
| Testes nativos de mod sem login? | **Sim por projeto** (`claude plugin test`), **não nesta máquina** | docs [`test`](https://code.claude.com/docs/en/plugins/mods/test); CLI local 2.1.246 não tem o subcomando. §4.7 |
| CLI local 2.1.246 serve para o protótipo? | **Não** | Validador da 2.1.246 rejeita `session.start`: `"session.start" is not an event`. §4.7 |
| Piso de versão | **Terminal ≥2.1.287; Claude Code embutido no Desktop ≥2.1.286** | docs [`overview#turn-mods-on-or-off`](https://code.claude.com/docs/en/plugins/mods/overview#turn-mods-on-or-off) |

**Conclusão de escopo (detalhada na §6):** o mod é viável para comando `/mesa`, pane com abas/controles, notas e estado (`$.store`), navegação lógica, cálculo local e captura Xournal++ orquestrada; **não** é viável prometer página PDF fiel dentro do pane do Desktop. O caminho honesto é manter a renderização fiel onde ela já funciona (Mesa Electron/Xournal++) e usar o mod para orquestração, texto e contexto — ou aceitar leitura textual/recortada no pane.

---

## 2. Fontes verificadas

| Fonte | Versão/estado | Uso |
|---|---|---|
| [docs mods/overview](https://code.claude.com/docs/en/plugins/mods/overview) | página atual em 2026-10-05 | onde roda, versões mínimas, trust |
| [docs mods/reference](https://code.claude.com/docs/en/plugins/mods/reference) | "as of v2.1.289" (texto da página) | eventos, métodos, elementos, limites |
| [docs mods/interface](https://code.claude.com/docs/en/plugins/mods/interface) | atual | pane, árvore, controles, estado |
| [docs mods/api](https://code.claude.com/docs/en/plugins/mods/api) | atual | comandos, prompt, fs/process/http |
| [docs mods/create](https://code.claude.com/docs/en/plugins/mods/create) | atual | arquivos do mod, validação, tipos gerados |
| [docs mods/test](https://code.claude.com/docs/en/plugins/mods/test) | atual | `claude plugin test`, kit `claude-code/testing` |
| [docs mods/troubleshoot](https://code.claude.com/docs/en/plugins/mods/troubleshoot) | atual | como saber se mods carregam, log de debug |
| [docs plugins/install](https://code.claude.com/docs/en/plugins/install) | atual | instalar plugin no **Desktop**: **+ > Plugins > Add plugin** |
| [github anthropics/claude-code /mods](https://github.com/anthropics/claude-code/tree/main/mods) | clone `main` = `e8ae4518` | fonte oficial: `diff`, `agents-md`, `telemetry`, `sec-default`, `types/` |
| [mods/types/claude-code.d.ts](https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts) | **"Written by Claude Code 2.1.277"** (1ª linha); sha256 `8ae1244d…b0b46c`; 13.186 linhas | contrato de tipos completo (referência principal desta pesquisa) |
| [claude-code-playground /mods](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) | clone `main` = `569c5283` | 3 exemplos oficiais: `token-weather`, `blast-radius`, `replay-theater` |
| CLI local `~/.local/bin/claude` | **2.1.246** (verificado); sem `CLAUDE_*`/`ANTHROPIC_*` no ambiente; nenhum login executado | prova de incompatibilidade |
| `/Applications/Claude.app` `Info.plist` | app **2.19675.1** (leitura somente; **não** é a versão do Claude Code embutido) | contexto; a versão embutida só aparece em `/status` |

> **Nota de deriva:** os tipos públicos são de **2.1.277**, a referência de docs é **2.1.289** e o piso é **2.1.287/2.1.286**. Onde as duas divergem (ex.: `$.state`, `asUser`, retorno de `$.ui.open`, `$.process.spawn`), trate a página como "mais nova" e **confirme nos tipos gerados pela build alvo** (`.claude-plugin/types/claude-code/index.d.ts`, escritos quando o mod carrega com `--plugin-dir` — docs [`create#get-the-types-for-your-build`](https://code.claude.com/docs/en/plugins/mods/create#get-the-types-for-your-build)).

---

## 3. Contrato exato da API

### 3.1 Arquivos de um mod

```
mesa-de-estudos/
├── .claude-plugin/plugin.json     # manifesto (obrigatório)
├── hooks/hooks.json               # { "modules": ["./register.ts"] } (obrigatório)
├── hooks/register.ts              # exporta register(on, options); ESM; .ts/.tsx/... aceitos
└── types/index.d.ts               # só se usar $.state / declarar EngineInterface
```

- `register(on, options)`: `export type Register = (on: On, options: PluginOptions) => unknown` (`claude-code.d.ts:7420`). `options` são os campos `userConfig` do manifesto com defaults; mudou, recarrega o plugin.
- O módulo é ESM (sem `require`), importa arquivos do próprio plugin por path relativo; a única importação "bare" permitida é `claude-code` (tipos + helpers `h`/`Fragment` + `atom/read/update` quando existirem). Sem `import()` dinâmico. Regras de análise estática: docs [`create#check-what-claude-code-reads-from-your-mod`](https://code.claude.com/docs/en/plugins/mods/create#check-what-claude-code-reads-from-your-mod).
- Se o arquivo for `.tsx`/`.jsx`, o engine injeta `@jsx h` clássico; **não** declare/importe `h` nem `Fragment`.
- Ambiente de hooks: **sem DOM, sem Node, sem `setTimeout`**, sem `eval`/`new Function`/`WebAssembly` (`claude-code.d.ts:11315-11325`). Disponível: `URL`, `TextEncoder`, `AbortController`, `crypto.subtle`, `Uint8Array` (com `toBase64`/`fromBase64`). Precisou de código compilado/WASM → rode em processo separado via `$.process.run`.

### 3.2 `on` e o ciclo do hook

```ts
on(pattern)                                   // pattern = nome, glob, negação
on(pattern, hook)
on(pattern, matcher, hook)                    // ex.: on('tool.call', { tool: 'Bash' }, hook)
// hook = async ($, e, next) => ...
// retorno: next(e) | next({...e, campo}) | { deny: reason } | { result } | { text } | {} ...
// next.signal: AbortSignal do dispatch; next.budget: { ms, remainingMs }; next.origin: { plugin, tier }
// registro: .catch(handler) — uma vez só; handler de 1 s
```

(`On` em `claude-code.d.ts:5446`; `Registration` e budget em `:7433+`.)

Eventos que interessam à Mesa (nomes exatos):

| Evento | Quando | Retorno útil |
|---|---|---|
| `session.start` | 1× por mod carregado, antes do 1º prompt; de novo a cada reload | `next(e)`; registre comando/tool aqui |
| `command.run` (matcher `{ command: 'mesa' }`) | `/mesa ...` executado | `{ text }` (vai ao transcript e o modelo lê), `{ context }`, ou `{}` (silencioso) |
| `ui.render` (matcher `{ component: 'Pane' }` ou `'AbovePrompt'`) | antes de desenhar o site | árvore de elementos, ou `next(e)` |
| `ui.press` / `ui.input` / `ui.select` | uso de Button/Input/Select desenhado | observa/reescreve o valor antes do callback do dono |
| `ui.close` | pane vai fechar (`e.origin.kind` = `plugin`/`person`/`unload`) | sem `next` mantém aberto |
| `ui.message` | `Client` fez `surface.post(data)` | `{ props }` entrega props à instância |
| `prompt.submit` | prompt entrou (digitado ou de plugin) | `next({...e, text})`, `next({...e, context})` ou `{ drop: reason }` |
| `turn.start` / `turn.complete` | início/fim de turno | guardar `turnId`; `{ text }` mostra linha sob a resposta |
| `tool.call` / `tool.check` | antes de executar / decisão de permissão | `{ deny }`, `{ result }`, `{ decision }` |
| `classic.SessionStart` (filtro `source: 'clear'|'resume'|'fork'`) | depois de `/clear` etc., que resetam `$.state` | recarregar estado do store |

### 3.3 Namespaces do `$` (assinaturas verificadas)

```ts
// Comandos — claude-code.d.ts:2600-2645, :1565
$.command.register({ name, description, argumentHint?, immediate?: true }) => Promise<{ command }>
$.command.run({ command, args? }) => Promise<CommandRunResult>   // { text?, context?, ref? }
$.command.list() => Promise<CommandInfo[]>

// UI — claude-code.d.ts:2160-2340, :5977
$.ui.open({ id, title?, focus?: true, closeOnEscape?: true, holdToasts?: true, rows?, columns? })
$.ui.close({ id })
$.ui.panes() => Promise<readonly UiPane[]>   // { id, title, isShown, isFocused, isPlaced }
$.ui.resolve(e) => tabela de elementos da superfície de e
$.ui.invalidate('ui.render')                  // redesenha (10/s; 30/s no pane visível)
$.ui.toast(text, { timeoutMs? })              // 4 s default
$.ui.status(text | undefined)                 // linha fixa sob o prompt
$.ui.log(text, { to?: 'transcript' | 'debug' })
$.ui.ask(question, options?) => Promise<string>   // dialog AskUserQuestion; rejeita em -p
$.ui.notice(tool_use_id, text | undefined)
$.ui.blit({ requestId, key, cells } | { requestId, key, source, columns?, rows? })

// Prompt — claude-code.d.ts:2474-2530, :7157-7280
$.prompt.submit({ text, attachments?, asUser?: true }) => Promise<PromptSubmitResult>
   // PromptSubmitArgs omite origin/turnId/wait/context; attachments = METADADOS (ver §4.2)
   // resultado: { text, context?, origin? } ou { drop: reason }
$.prompt.read() => Promise<{ text, cursor }>
$.prompt.fill({ text, mode?: 'replace'|'append'|'insert' })
$.turn.abort({ turnId }) => Promise<void>     // cancela o turno em andamento

// Store — claude-code.d.ts:2855-2885
$.store.get(key) => Promise<unknown>
$.store.set(key, value)      // JSON; rejeita função/ciclo/store >4 MiB no total
$.store.delete(key); $.store.keys() => Promise<string[]>

// FS — claude-code.d.ts:2738-2855, :4081
$.fs.read(path) => Promise<string>                        // UTF-8
$.fs.read(path, { as: 'bytes' }) => Promise<{ base64 }>   // rejeita arquivo > 4 MiB
$.fs.write(path, text)                                    // SÓ texto; cria diretórios; não atômico
$.fs.list(path?) => Promise<FsEntry[]>                    // { name, kind, size, isLink }
$.fs.exists(path); $.fs.stat(path, {resolve?}); $.fs.ancestors(...)

// Processo — claude-code.d.ts:2955-2990  (comentário do tipo: "CLI only")
$.process.run(argv, { cwd?, env?, stdin?, timeoutMs? }) => Promise<{ exitCode, stdout, stderr }>
   // sem shell; timeout default 30 s, máx. 10 min; rejeita se não iniciar/estourar

// Sessão / config — claude-code.d.ts:2345-2470, :2985-3025
$.session.cwd(); $.session.root(); $.session.id(); $.session.model(); $.session.turns()
$.session.surfaces() => Promise<readonly RenderSurface[]>  // 'terminal'|'desktop'|'mobile'|'vscode'
$.session.messages() => Promise<SessionMessage[]>          // mais novos 4096
$.session.usage(args?) => Promise<SessionUsage>            // context tokens/window/percent, rateLimits, cost
$.session.authorize()                                      // handle opaco de credencial; não usar
$.settings.read({ source? }); $.env.get(nameLiteral); $.env.set(nameLiteral, value)
$.clock.now(); $.clock.sleep(ms, { signal? }); $.clock.after(ms, fn); $.clock.every(ms, fn) => Timer{cancel}
$.http.fetch(url, { method?, headers?, body?, auth?, socketPath? })
$.model.complete({ model?, system?, prompt, maxTokens?, timeoutMs? })  // default 1024 tokens (máx. 64k)
$.plugin.name; $.plugin.root
```

`$.ui.open` é pedido, não garantia: foco só quando o compositor está vazio; pane aberto "sem o usuário pedir" só é colocado ≥144 colunas (110 depois da primeira vez); o resultado de `$.ui.panes()` (campo `isPlaced`) é a fonte confiável. Os docs 2.1.289 dizem que `$.ui.open` resolve `{ isPlaced }`, mas os tipos 2.1.277 declaram `Promise<void>` — **deriva de versão, confirmar na build**.

### 3.4 Elementos e superfícies

Tabela por superfície (`claude-code.d.ts:3105-3168`; docs [`reference#elements`](https://code.claude.com/docs/en/plugins/mods/reference#elements)):

| Elemento | Terminal | Desktop | Observações |
|---|:-:|:-:|---|
| `Box`, `Text`, `Button`, `Link`, `Code`, `Markdown` | ✓ | ✓ | layout flex; `Text.wrap`; `Markdown` até 10.000 chars |
| `Input`, `Select` | ✓ | ✓ | **não existem em `mobile`** |
| `Svg` | — | ✓ | `source` ≤ **131.072 chars**, `alt` obrigatório, `width`/`height` em px CSS, `isInteractive?: true` (frame sandbox **sem scripts**) |
| `Client` | ✓ | ✓ | módulo de superfície separado; desenha com `ClientElements` e recebe pointer/keys |
| `Image`, `Raster` | ✓ | — | **não há no Desktop** (Image: PNG/RGBA ≤2 MiB ou arquivo; Raster: grade de células) |

Assinaturas de controle verificadas:

```ts
Button: { key?, label?, hotkey? ('1'..'9'|'a'..'z'), action?, plain?: true,
          dimColor?, autoFocus?: true, hover?, onPress: () => void }
Input:  { key, label?, placeholder?, value?, submitLabel?, autoFocus?: true,
          onInput?: (value, e: UiInputArgument) => void,
          onSubmit: (value, e: UiInputArgument) => void }   // Enter; NÃO inicia turno
Select: { key, label?, options: readonly {value,label}[], value?, autoFocus?: true,
          onSelect: (value, e: UiSelectArgument) => void }
```

Os docs dizem que `onPress` recebe `e.surface` e que `Select` é dropdown em Desktop/terminal; os tipos 2.1.277 mostram `onPress: () => void`. Deriva menor; confirme nos tipos gerados.

`Client` (animação/pointer) — contrato (`claude-code.d.ts:1109-1310`): `module` é caminho literal do arquivo (`./view.tsx`), o módulo exporta `(props, surface) => RenderElement`, recebe `surface.elements` (tabela `ClientElements` = terminal **menos** `Client`/`Raster`/`Image` → **sem `Svg`**), `surface.state/setState`, `columns/rows`, `every(ms, fn)`, `onPointer`, `onKey`, `post(data)` → vira `ui.message`; um hook pode responder `{ props }`. Não há DOM, canvas nem rede nessa instância. **Conclusão: `Client` não serve para desenhar PDF.**

### 3.5 Limites numéricos (docs reference + tipos)

| Limite | Valor |
|---|---|
| Tempo de um hook por evento | 10 s (50 ms para `prompt.edit`); `.catch` 1 s |
| `$.process.run` | 30 s default, 10 min máx. |
| `$.fs.read`/`write` | 4 MiB por arquivo |
| `$.store` | 4 MiB de JSON no total |
| `Text` (um filho string) | 10.000 chars |
| `Svg` | 131.072 chars |
| Árvore de `Client` | 20.000 nós, 32 de profundidade, 100.000 chars serializados |
| `$.ui.invalidate('ui.render')` | 10/s (30/s no pane/banda visível), coalescido |
| `$.session.messages()` | 4096 mais novos |
| Contexto de prompt | 100.000 chars por bloco, 200.000 juntos (depois disso, o modelo lê "cabeça e caminho") |
| Nomes de comando/tool/pane | `[A-Za-z0-9_-]`, 1–64 |
| Pane não solicitado | só coloca ≥144 colunas (110 se o usuário já abriu aquele id) |
| `$.model.complete` | `maxTokens` default 1024, máx. 64.000 |
| Teste (`claude plugin test`) | 5 s por teste, salvo `timeoutMs` |

---

## 4. Respostas prioritárias

### 4.1 Render fiel de PDF sem webview? **Não.**

Cadeia de evidências:

1. **Ambiente dos hooks e módulos:** "no DOM, no Node" (`claude-code.d.ts:17-24`, `:11315-11325`); sem `eval`/WASM; um módulo que precise de código compilado vai para processo externo via `$.process.run`.
2. **Elementos no Desktop:** só `Box/Text/Button/Input/Select/Svg/Link/Code/Markdown/Client`. `Image` e `Raster` são **terminal-only** (`claude-code.d.ts:3105-3168`); docs reference marcam `Image`/`Raster` como terminal.
3. **`Client` não desenha gráfico:** a tabela que o módulo recebe é `ClientElements = Omit<Elements['terminal'], 'Client'|'Raster'|'Image'>` (`:1109`) — nem `Svg` entra (o `Svg` só existe na tabela `desktop`). É um subconjunto de texto/controles, para pointer/animação.
4. **`Svg` é a única folha gráfica do Desktop**, com teto de **131.072 chars** e render isolado ("as an image, or in a sandboxed frame when `isInteractive`", `:9594-9632`) — **sem scripts**. PDF.js/WASM no frame está fora de questão.
5. **Prova empírica (sintética, sem material de curso)** — PDF de 1 página com 55 linhas de texto matemático gerado em `/tmp/mesa-mod-api-research-20261005/pdf-probe/page.pdf` (21 KB), convertido com poppler `pdftocairo` (Homebrew, disponível nesta máquina):
   - Página inteira em SVG: **315.581 chars** (131.072 × 2,41).
   - 1/4 de página em SVG: **136.380 chars** (ainda acima do teto).
   - 1/6 de página: **99.024 chars** (cabe); 1/9: **81.925 chars** (cabe).
   - Alternativa raster embutida (não suportada no Desktop de qualquer modo): PNG 150 dpi = 399.175 B → base64 ≈ 532 mil chars; JPEG q60 = 301.641 B → ≈ 402 mil chars; preview `qlmanage` 1024 px = 271.656 B → ≈ 362 mil chars. **Todos muito acima do teto.**
6. **PDF grande nem é legível pelo mod:** `$.fs.read` rejeita >4 MiB (`:2738`). O renderizador precisa ler o arquivo por conta própria (processo externo).

**Resumo honesto:** no Desktop, sem webview, não há caminho para uma página PDF fiel. O máximo é: (a) **texto extraído** (`pdftotext`) exibido em `Code`/`Text`; (b) **recorte vetorial** de ~1/6 de página por `Svg`, com navegação por recortes (zoom maior encolhe ainda mais o recorte — estimativa, não medida: escala linear 2× multiplica os dados de path por ~4×); (c) manter a página fiel no app Electron da Mesa / Xournal++ e usar o mod para orquestração.

### 4.2 `prompt.submit`: imagens, attachments e cancelamento

- `$.prompt.submit({ text })` aceita `attachments?`, mas o tipo é explícito: `PromptSubmitAttachment = { type: 'image'|'audio'|'document'; mediaType?; filename? }`, documentado como **"A pasted or attached non-text item of a submitted prompt; its kind, never its bytes"** (`claude-code.d.ts:7166-7185`). **Não há campo de bytes/base64/caminho.** Portanto: **não é suportado enviar a imagem ao modelo por `prompt.submit`.** Não invente que o engine lê o arquivo pelo `filename`.
- `PromptSubmitArgs = Omit<PromptSubmitInput, 'origin'|'turnId'|'wait'|'context'>` (`:7163`): um plugin também **não passa `context` diretamente** no submit. `context` (texto oculto ao usuário, lido pelo modelo) é anexado por um **hook `prompt.submit`** com `next({ ...e, context: [...(e.context ?? []), bloco] })` (`:7196-7205`, docs [`api#start-a-turn-from-a-background-job`](https://code.claude.com/docs/en/plugins/mods/api#start-a-turn-from-a-background-job)). Como "só o hook que chamou é pulado" (`:2500`), outra registration `prompt.submit` do **mesmo plugin** vê o submit e pode anexar contexto.
- `asUser: true` (mandar como palavras do usuário) aparece nos docs 2.1.289, **não existe** nos tipos 2.1.277 nem nos mods oficiais baixados — confirmar na build alvo.
- Semântica de espera: o submit "roda quando a sessão está ociosa" e resolve quando o prompt entrou/começou o turno; não espera o turno terminar (`turn.complete` é o evento de fim). Não há parâmetro de cancelamento.
- Cancelamento real: `$.turn.abort({ turnId })` cancela o turno em andamento (`:2474-2500`), rejeita se o `turnId` não for o turno corrente; `next.signal` aborta quando o dispatch é abandonado (passar para waits longos, ex. `$.clock.sleep(ms, { signal })`). Um hook pode recusar um prompt com `{ drop: reason }` (`PromptSubmitResult`, `:7241-7265`).

**Alternativa honesta para "imagem ao modelo":** gravar o PNG no disco (via `$.process.run` de um utilitário; `$.fs.write` só escreve texto) e submeter um prompt textual instruindo `Read <caminho>` — o resultado da ferramenta inclui a imagem e o modelo a vê; ou o usuário anexa a captura manualmente na UI. Nenhum dos dois entrega a imagem "no composer" pelo mod.

### 4.3 `/mesa` — comando exato

```ts
// session.start
await $.command.register({
  name: 'mesa', description: 'Abre a Mesa de Estudos',
  argumentHint: '[aba]',
  // immediate: true  // executa mesmo durante um turno (não assumir estado do turno)
})

on('command.run', { command: 'mesa' }, async ($, e) => {
  // e.args = texto após /mesa; e.origin = { kind: 'composer' | 'plugin' | ... }
  // e.presentation = { isFullscreen, columns }
  await $.ui.open({ id: 'mesa', title: 'Mesa de Estudos', focus: true, closeOnEscape: true, rows: 20, columns: 70 })
  return {}   // nada no transcript
})
```

Regras: nome não pode colidir com built-in (register lança erro, ex. `"/focus" refused`); registre por último no `session.start` ou envolva em `try/catch` (um throw pula o resto do hook). `{ text }` do `command.run` é impresso e o modelo lê; `{ context }` registra nota oculta para o modelo.

### 4.4 Pane — `ui.open`, props, callbacks

- `id` 1–64 `[A-Za-z0-9_-]`; `focus: true` é pedido (só com composer vazio); `closeOnEscape: true` faz Esc fechar; `holdToasts: true` segura toasts; `rows` (inline) / `columns` (dock) são pedidos.
- No `ui.render` de `{ component: 'Pane' }`, `e.requestId === id`; `e.surface` ∈ `terminal|desktop|mobile|vscode`; `e.props` = `{ title, isFocused, bodyColumns, placement: 'dock'|'inline', scroll: { offset, bodyRows }, view }` (`claude-code.d.ts:8329-8444`); `e.viewport` = `{ columns, rows, isFullscreen? }`. Desenhe com `bodyColumns` × `scroll.bodyRows`.
- Callbacks: `Button.onPress()`, `Input.onSubmit(value)/onInput(value)`, `Select.onSelect(value)`. Cada uso também emite `ui.press`/`ui.input`/`ui.select` (outro mod pode observar/reescrever antes do seu callback).
- Teclado: Tab percorre, setas rolam, Enter aciona, `hotkey` (1 dígito ou 1 letra) aciona; Esc devolve foco. O mod **nunca lê o teclado** diretamente.
- Estado: `$.ui.invalidate('ui.render')` para redesenhar; `$.state` (reativo) existe nos docs 2.1.289 mas **não aparece nos tipos 2.1.277** — confirme na build; enquanto isso, variáveis de módulo + `$.store` são o caminho garantido (a variável reseta a cada hot reload; o store persiste).
- Não é possível abrir pane "por cima" com layout livre: é célula de terminal, dock/inline, com rolagem do engine.

### 4.5 `$.store`

- KV por plugin, JSON, persistido em arquivo próprio sob a pasta de configuração do Claude Code (`~/.claude/plugins/store/` segundo docs [`interface#keep-state`](https://code.claude.com/docs/en/plugins/mods/interface#keep-state)).
- `get` → `unknown`/`undefined`; `set` exige JSON (função/ciclo rejeitados; `Date` vira ISO; `Map`/`Set` viram `{}`); teto **4 MiB no total**.
- **Não é atômico entre sessões** (`get`+`set` correm); para dados por matéria, prefira um arquivo próprio em disco (`$.fs.write`, texto) ou chaves independentes. Sessões na mesma máquina compartilham o mesmo store.
- `session.start` + `classic.SessionStart` para recarregar após `/clear`, `/resume`, `/branch` (que resetam `$.state`).

### 4.6 Testes, fs/process e Desktop

- **Testes nativos:** `claude plugin test [dir]` roda arquivos `*.test.ts(x)`; kit `claude-code/testing` com `test`, `describe`, `expect`, `mock.store`, `mock.clock`, `mock.env`, `tier`, `$.ui.mount({ component:'Pane', surface:'desktop'|'terminal', ... })`, `ui.press/input/select/find/unmount`; **"sem sessão, login ou rede"** (docs test). Nos mods oficiais: `mods/diff/tests/register.test.ts` importa `claude-code/testing` e usa `tier('builtin')`, `on('fs.list', ...)`, `$.ui.render(...)`. **Nesta máquina não roda:** 2.1.246 não tem o subcomando (§4.7).
- **`$.fs`:** leitura 4 MiB, escrita só texto, sem glob; `$.fs.list` não é recursiva.
- **`$.process.run`:** argv sem shell, cwd default da sessão, timeout 30 s/10 min, retorna `{exitCode, stdout, stderr}` mesmo com exit ≠ 0; rejeita se não iniciar/estourar. O comentário do tipo diz **"CLI only"** — plausível que signifique "não-cloud"; **não verificado no Desktop** (confirmar com os tipos gerados e um teste manual). Exemplos oficiais usam `$.process.run` à vontade (`blast-radius`: `["git", ...]`, `["bash","-c",...]`).
- **Desktop:** superfície `'desktop'` no `ui.render`/`ui.input` etc. O `Svg` desenha "as an image, or in a sandboxed frame when `isInteractive`"; sem scripts em qualquer caso.
- **Instalar/rodar no Desktop:** via **+ > Plugins > Add plugin** (marketplace) ou `CLAUDE_CODE_PLUGIN_DIRS` (env ou `env` em `~/.claude/settings.json`) para carregar diretórios sem flag (docs reference, tabela de settings). `--plugin-dir` é do CLI.

### 4.7 Versões e incompatibilidade local (2.1.246) — verificado

- Piso oficial: **terminal ≥2.1.287**, **Claude Code embutido no Desktop ≥2.1.286**; `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` é ignorado a partir da 2.1.287.
- CLI local = **2.1.246** (`~/.local/bin/claude`, ver `claude --version`). Sem `CLAUDE_*`/`ANTHROPIC_*` no ambiente; nenhum login foi tentado.
- `claude plugin --help` na 2.1.246 **não lista `test`** (lista `validate`, `install`, etc.). Logo, os testes nativos não rodam nesta máquina.
- `claude plugin validate <dir>` existe e roda offline (sem login). Provas executadas:
  - Em `claude-code/mods/diff` (oficial): falha de resolução `cannot import "./pane-view.jsx"` (o repositório usa `.tsx`; o resolvedor da 2.1.246 não mapeia).
  - Em `claude-code-playground/.../token-weather` (exemplo oficial, um `.mjs`): **`✘ "session.start" is not an event`** — o validador da 2.1.246 não conhece os eventos de mod.
  - `token-weather/README.md` e os demais exemplos: "Claude Code 2.1.287 or later, where mods load by default. Built and tested on 2.1.280, validate passes on 2.1.285."
- Conclusão: **não usar a CLI 2.1.246 para desenvolver/validar o mod; não atualizar** (decisão do usuário). O desenvolvimento tem de mirar a build do Desktop (≥2.1.286) ou um CLI ≥2.1.287 em outra máquina.
- App Desktop presente: `/Applications/Claude.app` versão **2.19675.1** (Info.plist, leitura passiva). A versão do Claude Code embutido **só é visível em `/status` numa sessão local da aba Code** — não foi tocado no app.

---

## 5. Alternativas honestas

### 5.1 Ler/navegar PDF sem render fiel

| Caminho | Como | Limites |
|---|---|---|
| Texto | `$.process.run(['pdftotext','-f',N,'-l',N,'-layout',pdf,'-'])` → `stdout` → `Code`/`Text` (ou `Markdown`) | Perde fórmulas/figuras/posição; busca é local ao texto |
| Recorte vetorial | `$.process.run(['pdftocairo','-svg','-f',N,'-l',N,'-x',x,'-y',y,'-W',w,'-H',h,pdf,out])` → `$.fs.read(out)` (texto) → `Svg` se ≤131.072 chars | ~1/6 de página cabe; zoom maior encolhe o recorte; precisa de poppler; atualização de página/scroll = re-render |
| Página fiel fora do mod | Manter a Mesa Electron/Xournal++ para a página; o mod orquestra | Fora do Desktop/Code; duas janelas |
| Abrir no visualizador do sistema | `$.process.run(['open','-a','Preview',pdf])` (macOS) | Sem controle de página pelo mod; AppleScript exigiria automação/TCC |
| PDF.js/WASM no processo | Rodar pdfium/WASM num processo auxiliar via `$.process.run` e **produzir SVG/PNG/texto** que o mod exibe | Ainda esbarra em `Svg` 131k para o pixel fiel; o processo pode fatiar em recortes |

### 5.2 Imagem ao modelo / captura Xournal++

- **Captura:** o helper `visual-check/` do repo (macOS, `screencapture` da janela do Xournal++) pode ser chamado por `$.process.run` (ex.: `['node', '<caminho do helper>']`) e gravar o PNG. **Bloqueador de permissão:** o TCC (Screen Recording) é concedido ao **app hospedeiro** (Claude Desktop), não ao mod; sem essa permissão a captura sai preta/vazia. Windows usa PowerShell do sistema no app atual — suporte pelo mod não verificado.
- **Enviar a captura ao modelo:** `prompt.submit` não carrega bytes (§4.2). Caminhos: (a) submissão textual "Leia `<png>` e comente a resolução" (o modelo chama `Read`; a imagem entra no transcript como resultado); (b) o usuário anexa manualmente; (c) manter o fluxo de anexo no app Electron. Cuidado com privacidade: caminhos de materiais entram na sessão.
- **Nota de escopo:** os documentos do repo dizem "não implementar canvas de tinta na Mesa"; nada aqui muda isso — a captura continua sendo do Xournal++, por fora.

---

## 6. Escopo recomendado para o protótipo

**Fase 0 — habilitar o ambiente (bloqueador primeiro):**
1. Confirmar na aba Code do Desktop, numa sessão local: `/status` → linha **Claude Code** ≥2.1.286; `/plugin` → linha `N mod active`.
2. Sem tocar no app: em outra máquina/terminal com CLI ≥2.1.287, `claude plugin test` (de um diretório sem mod) para ver `no hooks module to load` e validar o pipeline de testes sem login.
3. Ao carregar o mod (`CLAUDE_CODE_PLUGIN_DIRS` ou `--plugin-dir` no CLI), copiar `.claude-plugin/types/claude-code/index.d.ts` gerado e **reconciliar as derivas** listadas na §7.

**Fase 1 — mod mínimo `/mesa` (viável e sem riscos novos):**
- `plugin.json` + `hooks.json` + `register.ts`; `/mesa` registra e abre pane `id: 'mesa'`, `focus: true`, `closeOnEscape: true`.
- Pane com abas (Buttons/`plain` + `hotkey`), lista de matérias/PDFs lida de config/`$.store`, e um `Input` de anotações com `onSubmit` gravando em `$.store` (ou arquivo texto via `$.fs.write`).
- Calculadora: JS puro no módulo (o app já evita `eval`; o ambiente proíbe `eval`/`new Function`).
- Testes de unidade das funções puras (sem kit) e um teste nativo quando houver CLI ≥2.1.287.

**Fase 2 — leitura e captura:**
- Aba "Leitura": `pdftotext` (texto) e/ou recorte `Svg` para páginas simples; botões de página anterior/próxima recalculando o recorte; fallback textual quando o SVG estourar o teto; detectar poppler com `$.process.run` em `try/catch` e explicar a ausência.
- Aba "Captura": botão chama o helper `visual-check` (macOS) e salva PNG em pasta de dados; mostrar caminho e botão "pedir comentário" que faz `$.prompt.submit({ text: 'Leia <png>…' })`.
- Aba "Conversa/Contexto": `$.session.messages()` para espelhar a última resposta no pane; `$.prompt.submit` para perguntas; `$.session.usage()` para barra de contexto (padrão do `token-weather`).

**Fora de escopo (não prometer):** página PDF fiel no pane, anexar imagem pelo mod, tinta dentro da Mesa, layout pixel-perfect, macOS/Windows paritários para captura via mod.

---

## 7. Bloqueadores e perguntas abertas

1. **CLI local 2.1.246 não suporta mods** — nem `plugin test`, e o validador rejeita `session.start`. Sem atualizar (decisão), o alvo é a build do Desktop.
2. **Versão do Claude Code embutida no Desktop é desconhecida** (não tocamos no app); o piso é 2.1.286. Verificar `/status`.
3. **PDF fiel sem webview é impossível no Desktop** (prova na §4.1); qualquer promessa de página fiel exige mudar de host ou de arquitetura.
4. **Sem bytes de imagem em `prompt.submit`** (prova na §4.2).
5. **Deriva de versão 2.1.277 × 2.1.289 (docs):** `$.state`/`atom/read/update`, `asUser`, retorno `{isPlaced}` de `$.ui.open`, `$.process.spawn`, `onPress(e)` com `e.surface`. Confirmar nos tipos gerados antes de codar.
6. **`$.process` "CLI only" no tipo** — confirmar disponibilidade na sessão local do Desktop.
7. **TCC/Screen Recording** para `screencapture` a partir do host Desktop; fora do controle do mod.
8. **`Svg` no Desktop:** comportamento de `<image href="data:...">`, fontes embutidas e CSS não verificável sem a build alvo; tratar como não confiável.
9. **Panes em células:** sem layout livre; pane não solicitado só coloca ≥144 colunas (110 após 1ª abertura). A Mesa atual é rica em UI; o pane do mod será mais pobre por construção.
10. **`$.store` não é atômico** entre sessões e tem teto de 4 MiB — dados de matéria devem ir para arquivos próprios.

---

## Anexo A — Assinaturas-chave (do `claude-code.d.ts` 2.1.277, cópia em `/tmp/mesa-mod-api-research-20261005/raw/claude-code.d.ts`)

```ts
// :7420
export type Register = (on: On, options: PluginOptions) => unknown;
// :5446-5451
export type On = {
  <P extends Pattern>(pattern: P, hook: NoInfer<HookFor<P>>): Registration<HookFor<P>>;
  <P extends Pattern, const M extends Matcher<Args<MatchedNames<P>>>>(pattern: P, matcher: M, hook: NoInfer<MatchedHook<P, M>>): Registration<MatchedHook<P, M>>;
};
// :1565-1583
export type CommandSpec = { name: string; description: string; argumentHint?: string; immediate?: true };
// :7169-7185
export type PromptSubmitAttachment = { type: 'image' | 'audio' | 'document'; mediaType?: string; filename?: string };
// :7163
export type PromptSubmitArgs = Omit<PromptSubmitInput, 'origin' | 'turnId' | 'wait' | 'context'>;
// :7241-7265
export type PromptSubmitResult =
  | { text: string; context?: readonly string[]; origin?: PromptOrigin; drop?: undefined }
  | { drop: string; text?: undefined; context?: undefined; origin?: undefined };
// :2160-2195
open:  (pane: PaneOpenArgs) => Promise<void>;
close: (pane: PaneCloseArgs) => Promise<void>;
panes: () => Promise<readonly UiPane[]>;
// :5977-6045
export type PaneOpenArgs = { id: string; title?: string; focus?: true; closeOnEscape?: true;
  holdToasts?: true; rows?: number; columns?: number };
// :10884-10910
export type UiPane = { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean };
// :1109
export type ClientElements = Omit<Elements['terminal'], 'Client' | 'Raster' | 'Image'>;
// :1250-1310 (resumo)
export type ClientSurface<S> = { elements: ClientElements; state: S | undefined; setState(next: S): void;
  columns: number; rows: number; every(ms: number, fn: () => void): () => void;
  onPointer(fn: (event: ClientPointerEvent) => void): () => void;
  onKey(fn: (event: ClientKeyEvent) => void): () => void;
  post(data: JsonValue): void };
// :9601-9632
export type SvgProps = { source: string /* <=131072 chars */; alt: string; width?: number; height?: number; isInteractive?: true };
// :4425-4460
export type ImageProps = { key?: string; source: ImageSource; columns: number; rows: number; alt: string };
// :4573-4620 / :8512-8555 / :808-878 (resumo)
InputProps  = { key; label?; placeholder?; value?; submitLabel?; autoFocus?: true; onInput?; onSubmit };
SelectProps = { key; label?; options; value?; autoFocus?: true; onSelect };
ButtonProps = { key?; label?; hotkey?; action?; plain?: true; dimColor?; autoFocus?: true; hover?; onPress };
// :2855-2885 (resumo)
store = { get(key): Promise<unknown>; set(key, value): Promise<void>; delete(key): Promise<void>; keys(): Promise<string[]> };
// :2738-2764 (resumo)
fs = { read(path): Promise<string>; read(path, { as: 'bytes' }): Promise<{ base64 }>;
       write(path, text): Promise<void>; list(path?): Promise<FsEntry[]>; exists(path): Promise<boolean>;
       stat(path, options?): Promise<FsStat>; ancestors(request): Promise<readonly FsAncestor[]> };
// :2955-2990 (resumo)
process = { run(argv: readonly string[], init?: { cwd?; env?; stdin?; timeoutMs? }):
            Promise<{ exitCode: number; stdout: string; stderr: string }> };
// :2474-2500
turn = { abort(input: { turnId: string }): Promise<void> };
// :8401 / :7459
export type RenderSurface = 'terminal' | 'desktop' | 'mobile' | 'vscode';
export type RenderComponent = 'AskUserQuestion' | 'UserMessage' | 'AssistantMessage' | 'ToolUse' | 'ToolResult'
  | 'ToolGroup' | 'ToolProgress' | 'CommandOutput' | 'Spinner' | 'TurnDuration' | 'InfoNotice' | 'SessionMode'
  | 'PromptHint' | 'AbovePrompt' | 'Pane';
// :3105-3168 (tabelas por superfície — resumo)
terminal: Box Text Button Input Select Link Code Markdown Client Raster Image
desktop:  Box Text Button Input Select Svg Link Code Markdown Client
mobile:   Box Text Button Svg Link Code Markdown
vscode:   Box Text Button Input Select Svg Link Code Markdown
// :11315-11325 (global)
// "The globals of a hooks module's environment: these and no others (no DOM, no Node). No code
//  generation either: eval and new Function over a string throw, and there is no WebAssembly
//  (deliberately; a module that needs compiled code runs it in a process of its own through
//  $.process.run)."
```

## Anexo B — Fontes baixadas (públicas) em `/tmp/mesa-mod-api-research-20261005/`

| Caminho | O que é | Estado |
|---|---|---|
| `claude-code/` | clone esparso (`mods/`) de `anthropics/claude-code` | `main` = `e8ae451830fb8d1d8edf853c7830ff6c650d3ee3` |
| `claude-code/mods/types/claude-code.d.ts` | tipos completos | 507.444 B, "Written by Claude Code 2.1.277" |
| `raw/claude-code.d.ts` | cópia direta do raw (mesma do clone) | sha256 `8ae1244d19d4b393261605fe72d517b66be0d7e1c214c378cdec5107e8b0b46c` |
| `playground/` | clone esparso de `anthropics/claude-code-playground` (`claude-code/mods/`) | `main` = `569c5283d9a0a7ee7938df85bb32e4f48cbb8c86` |
| `playground/claude-code/mods/{token-weather,blast-radius,replay-theater}/` | 3 mods oficiais de exemplo, completos com README e screenshots | usados como evidência de API real |
| `pdf-probe/` | PDF sintético (55 linhas, sem material de curso) + conversões | `page.pdf` 21.207 B; `p1.svg` 315.581 chars; `crop-q1.svg` 136.380; `crop-16.svg` 99.024; `crop-19.svg` 81.925; PNG/JPEG medidos |

Nenhum arquivo do repositório da Mesa foi alterado além deste documento. Nenhum commit, push, login, instalação ou atualização foi executado.
