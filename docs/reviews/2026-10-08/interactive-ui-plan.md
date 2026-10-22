# UI interativa gerada pelo tutor — plano de domínio

Data: 2026-10-08 · Repo: `learning-canvas` · App: Mesa de Estudos (`desk/`)
Escopo: **investigação e planejamento** (nenhuma linha de produto alterada nesta rodada)
Documento irmão do plano geral: `docs/PLANO-UI-INTERATIVA-PDF-TIMELINE-2026-10-08.md`
Amostra de UX já existente no repo (do usuário): `docs/reviews/2026-10-08/mesa-interactive-proposal.html`

---

## 0. Como ler este documento

- Este documento decide **como** a Mesa pode mostrar uma interface interativa
  criada pelo tutor **dentro da conversa**, de forma isolada, recuperável e
  honesta, sem transformar tudo em quiz pronto e sem abrir as portas do app.
- Ele foi escrito depois de ler o código real dos caminhos envolvidos
  (chat, markdown, perfil do Pi, extensões, ponte de material, adaptador
  Claude, preload, persistência, backup). Toda afirmação de estado atual tem
  referência `arquivo:linha`.
- **Nada foi executado** nesta rodada: nenhum teste, nenhum app aberto, nenhum
  PDF gerado. As seções de teste descrevem o que **deve** ser criado/rodado,
  com a distinção clara entre "medido hoje" e "a medir".
- O que **não** foi lido: PDFs pessoais, sessões JSONL, credenciais, `config.json`
  pessoal, histórico de conversas. Foi lido o código das extensões do overlay de
  aprendizagem citadas no `AGENTS.md` (`quiz.ts`, `learning-session.ts`,
  `geogebra.ts` — só o contrato de ferramenta/registro), porque é ele que define
  o formato das ferramentas que a Mesa já consome.
- `git status` foi conferido e **nada** foi alterado além deste arquivo. As
  muitas mudanças locais existentes foram preservadas.

### Glossário curto

| Termo | Significado neste doc |
|---|---|
| **atividade** | interface interativa publicada pelo tutor na conversa |
| **spec** | descrição declarativa da atividade (JSON validado) |
| **artefato** | conteúdo gerado (spec ou documento HTML) guardado pelo host |
| **card** | a renderização do artefato dentro de `#messages` |
| **voz / turno** | resposta do tutor; o diário de trabalho é o bloco de passos |
| **lane A** | componentes declarativos renderizados pelo host (MVP) |
| **lane B** | documento HTML/CSS/JS isolado em sandbox (fase 2) |

---

## 1. Resumo executivo

1. **Duas lane, um contrato.** O tutor ganha **uma ferramenta por lane**, com
   contrato espelhado em Pi e Claude (o mesmo par que já existe em
   `desk/src/extensions/tutor-pdf/index.ts` + `desk/src/agents/tutor-pdf.cjs`).
   - **Lane A (MVP, recomendada):** atividade **declarativa** — sliders,
     seleções, campos numéricos, gráfico por expressão, tabela, texto, dica
     revelável e conferência local objetiva. Renderizada pelo host (Bend + DOM),
     offline, recuperável, testável.
   - **Lane B (fase 2):** documento **HTML/CSS/JS livre** para simulações que a
     lane A não expressa, atrás de flag, em sandbox com CSP própria, depois de
     **um spike obrigatório de isolamento de processo**.
2. **Prioridade máxima é a lane A.** A amostra do usuário
   (`mesa-interactive-proposal.html`) é 100% expressável na lane A: previsão numérica,
   slider de aceleração, gráfico da posição, comparação com diferença,
   explicação revelável e rascunho para levar ao tutor. Não é preciso iframe,
   rede, nem JavaScript gerado para entregar o que ele pediu.
3. **O que o host guarda** é a spec validada + o estado de interação, por
   conversa, com versão e hash (`<runtime>/activities/<sessão>/…`), no mesmo
   espírito de `desk/pending.cjs` (chaveado pela conversa) e
   `desk/free-workspaces.cjs` (pasta por sessão, gravação atômica).
4. **A interação é local e nunca chama o modelo.** Só uma ação explícita
   ("Levar minha tentativa ao tutor") enfileira uma mensagem — pelo mesmo
   caminho durável da fila (`desk/src/queue.mjs`).
5. **A ordem importa.** Card publicado no meio de um turno precisa reaparecer no
   mesmo lugar ao retomar a conversa. Este documento define a **peça de timeline**
   que a UI interativa precisa (com fallback que funciona sem a reforma da
   timeline) — item 1 do plano geral.
6. **O maior risco técnico não é a UI, é o sandbox da lane B.** Um iframe com
   `sandbox="allow-scripts"` **não bloqueia rede por si só** e **não garante
   processo separado**; um laço de CPU no frame pode congelar o renderer
   inteiro do app (que roda com `backgroundThrottling:false`,
   `desk/main.cjs:1170`). Isso está detalhado em §8 com o experimento de
   decisão e os fallbacks.
7. **Feedback local honesto ou nada.** A conferência automática é rotulada como
   tal, exige tolerância declarada para números, e usa o "Não sei" do quiz como
   resposta legítima. Quando a spec não permite conferir, o card diz isso e
   oferece o tutor como próximo passo.

---

## 2. Estado atual: o que existe, o que falta

### 2.1 O que já está pronto e deve ser reutilizado

| Peça | Onde | Uso na atividade |
|---|---|---|
| Markdown+LaTeX local | `desk/src/markdown.mjs:1-52` (`marked` + `katex` + `DOMPurify`), CSS em `desk/index.html:9` | textos, fórmulas, tabelas do card e da alternativa textual |
| Árvore declarativa + aplicador | `core/view.bend`, `desk/src/view-host.mjs` (`build`/`renderInto`/`htmlNode`) | desenhar o card sem HTML do modelo |
| Núcleo do card de quiz | `core/talkview.bend:451` (`quizCard`), `desk/src/chat.mjs:884` (`renderQuizCard`), handler em `desk/src/chat.mjs:653-710` | precedente de card interativo com estado, teclado e `preserveFocus` |
| Publicação de material do tutor | `desk/src/extensions/tutor-pdf/index.ts`, `client.mjs`, `desk/tutor-materials.cjs`, `desk/main.cjs:690-702`, `desk/src/free-study.mjs` (`receiveTutorMaterial`) | precedente exato de "ferramenta → ponte local com token → evento no renderer → card" |
| Sandbox de documento | `desk/material-pdf.cjs:102-152` (`lockSession`), `:207-224` (BrowserWindow/partition), `desk/src/materials/print.html:6` (CSP), `print-preload.cjs` | modelo de página isolada sem rede/Node, que a lane B deve copiar em miniatura |
| Persistência por conversa | `desk/pending.cjs` (store chaveado pela sessão, escrita atômica, leitura tolerante, teto), `desk/free-workspaces.cjs` (pasta por sessão, `rev`, staging) | o store de atividades |
| Fila durável | `desk/src/queue.mjs:236-248` (`enqueue`), `:335` (`adopt`), `desk/pending.cjs` | "levar tentativa ao tutor" sem perder mensagem, respeitando `busy`/offline |
| Capacidades por motor | `core/agentcaps.bend:23-60` (`Caps`, `piCaps`, `claudeCaps`), `desk/src/state.mjs:27` (`CAP_KEYS`) | gate da UI/renderer (`activity`), sem fallback escondido |
| Backup | `desk/src/study-data/backup.cjs:177-211` (nega listas), `:312+` (`buildSources`) | `<runtime>/activities/**` entra automaticamente; falta só o teste |
| Testes sintéticos de UI | `desk/tests/helpers.mjs` (`launchDesk`, `seedSession`, `tinyPdf`), `desk/tests/fake-pi.mjs` (quiz e tool events) | base dos testes de aceitação |

### 2.2 O que **não** existe hoje (e por que importa)

1. **Card persistente de ferramenta.** O quiz é transitório: vive em
   `S.quizQueue` (`desk/src/state.mjs:20`) e some ao recarregar. `historyTurns`
   (`desk/src/worklog.mjs:384`) reconstrói só `steps`/`text` e perde `details`
   (o card do quiz não volta). A atividade precisa sobreviver à reabertura.
2. **Ordem intercalada no `desk`.** O `Conversa` já tem `parts` na ordem real
   (`chat/src/worklog.mjs:603-685`); o `desk` ainda agrupa trabalho antes da
   fala (`desk/src/chat.mjs:167-215`). Sem isso, um card publicado no meio do
   turno não tem slot no histórico — ver §7.2.
3. **Store de conteúdo gerado pelo tutor no chat principal.** O único store de
   material hoje é o de sessão Livre/cadeira (`desk/free-workspaces.cjs`), com
   PDF, não com spec interativa.
4. **Validação de expressão matemática.** Não há avaliador de expressão no app:
   `desk/calculator.mjs` avalia teclas/recursos de calculadora, não uma AST
   livre. A lane A precisa de um avaliador **sem `eval`**, offline e testado
   (§6.3).
5. **Sandbox de documento dentro da conversa.** Não há `iframe`/`webview` no
   renderer hoje (`desk/src/markdown.mjs:38` proíbe `iframe`/`form`/`input`/
   `button` no Markdown do tutor). WebContentsView só aparece no GeoGebra
   (`desk/main.cjs:2055`), com dores conhecidas de sobreposição
   (`desk/src/ggb.mjs:29-31`: "WebContentsView fica acima do DOM").

### 2.3 Restrições que o desenho tem de respeitar

- **Dois apps separados.** `chat/` (Conversa) não é embutido na Mesa; nada aqui
  muda isso (`AGENTS.md`).
- **Defaults do autor.** O comportamento novo não altera `desk/config.cjs`; a
  lane B nasce desligada por flag e a lane A só aparece quando o modelo usa a
  ferramenta.
- **Núcleo Bend.** Lógica que não pode quebrar mora em `core/*.bend` com
  `core/laws/` e `core/proofs/`; artefatos gerados vão commitados
  (`AGENTS.md`, "Leis novas").
- **Perfil fixado.** Ferramenta nova = extensão declarada em
  `desk/profiles.cjs` (`pinnedArgs`, `EXPECTED_ACTIVE`) e medida com
  `npm run profile`.
- **Sem rede.** O app já nega as ferramentas de browser/web em
  `desk/profiles.cjs` (`EXPECTED_INACTIVE`) e no Claude
  (`DISALLOWED_TOOLS`, `desk/src/agents/claude-adapter.cjs:179`). O artefato não
  pode reintroduzir esse caminho.

---

## 3. Arquitetura proposta (visão geral)

```
                 Pi (extensão)                     Claude (SDK MCP)
        desk/src/extensions/mesa-activity/     desk/src/agents/activity.cjs
                     │                                  │
        POST http://127.0.0.1:<porta>/activity   callback in-process
        (token por conversa, grant com escopo)
                     └──────────────┬───────────────────┘
                                    ▼
                        desk/main.cjs  (createActivityBridge)
                                    │  valida caps; grava o artefato; indexa toolCallId
                                    ▼
             win.webContents.send('activity-event', {...})   +   IPC activity-*
                                    │
                                    ▼
                desk/src/activity.mjs  (card + estado + ações)
                 ├─ core/activityview.bend   (árvore do card)
                 ├─ core/activity.bend       (normalização, check, carry, markdown)
                 └─ desk/src/expr.mjs        (avaliador sem eval)
                                    │
                                    ▼
      <runtime>/activities/<sessão-hash>/{index.json, v1-<id>.json, state.json, v1-<id>.html?}
                                    │
                        backup runtime (automático) · export markdown/PDF
```

Princípios:

1. **O host é o único que escreve.** Nem o modelo nem o documento do artefato
   escolhem caminho, canal ou conteúdo executável.
2. **A ferramenta publica e retorna.** Ela não espera o usuário (diferente do
   quiz, que segura o modelo). Interação é local; "levar ao tutor" é uma nova
   mensagem explícita.
3. **A mensagem guarda a referência, não a spec.** O JSONL/descritor recebe só
   um resumo compacto + `toolCallId`; a spec completa fica no store. Isso
   evita inchar o contexto do modelo com o JSON da atividade.
4. **Específico de motor só no transporte.** O conteúdo (spec, card, estado) é
   idêntico para Pi e Claude.

---

## 4. Contrato da ferramenta

### 4.1 Nomes e transporte

| Motor | Registro | Transporte | Resultado |
|---|---|---|---|
| Pi | extensão `mesa-activity` em `desk/src/extensions/mesa-activity/` (`index.ts` + `client.mjs`), adicionada ao perfil em `desk/main.cjs:516-540` quando `activityTools:true` | `POST http://127.0.0.1:<porta>/activity` com `x-mesa-token` (mesmo padrão de `desk/tutor-materials.cjs:1-45`) | `{published:true, id, version, hash, kind, summary}` |
| Claude | servidor MCP `mesa` (hoje `createTutorPdfServer` em `desk/src/agents/tutor-pdf.cjs`) ganha o tool `criar_atividade`; `allowedTools` inclui `mcp__mesa__criar_atividade` (`desk/src/agents/claude-adapter.cjs:1953-1958`), `_canUseTool`/`_preToolUse` reconhecem o nome (`:2763`, `:2790`) | callback in-process `createActivity(scope, payload)` (`desk/main.cjs:550`) | idem |

Nome único de ferramenta, por lane:

- Lane A: **`mesa_criar_atividade`** (Pi) / **`mcp__mesa__criar_atividade`** (Claude).
- Lane B: **`mesa_criar_simulacao`** (Pi) / **`mcp__mesa__criar_simulacao`** (Claude) — fase 2.
- O nome técnico entra em `EXPECTED_ACTIVE` (`desk/profiles.cjs`) e no
  `toolKind` do núcleo (§7.1).

### 4.2 Assinatura (lane A) — espelhada em TypeBox (Pi) e Zod (Claude)

```ts
{
  title: string            // 1..160
  objective: string        // 1..300 — objetivo de aprendizagem, aparece no card
  textAlternative: string  // 1..8000 — Markdown; OBRIGATÓRIA (a11y + fallback)
  predict?: {              // previsão-observação-explicação
    prompt: string         // 1..400
    kind: 'numeric' | 'choice'
    unit?: string          // até 16
    options?: {id,label}[] // choice: 2..8
    tolerance?: number     // numeric: > 0, declarada; sem ela não há conferência
    correct?: string|number // id da opção ou valor; nunca mostrado antes do envio
  }
  controls: [{             // 0..8
    id: string             // [a-z][a-z0-9_-]{0,31}, único
    kind: 'slider'|'number'|'select'|'checkbox'
    label: string          // 1..120 (pode ter LaTeX)
    unit?: string
    min?: number; max?: number; step?: number
    value?: number|boolean|string
    options?: {id,label}[] // select
  }]
  views: [{                // 1..8; expressões usam os ids dos controles
    kind: 'plot'|'value'|'table'|'markdown'|'hints'
    // plot: {x:{id,min,max,unit?}, series:[{id?,label,expr,unit?}], points?: number}
    // value: {label, expr, unit?}
    // table: {columns:[...], rows:[{cells:[expr|string]}], }
    // markdown: {text}
    // hints: {items:[{text, after?: 'predict'|'observe'}]}
  }]
  check?: {                // conferência automática (honesta)
    prompt: string
    kind: 'numeric'|'choice'
    expr?: string          // valor esperado como expressão dos controles
    options?: {id,label}[]
    correct?: string|number
    tolerance?: number
    unit?: string
    explanation: string    // 1..4000 — revelada após responder
  }
  explain?: string         // 1..8000 — Markdown; revelável depois
  note?: string            // 0..400 — dica de uso ("mova o slider e preveja…")
}
```

Regras de validação que o host impõe (não confia no modelo):

- expressões: ≤ 200 caracteres, ≤ 128 nós, variáveis = ids de controles +
  variável do eixo (default `x`/`t`), funções num catálogo (§6.3);
- pelo menos uma view de leitura (`plot`/`value`/`table`) ou `explain`;
- `textAlternative` obrigatória mesmo quando tudo renderiza;
- `tolerance` obrigatória para conferência numérica; sem ela, o card mostra
  "sem conferência automática";
- ids únicos e normalizados; labels/units sem dados pessoais (não é possível
  detectar "pessoal" automaticamente, mas o prompt proíbe e o usuário vê);
- total serializado ≤ 64 KB (lane A) / ≤ 512 KB (lane B, fase 2).

### 4.3 Resultado da ferramenta (o que o modelo vê e o que o card usa)

Texto do resultado (compacto, entra no contexto do modelo na próxima retomada):

```
Atividade publicada para exploração local (o usuário ainda não respondeu).
[título] MRUV: posição com aceleração
[objetivo] Relacionar aceleração, velocidade inicial e posição em 3 s.
[controles] a: 0–4 m/s² (slider), v0: 0–5 m/s (slider)
[previsão] s(3) em metros
[conferência local] numérica, tolerância 0,01 m
[referência] act-7f3a v1 sha256:9c1e… (não repita a spec; use a referência)
```

`details` do resultado:

```json
{"activity":{"id":"act-7f3a","version":1,"kind":"structured",
             "hash":"sha256:9c1e…","status":"published","toolCallId":"call_…"}}
```

- **Pi:** `details` chega no evento `tool_execution_end` e vai para o JSONL
  (o `fake-pi.mjs:104-160` espelha esse formato), então a referência sobrevive
  à reabertura sem ler o store.
- **Claude:** o cache do descritor normaliza `toolResult` só com `toolCallId`,
  `text`, `isError` (`desk/src/agents/history.cjs:148-160`, `:197-205`) e
  **descarta `details`**. Por isso o store indexa por `toolCallId` (§6.4): a
  referência que falta no cache vem do store. Esse é um achado que muda o
  desenho — não dá para depender de `details` para recuperação no Claude.
- A ferramenta **nunca** devolve "o usuário respondeu X" — isso só existe numa
  mensagem posterior do usuário.

### 4.4 Canais IPC novos (desk only)

`desk/preload.cjs` (validação cedo) + `desk/main.cjs` (decisão):

| Canal | Direção | Payload validado | Devolve |
|---|---|---|---|
| `activity-publish` | (interna; a ferramenta chama a ponte, não o renderer) | — | — |
| `activity-list` | renderer → main | `{}` | `{items:[{id,version,hash,kind,title,toolCallId,createdAt}]}` |
| `activity-read` | renderer → main | `{id:string(1..64), version:int}` | `{spec}` ou `{error}` |
| `activity-state-get` | renderer → main | `{id, version, hash}` | `{values, attempt, revealed}` |
| `activity-state-save` | renderer → main | `{id, version, hash, values, attempt, revealed}` com teto de bytes | `{saved:true}` |
| `activity-snapshot` | renderer → main | `{id, version, hash, png?:dataURL}` (fase 2 do PDF com imagem) | `{saved, name?, path?}` |
| `activity-markdown` | renderer → main | `{id, version, hash}` | `{markdown}` (para copiar/exportar) |

Regras do main (padrão do app): o renderer **não** passa sessão nem caminho — o
main resolve a conversa corrente (como `sidechat-*`, `desk/main.cjs:1636-1646`);
`id`/`version`/`hash` são validados por regex/int; só se lê dentro de
`<runtime>/activities/<hash-da-sessão>`; `activity-state-save` aplica o teto do
núcleo e grava atômico.

Evento do host para o renderer: `activity-event` com
`{status:'published'|'removed', scope:{courseId,conversationId}, activity:{…}}`
— mesma forma de `tutor-material` (`desk/main.cjs:691`).

---

## 5. Lane A: componentes declarativos

### 5.1 Por que essa é a MVP (e não a lane B)

| Critério | Lane A (spec declarativa) | Lane B (HTML/CSS/JS livre) |
|---|---|---|
| Expressividade para o pedido do usuário | cobre previsão, slider, gráfico, comparação, explicação, tentativa (é exatamente o mock `mesa-interactive-proposal.html`) | qualquer coisa, inclusive animações/canvas/arrastar |
| Superfície de ataque | zero script gerado; só dados | precisa sandbox + CSP + processo + watchdog (§8) |
| Estado e recuperação | trivial (spec + valores serializáveis) | estado vive no documento; precisa `postMessage` e re-hidratação |
| Offline/math | KaTeX local + avaliador + SVG do host | precisa injetar KaTeX local e negar o resto |
| Acessibilidade | host controla foco/ARIA/teclado | o modelo pode gerar UI inacessível |
| Testes sem dados pessoais | núcleo puro + DOM sintético | precisa testes de contenção reais no Electron |
| Esforço | ~9–14 dias-pessoa (M0+M1) | +5–8 dias-pessoa depois do spike |
| Risco de congelar o app | nenhum (sem laço possível) | real até provar isolamento de processo |

**Julgamento:** a lane A entrega a pedagogia pedida sem abrir mão de segurança e
recuperação. A lane B só entra depois do spike de §8.6 e atrás de
`desk.activityHtml` (default `false`). O tutor é instruído a preferir a lane A
e só pedir a B quando o objetivo depender de interação que a spec não expressa.

### 5.2 Renderização

- Árvore do card: novo núcleo `core/activityview.bend` (padrão do
  `core/talkview.bend`), com `ActivityCard`, `ActivityControl`, `ActivityRow`,
  `ActivityCheck`, `ActivityActions`; aplicador em `desk/src/activity.mjs` via
  `build()`/`renderChildren()` (`desk/src/view-host.mjs`).
- Texto e fórmulas: `markup`/`markupInline` (`desk/src/markdown.mjs`) — nada de
  HTML do modelo; a spec só tem Markdown.
- Gráfico: o host amostra as expressões e desenha **SVG** (eixos, grade, séries,
  ponto marcado). A função pura que gera o `path`/escala mora em
  `core/activity.bend` (`plotPaths`) para ser provada com casos concretos
  (bordas, NaN, domínio invertido, uma série só).
- Controles: `range`/`number`/`select`/`checkbox` nativos, com `<label>`
  associado, `output` para o valor, `aria-live="polite"` no feedback; nada de
  drag-and-drop no MVP (fica como motivação da lane B).
- Redimensionamento: `ResizeObserver` no contêiner (o chat muda de 310 a
  650 px, `desk/src/main.mjs:414`) e re-render do gráfico com debounce; sem
  reflow por tecla.
- Tema/`prefers-reduced-motion`: cores por variáveis do `style.css`; transições
  do gráfico desligadas por padrão (o mock usa `light-dark()`, que o app já
  suporta via tema).

### 5.3 Fluxo pedagógico (previsão → observação → explicação)

Ordem imposta pelo card, não pelo texto do modelo:

1. **Prever** — se `predict` existe, o gráfico aparece **oculto** ("Qual curva
   você espera?" / "Faça sua previsão") e o botão "Comparar" fica desabilitado
   sem previsão válida. É o comportamento do mock e o ponto pedagógico.
2. **Observar** — "Comparar" revela o gráfico com o valor atual da expressão,
   a diferença para a previsão e a unidade; mover um controle **reinicia a
   revelação** (previsão antiga não vale para parâmetro novo). `predict` sem
   `check` ainda dá retorno descritivo (previsto × observado), sem juízo.
3. **Conferir** — se `check` existe, aparece o campo/botões da conferência com
   o rótulo "Conferência automática" e a tolerância declarada. Para escolha, a
   opção "Não sei" é sempre oferecida (reaproveita a decisão do
   `quiz`, `.pi/extensions/quiz.ts`: acerto por sorte não se confunde com
   honestidade).
4. **Explicar** — `explain` revelável só depois de comparar/conferir; a
   explicação do `check` some antes da resposta (nunca vem com a pergunta).
5. **Levar ao tutor** — ação explícita que enfileira a tentativa (§5.5).

Regras de honestidade:

- o feedback diz exatamente o que foi conferido: "Sua previsão: 12 m. Resultado:
  15 m. Diferença: 3 m." (sem `check`) × "Conferência automática: correta
  (tolerância 0,01 m)." (com `check`);
- valores `NaN`/`Infinity` de uma expressão aparecem como "sem valor no domínio
  escolhido", nunca como 0 ou falso;
- preferências de arredondamento e unidade vêm da spec; o card não inventa
  "≈" para esconder erro de tolerância.

### 5.4 Estado, versão e hash

Estado (por conversa × artefato × versão × hash):

```json
{
  "values": {"a": 2, "v0": 2},
  "attempt": {"at": "2026-10-08T12:00:00Z", "kind": "numeric",
              "value": 12, "check": "near", "delta": 3},
  "revealed": {"compared": true, "explain": false, "hints": [0]},
  "notes": ""
}
```

- **Versionamento imutável:** cada publicação tem `version` (1, 2, …) e
  `hash = sha256(spec normalizada)`. Reabrir sempre lê a versão publicada.
- **Estado por hash:** a chave do estado inclui o hash; uma spec nova (mesmo id)
  não herda tentativa antiga. `core/activity.bend#carryState(oldSpec,newSpec,values)`
  decide o que transportar entre versões compatíveis (controles com mesmo id,
  tipo, faixa e unidade) — com prova de que a incompatível **não** transporta.
- **Teto de estado:** 16 KB por artefato; 40 artefatos por conversa; poda FIFO
  do mais antigo fora das versões referenciadas pelo histórico.
- **Sem caminho absoluto no estado** (backup/relocação; ver §9.2).
- **Dedupe:** a chave é `(toolCallId, hash)`; reintento de ferramenta com mesmo
  id/hash substitui o card e o índice; hash diferente cria versão nova.

### 5.5 Ações explícitas

| Ação | Comportamento |
|---|---|
| **Comparar / Conferir** | local; zero mensagens |
| **Tentar de novo** | limpa previsão/attempt da sessão do card, mantém valores dos controles |
| **Revelar explicação / dicas** | local |
| **Copiar valores** | copia um resumo (texto+LaTeX leve) via `navigator.clipboard` |
| **Ampliar** | re-render da mesma spec num `<dialog>` (até ~900 px); estado reidratado, nada recarregado da rede |
| **Levar minha tentativa ao tutor** | enfileira **uma** mensagem pela fila durável (`desk/src/queue.mjs`) com: referência (id/versão/hash), valores, previsão/tentativa, resultado local e o campo de explicação do usuário. Requer confirmação visual do texto enfileirado. Se a fila estiver `held`, continua guardada (não sai sozinha); se o motor estiver ocupado, o item espera a vez |
| **Fechar/recolher** | só visual; estado permanece |

Regras transversais:

- Explorar o card **nunca** aciona modelo, nem cria prompt, nem envia IPC de
  inferência. (Critério de aceitação com contagem de `pi-prompt`, §13.)
- O botão de levar ao tutor só existe depois de existir uma tentativa; o texto
  que ele produz é inspecionável (o mock já mostra esse rascunho).
- Interação durante streaming: permitida; a mensagem do botão entra na fila
  (`S.busy` → `enqueue`, `desk/src/queue.mjs:309-318`), nunca em paralelo.
- A fila hoje não exporta `enqueue` (é interna, `:236`); a mudança mínima é
  exportar `enqueueExternal(text, {reason:'activity'})` com o mesmo
  `persist(true)` e o mesmo respeito a `held`.

### 5.6 Acessibilidade

- Controles nativos navegáveis por teclado; foco visível; `Esc` não destrói
  estado.
- Gráfico com `<title>`/`<desc>` (como o mock) e o resumo numérico sempre em
  texto ao lado; o SVG é complemento, nunca o único portador da informação.
- `aria-live="polite"` no feedback da conferência; nada de `aria-live` no slider
  (ruído).
- `textAlternative` obrigatória é renderizada num `<details>` "Texto" mesmo
  quando o card funciona — é a alternativa acessível e o fallback offline.
- `prefers-reduced-motion`: sem animação de traço/transição.

---

## 6. Núcleo, avaliador e formato

### 6.1 Onde a lógica mora

| Módulo | Tipo | Decide | Por quê no núcleo |
|---|---|---|---|
| `core/activity.bend` | Bend + laws/proofs | normalização da spec (ids, limites, unidades), `carryState`, `gradeCheck`, `activityMarkdown`, `plotPaths`, tetos | são as decisões "que nunca podem quebrar": ids, tolerância, carregamento de estado e resumo exportável |
| `desk/src/generated/activity.core.js` | artefato gerado | — | commitado (`npm run verify:bend`) |
| `desk/src/expr.mjs` | host puro ESM | parse/eval de expressão | parser não cabe bem no Bend; testado direto com `node --test` e fuzz sintético |
| `desk/src/activity.mjs` | host DOM | card, eventos, gráfico, ações | aplicador fino, como `worklog-view.mjs` |
| `desk/activity-store.cjs` | host I/O | arquivo, índice, poda, atômico | I/O não entra no núcleo |

Registrar `activity.bend`/`activityview.bend` no `BUILD` de `core/build.mjs`
(mapeamento entry→`desk/src/generated`), como `pending.bend`/`resume.bend`.

### 6.2 Teto de complexidade (para não virar um motor de tela)

- Lane A não é Turing-completa: **sem laços, sem funções definidas pelo usuário,
  sem estado mutável além dos controles**.
- Expressões: gramática de calculadora científica + variáveis declaradas.
- Render: no máximo 4 séries, 320 amostras por série, 8 controles, 8 views.
- O modelo é instruído a compor com as peças; quando precisar de mais, é sinal
  de que a lane B (ou uma imagem estática já suportada) é o caminho.

### 6.3 Avaliador (`desk/src/expr.mjs`) — decisões

- **Sem `eval`/`new Function`**: parser recursivo-descendente → AST → avaliação
  por tabela de funções.
- Gramática: números (incl. notação científica), `+ - * / ^`, parênteses,
  `,` quando a função pedir, constantes `pi`, `e`, variáveis declaradas.
- Funções: `abs, sqrt, cbrt, exp, log, log10, sin, cos, tan, asin, acos, atan,
  atan2, min, max, pow, floor, ceil, round, sign, hypot`.
- Limites: expressão ≤ 200 chars, AST ≤ 128 nós, profundidade ≤ 16,
  avaliações por render ≤ 4 séries × 320 + 32 (cabeça de valor/check).
- Domínio: `sqrt(-1)`/`log(-1)`/divisão por zero → `NaN`/`±Infinity` propagados
  honestamente; o plot pula o ponto (e desenha uma descontinuidade visível) e o
  `value` mostra "sem valor".
- `^`: `(-8)^(1/3)` dá `NaN` (como JS) — documentado; a spec pode usar
  `cbrt(-8)`.
- Testes: casos felizes, precedência, associatividade, unários, notação,
  domínios, fuzz determinístico (semente fixa) comparando contra cálculo manual
  conhecido — sem dados pessoais.

### 6.4 Store (`desk/activity-store.cjs`)

Layout:

```
<runtime>/activities/
  <sha256(session)[0:24]>/
    index.json          {schema:1, session:"…", items:[{id,version,hash,kind,title,toolCallId,createdAt}]}
    v1-act-7f3a.json    spec normalizada (lane A)  → ou v1-act-7f3a.html (lane B)
    state.json          {items:{"act-7f3a@1@sha256:…":{values,attempt,revealed,notes}}}
```

Regras (espelham `desk/pending.cjs` e `desk/free-workspaces.cjs`):

- escrita atômica (`tmp` + rename); JSON ilegível vira "nada guardado" e o
  próximo save regrava (nunca sobrescreve lixo silenciosamente);
- a chave de sessão é derivada por hash — o renderer nunca a informa;
- `read` valida tipo/caps; item fora do teto é recusado com mensagem clara;
- poda por conversa (a conversa deixa de existir no disco → índice removido),
  como `pruneStore` de `pending.cjs:176-180`;
- `index.json` guarda `toolCallId` (posicionamento no histórico) e
  `createdAt` (ordem de fallback);
- **nada de dados pessoais**: só a spec (escrita pelo modelo) e os valores
  digitados pelo usuário para aquela atividade; nenhum caminho de PDF, nenhuma
  captura, nenhuma credencial.

---

## 7. Publicação no chat, timeline e recuperação

### 7.1 Publicação ao vivo

1. `tool_execution_start` com nome `mesa_criar_atividade`:
   - o diário de trabalho ganha um passo do tipo novo `Activity` (label
     "Preparou uma atividade", ícone próprio) — exige `core/worklog.bend`
     (`toolKind`) + `core/worklogview.bend` + `desk/src/worklog-tags.mjs`;
   - o renderer empilha um **placeholder** (`"Preparando atividade…"`) no
     `#messages` (reserva de posição), sem tocar no `#prompt`/fila/`busy`.
2. `activity-event {status:'published'}` (ou `tool_execution_end` com o mesmo
   id): o placeholder é substituído pelo card, com `dataset.toolCallId`;
   `followBottom` só rola se o usuário já estava no fim (mesma regra do chat).
3. O `tool_execution_end` também fecha o passo no diário (o card não é um passo;
   é conteúdo da conversa, como a mensagem).
4. Erro da ferramenta: o placeholder vira uma nota de erro curta + o passo fica
   com `isError` no diário; nada de card meio-renderizado.

Nada aqui usa `extension_ui_request`: a atividade **não** é um pedido pendente
do motor, então `piPromptPending()` (`desk/src/state.mjs:659-661`) não muda e o
"Parar"/"Limpar" do composer não ganham estado novo.

### 7.2 Recuperação no histórico — a peça que falta

**Problema medido:** `desk/src/worklog.mjs#historyTurns` devolve turnos com
`steps` + `text`; `showHistory` (`desk/src/chat.mjs:167-215`) renderiza
usuário → diário → fala. Não há slot para um card que foi publicado **depois da
fala e antes de uma ferramenta seguinte**. O `Conversa` já resolveu isso com
`parts` ordenados (`chat/src/worklog.mjs:603-685`), mas são apps separados.

**Contrato que a UI interativa precisa da timeline (item 1 do plano geral):**

```js
turn.parts = [
  {type:'work',    startedAt, endedAt, steps:[…]},
  {type:'artifact', toolCallId, id, version, hash, kind, at},
  {type:'text',    text, images:[…], time, spoken:true},
  …
]
```

**Fallback que funciona antes da reforma** (MVP, ~30 linhas em
`desk/src/chat.mjs#showHistory`): depois de montar o `DocumentFragment` do
turno, se algum `toolCall` do turno estiver no índice de atividades, inserir o
card **imediatamente após o bloco do diário** daquele turno e antes da fala.
Posição determinística, ordem de ferramentas preservada, sem tocar no núcleo.
O card ganha a estrutura final quando `parts` chegar — o renderer lê `parts` se
existir, senão cai na regra acima.

**Regras de recuperação:**

- `showHistory` chama `activity-list` **uma vez** por carga (não por card) e
  casa por `toolCallId`;
- item do store sem `toolCallId` no histórico (histórico truncado/importado):
  vai para uma seção "Atividades desta conversa" no fim, com a data — nunca
  some;
- card já respondido volta com o resultado local visível (attempt/revealed);
- **reabrir não dispara nada**: sem prompt, sem inferência, sem replay de
  `tool_execution_*`;
- dedupe: `(toolCallId, hash)`; card vivo + card do histórico nunca coexistem
  (`replaceChildren` na carga);
- performance: só os 20 cards mais recentes renderizam de imediato; os demais
  mostram a alternativa textual + "Abrir atividade" (IntersectionObserver),
  para abrir conversas longas sem renderizar 100 specs.

### 7.3 Dados que o JSONL/descritor guarda

- Pi: o `toolResult` no JSONL guarda `content` (resumo) + `details.activity`
  (referência). Nada da spec.
- Claude: como o cache normaliza e descarta `details`, o store é a autoridade;
  o resumo em texto continua disponível para o modelo.
- Nenhum dos dois caminhos faz o modelo re-renderizar o card ou reexecutar a
  ferramenta ao retomar.

---

## 8. Lane B: documento isolado (sandbox Electron)

Esta seção é a mais importante em segurança. Ela é escrita como **decisão
gate**: a lane B só liga se o spike de §8.6 provar isolamento real.

### 8.1 Alternativas de hospedagem (e o que cada uma custa)

| Opção | Isolamento | Problemas concretos | Veredito |
|---|---|---|---|
| `<iframe srcdoc>` | herda **a CSP do documento pai** (documento de esquema local); CSP só aperta, não afrouxa | o `script-src 'self'` de `desk/index.html:6` bloquearia o `<script>` inline do artefato; um `<meta>` dentro do srcdoc não relaxa CSP herdada | **descartada** (verificar no app antes de aceitar a conclusão) |
| `<iframe src="file://…">` | origem opaca com `sandbox` sem `allow-same-origin` | exige `frame-src file:` na CSP do pai; documento vindo do runtime pode tentar ler outros `file:` (imagens locais) e navegar para `https:` | **descartada** |
| `<iframe src="mesa-artifact://…">` servido por protocolo próprio | origem opaca + handler que só serve o diretório do artefato | requer `frame-src mesa-artifact:` na CSP do pai; **processo** não garantido (ver §8.4) | **recomendada**, condicionada ao §8.6 |
| `WebContentsView` (como o GeoGebra, `desk/main.cjs:2055`) | renderer separado, `webContents.forcefullyCrashRenderer()` possível, watchdog de CPU/memória por processo | posicionamento/scroll (a dor descrita em `desk/src/ggb.mjs:1-35`); não é inline de verdade; usar só no "Ampliar" não resolve o inline | **plano B** do §8.6 (e opção do "Ampliar" ampliado) |

### 8.2 Documento servido e wrapper

O modelo **não fornece um documento completo**. Ele fornece três campos
(`html`, `css`, `js`, `katex?`) e o host monta:

```html
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';
  script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:;
  font-src data:; connect-src 'none'; media-src 'none'; object-src 'none';
  frame-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'">
<style>/* reset + variáveis de tema + área do card */</style>
<style>/* css do modelo */</style></head>
<body>/* html do modelo */</body>
<script>window.__MESA__={v:1,id:"act-…",version:1,hash:"sha256:…",theme:"dark"};</script>
<script>/* js do modelo */</script>
</html>
```

- `unsafe-inline` **sem** `unsafe-eval`: permite o script do artefato, bloqueia
  `eval`/`new Function` (defesa em profundidade; o modelo não deve usar).
- `default-src 'none'` é o gate de rede: `connect-src` cobre `fetch`/XHR/
  WebSocket/beacon, `img-src data:` impede imagem remota e arquivo local,
  `font-src data:`, `object-src 'none'`, `form-action 'none'`.
- `math:'katex'` (opt-in): o handler serve **apenas** os arquivos fixos de
  `desk/node_modules/katex/dist/` (css + fontes + `katex.min.js`); a CSP do
  artefato passa a `style-src 'unsafe-inline' mesa-artifact:`,
  `font-src mesa-artifact: data:` e `script-src 'unsafe-inline' mesa-artifact:`
  — o artefato continua sem rede, e o que ele pode carregar é só a lista fixa.
- O host rejeita (com mensagem clara) tags perigosas no `html` (`<script src>`,
  `<link>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<form>`,
  `<meta http-equiv>`), URLs `http(s):`/`file:` em `src`/`url()`, e `@import`.
  Essa checagem estática é **reforço de UX**; quem manda é a CSP.

### 8.3 `sandbox` e o que ele (não) garante

Atributo do iframe: `sandbox="allow-scripts"` — **nunca** `allow-same-origin`,
`allow-forms`, `allow-popups`, `allow-modals`, `allow-downloads`,
`allow-top-navigation`, `allow-presentation`.

Isso garante origem opaca, sem `localStorage`/`cookie`/`indexedDB`, sem acesso
ao DOM do pai, sem popup, sem download, sem modal, sem navegação do topo.
**Não** garante: bloqueio de rede (por isso a CSP), bloqueio de CPU, nem
processo separado. Chamadas que dependem disso:

- `event.origin` de mensagem do frame é a string `"null"` (origem opaca) —
  validar `event.source === iframe.contentWindow` **e** `event.origin === 'null'`;
- o frame é quem inicia `postMessage` para o pai; o pai responde só pelo mesmo
  `contentWindow`, sem repassar string a `innerHTML`/IPC sem validação;
- `window.top.location`/`window.open`/`form.submit()` são negados pelo
  `sandbox` (e `setWindowOpenHandler` do main já nega, `desk/main.cjs:1185`);
- **navegação do próprio frame** (`location.href='https://…'`) é o furo que o
  `sandbox` não tapa: o documento remoto entra no lugar do artefato e ganha
  rede para si. Fechar com `win.webContents.on('will-frame-navigate', …)` no
  main: cancelar qualquer navegação de frame cujo URL não seja
  `mesa-artifact://` do artefato atual. Testar explicitamente (§13).

### 8.4 CPU/JS malicioso: a questão real é o processo

- Se o frame roda **no mesmo renderer** do app, `while(true){}` congela a Mesa
  inteira: o JS do documento pai não roda, então nenhuma vigilância do renderer
  reage; o processo principal do Electron ainda roda e recebe `unresponsive`
  do `webContents`, mas não consegue matar só o frame — a saída dele é
  recarregar a janela inteira, perdendo o estado vivo da conversa.
  `backgroundThrottling:false`
  (`desk/main.cjs:1170`) faz o laço rodar em velocidade cheia mesmo com a janela
  escondida.
- **Medição obrigatória do spike:** carregar um artefato sintético que trava e
  verificar se o renderer do app continua responsivo (tique de um
  `setInterval`/`requestAnimationFrame` no documento pai). Chromium tende a
  isolar frames de origem opaca em outro processo (OOPIF), mas isso **precisa
  ser provado neste Electron 44 + `file://`**, não presumido.
- Se o frame for **outro processo**:
  - watchdog no main amostrando `app.getAppMetrics()` (CPU/memória por
    processo) e destruindo a view do artefato acima de um teto (ex.: > 80% de
    um núcleo por 20 s, ou > 512 MB);
  - botão "Parar atividade" no card chama `webContents.destroy()`/
    `forcefullyCrashRenderer()` na view do artefato (não no app);
  - `webContents.on('unresponsive')` não cobre iframe; cobre a view própria.
- Se o frame for **o mesmo processo**: a lane B **não liga** no inline. Opções:
  (a) adiar; (b) rodar o documento num `WebContentsView` (ampliado), com o card
  inline mostrando só um pôster estático gerado pelo host + "Abrir simulação";
  (c) limitar a lane B a um "compute" declarativo (controles + `compute(state)`
  puro rodado num `Worker` com `terminate()` por timeout) — o que é outra spec,
  não HTML livre.
- **Teto de tempo de render:** o card mostra o pôster/skeleton até o frame
  reportar `ready`; sem `ready` em 8 s, o card degrada para a alternativa
  textual + "tentar de novo".

### 8.5 Contrato `postMessage` (v1)

Artefato → pai:

```json
{"v":1,"type":"ready"|"state"|"submit"|"resize"|"error",
 "payload":{"values":{},"attempt":{},"message":"","height":360}}
```

Pai → artefato:

```json
{"v":1,"type":"init","spec":{…},"state":{…},"theme":"dark"|"light"}
```

Limites: frame ≤ 512 KB (HTML+CSS+JS somados), payload de mensagem ≤ 8 KB,
`state` ≤ 16 KB, no máximo 1 mensagem de `state` por 250 ms (debounce no host).
O host valida o JSON com o núcleo (`core/activity.bend#frameMessage`) antes de
tocar no estado; mensagem inválida é logada como aviso e ignorada.

### 8.6 Spike de decisão (M0, sem produto)

1. Montar uma página sintética `tests/fixtures/artifact-loop.html` com
   `while(true){}` e servir por um handler local de teste.
2. Abrir num iframe dentro da janela real do app (modo teste) e medir a
   responsividade do documento pai; registrar se o app congela.
3. Repetir com um artefato que tenta: `fetch('http://127.0.0.1:<porta-probe>')`,
   `<img src="file:///etc/hosts">`, `localStorage`, `window.top.document`,
   `window.open`, `location.href='https://example.com'`, `new Worker(...)`,
   `eval('1+1')`. Um servidor local sintético conta as requisições recebidas
   (deve ser zero).
4. Guardar o resultado com os números (pids diferentes? CPU? memória?) em
   `docs/reviews/<data>/` e só então decidir inline × WebContentsView × adiar.

O resultado do spike é **pré-requisito de merge** da lane B.

---

## 9. Exportar, backup e promoção

### 9.1 Snapshot em Markdown e PDF

- `activityMarkdown(spec, state)` no núcleo produz um bloco determinístico:
  título, objetivo, valores usados, previsão/tentativa, resultado local e a
  alternativa textual (com LaTeX preservado). Botão "Copiar resumo" e uso pelo
  `export-chat`.
- **PDF (fase 1, sem imagem):** reusa o pipeline existente
  (`desk/material-pdf.cjs` + `desk/src/materials/print.*`) com o Markdown do
  snapshot: A4, KaTeX, sem conteúdo cortado — é exatamente o caminho do
  material do tutor, já provado. O botão do card diz "Salvar resumo em PDF"
  (usa `freeSaveMaterial`/`courseSaveMaterial` conforme a sessão), com
  prévia/edição pelo diálogo que já existe (`desk/src/free-study.mjs`).
- **PDF (fase 2, com imagem do gráfico):** opção "incluir figura". Aí o card
  gera um PNG do SVG (offline) e o `renderPdf` precisa aceitar assets
  **gerenciados**: `assetsRoot` com a pasta de snapshots da conversa e
  `print.mjs` chamando `markup(markdown, true)` só nesse modo. É uma mudança
  pequena mas sensível (a página de impressão hoje usa `allowAssets=false` e
  `lockSession` fecha a sessão, `desk/material-pdf.cjs:102-152`); entra com
  teste dedicado e depois do pipeline de texto.
- **Export da conversa** (`desk/main.cjs:1388` `export-chat`) hoje exporta só
  texto de user/assistant. Adicionar um apêndice "Atividades" com
  `activityMarkdown` de cada card referenciado no histórico (Pi lê o JSONL;
  Claude usa o store + mensagens). Sem tocar no texto existente.

### 9.2 Backup e promoção

- `<runtime>/activities/**` **já entra** no snapshot: o único filtro é por nome
  (`desk/src/study-data/backup.cjs:177-232`), e nem `activities/` nem o hash da
  sessão casam com as listas de negação (`.tmp` é negado, mas a gravação é
  atômica com rename, então não sobra `.tmp`).
- Estado **não** guarda caminho absoluto → a relocação de caminhos do restore
  não precisa mexer em nada; provar com um teste de ida-e-volta (§13).
- **Promoção Livre → matéria** (`free-promote`, `desk/main.cjs:1889`): a
  conversa (JSONL/descritor) **não muda de lugar** — o registro da sessão ganha
  `promotion.courseId` (`desk/main.cjs:708`, `:972`). Como o store é chaveado
  pela conversa, as atividades **sobrevivem à promoção** sem cópia. Documentar
  isso no texto da promoção ("suas atividades continuam nesta conversa").
- Compartilhar matéria (`.mesa-materia`) e backup Git não incluem conversas;
  atividades seguem o mesmo destino da conversa — nada a fazer além de nota.

---

## 10. Política do modelo (quando escolher, o que escrever)

### 10.1 Texto proposto para o prompt de sistema

Adicionar um bloco (no espírito de `TUTOR_PDF_PROMPT`, `desk/main.cjs:54`),
concatenado ao `DESK_PROMPT` (`desk/rpc.cjs:17-25`) quando as ferramentas de
atividade existirem, e ao `CLAUDE_DESK_PROMPT`
(`desk/src/agents/claude-prompt.cjs:2`):

```
Atividades interativas: quando o objetivo de aprendizagem envolver uma relação
entre parâmetros para explorar, uma previsão a testar ou uma conferência
objetiva, use a ferramenta de atividade da Mesa. Prefira o formato declarativo
(controles, expressões, gráfico, conferência). Use a simulação livre só quando
a interação não couber no declarativo. Não use atividade para recordação
(nesse caso, use o quiz), nem para enfeitar uma resposta, nem mais de uma por
resposta sem pedido explícito. Sempre inclua a alternativa textual, escreva os
enunciados, unidades e objetivos no idioma do usuário, e NÃO embuta dados
pessoais, caminhos, credenciais, links ou recursos de rede. A atividade é
explorada localmente: você não recebe nada até o usuário enviar a tentativa; não
afirme que ele respondeu nem invente o resultado. Ao receber uma tentativa,
confira com honestidade usando a unidade e a tolerância que você declarou, e
trate a conferência automática local como um indício, não como verdade.
Toda atividade vem acompanhada de um texto curto: o que experimentar, o que
prever, o que observar e o que explicar.
```

### 10.2 Matriz de decisão (para o modelo e para os testes)

| Situação | Ferramenta |
|---|---|
| Relação entre parâmetros (função, MRUV, geometria, probabilidade) | atividade declarativa |
| Previsão antes de ver o resultado | atividade declarativa (`predict`) |
| Conferência objetiva de resposta numérica/escolha | atividade declarativa (`check`) |
| Pergunta de recordação com alternativas | `quiz` (já existe; não duplicar) |
| Documento para imprimir/estudar depois | `mesa_criar_pdf` (já existe) |
| Imagem estática de gráfico | imagem via `PI_LEARNING_ASSET_DIR` (`DESK_PROMPT`) |
| Simulação com animação/canvas/arrastar | simulação livre (lane B, se ligada) |
| Explicação pura, sem interação | texto — sem ferramenta |

### 10.3 Custo e comportamento

- A ferramenta aumenta o catálogo do modelo (prompt e risco de uso indevido):
  descrição curta, exemplos no prompt e medição com `npm run profile`
  (`EXPECTED_ACTIVE`) + observação manual. Sem medição, não entra no default
  do perfil.
- O texto acompanhante é **curto por desenho**: o valor pedagógico está no
  card, não em um ensaio ao redor dele. A explicação pós-observação mora no
  `explain` da spec (revelável), não no texto da resposta.

---

## 11. Compatibilidade: principal, lateral, Livre, matéria

| Contexto | Ferramenta | Card | Persistência | Notas |
|---|---|---|---|---|
| **Principal / matéria (Pi)** | `mesa_criar_atividade` via extensão no perfil (`desk/main.cjs:516-540`) | sim, no `#messages` | store por conversa | caminho principal |
| **Principal / matéria (Claude)** | `mcp__mesa__criar_atividade` via MCP `mesa` + `allowedTools` (`claude-adapter.cjs:1953-1958`) | idem | idem | `details` não volta no cache → store indexa por `toolCallId` |
| **Livre** | mesmo caminho do principal (`piLaunch({materialTools:true})`, `desk/main.cjs:562`; Claude com `createMaterial`) | idem | store por conversa; a sessão livre tem `--no-context-files` (`desk/profiles.cjs:104`) e workspace próprio, que a atividade **não** usa | promoção não move a conversa (§9.2) |
| **Lateral (sidechat)** | **não** ganha a ferramenta agora: o motor lateral sobe por `piLaunch()` sem `materialTools` (`desk/main.cjs:674`; `desk/sidechat-engine.cjs:22`) | renderização read-only do card ainda é decisão de fase 2 | store escopado à conversa lateral quando existir | justificativa: o lateral é consulta rápida e hoje não tem material/PDF; manter o custo de contexto baixo |
| **Conversa (`chat/`)** | fora de escopo; app irmão, não embutido | — | — | o card não atravessa apps |

Gate de UI: `capabilities().activity` (novo em `core/agentcaps.bend` +
`desk/src/state.mjs:27`) liga para Pi e Claude quando as ferramentas estiverem
presentes; o renderer só trata `activity-event`/renderiza cards quando a
capacidade existir (diferente do quiz, que hoje não consulta a capacidade —
decisão a alinhar, mas fora do escopo desta rodada).

---

## 12. Integração incremental (mapa de arquivos)

### M0 — spike e fundações (sem UI)

| Item | Arquivo(s) | Prova |
|---|---|---|
| Spike de isolamento/CPU/rede | `tests/fixtures/artifact-*.html`, `tests/hunt-artifact-isolation.mjs`, servidor-probe sintético | §8.6; resultado em doc de review |
| Avaliador | `desk/src/expr.mjs`, `desk/tests/expr.test.mjs` | precedência/domínio/limites/fuzz determinístico |
| Núcleo da atividade | `core/activity.bend` + `core/laws/activity.bend` + `core/proofs/activity.bend`, registro em `core/build.mjs`, `desk/src/generated/activity.core.js` (commitado) | `npm run verify:bend` |
| Store | `desk/activity-store.cjs`, `desk/tests/activity-store.test.mjs` | atômico, leitura tolerante, caps, poda, ida-e-volta de backup |

### M1 — lane A de ponta a ponta

| Item | Arquivo(s) |
|---|---|
| Núcleo da árvore do card | `core/activityview.bend` + laws/proofs + artefato gerado |
| Núcleo do diário (novo kind) | `core/worklog.bend`, `core/worklogview.bend`, `desk/src/worklog-tags.mjs` |
| Ponte do host | `desk/activity-bridge.cjs` (padrão `tutor-materials.cjs`), `desk/main.cjs` (grant, eventos, IPCs), `desk/preload.cjs` |
| Extensão Pi | `desk/src/extensions/mesa-activity/{index.ts,client.mjs}`, perfil em `desk/main.cjs:532-537` |
| Ferramenta Claude | `desk/src/agents/activity.cjs`, servidor MCP em `desk/src/agents/tutor-pdf.cjs` (renomear para `mesa-tools.cjs` ou generalizar), `claude-adapter.cjs` (`allowedTools`, `_canUseTool`, `_preToolUse`) |
| Card e ações | `desk/src/activity.mjs`, `desk/src/activity.css` (link em `desk/index.html`), `desk/src/chat.mjs` (publicação, fallback de histórico), `desk/src/state.mjs` (capacidade) |
| Fila | `desk/src/queue.mjs` (`enqueueExternal`) |
| Núcleo/capacidades | `core/agentcaps.bend` + laws/proofs + artefatos |
| Política do modelo | `desk/main.cjs` (`ATIVIDADE_PROMPT`), `desk/src/agents/claude-prompt.cjs` |
| Testes | `desk/tests/activity*.test.mjs`, `desk/tests/hunt-activity.mjs` (Electron sintético) |

### M2 — export, backup, promoção, perfil

- `activityMarkdown` no fluxo do export (`desk/main.cjs:1388` + teste);
- PDF de texto pelo diálogo existente (nenhum código novo de PDF);
- teste de backup/promoção;
- `EXPECTED_ACTIVE`/`npm run profile`;
- acessibilidade e responsividade (temas, 310–650 px, reduzir movimento).

### M3 — lane B (se o spike aprovar)

- protocolo `mesa-artifact://` + wrapper + validação estática;
- `frame-src` na CSP do `desk/index.html:6` + `will-frame-navigate` no main;
- `desk/src/activity-frame.mjs` (iframe + postMessage com validação);
- watchdog (`app.getAppMetrics()`), "Parar atividade", pôster/skeleton;
- `desk.activityHtml` (default `false`), prompt da simulação livre;
- testes de contenção e de CPU; doc de resultado do spike.

### Estimativa (uma pessoa familiarizada com o repo)

| Bloco | Estimativa |
|---|---|
| M0 (spike + avaliador + núcleo + store) | 3–5 dias |
| M1 (lane A de ponta a ponta, Pi+Claude, testes) | 6–9 dias |
| M2 (export/backup/perfil/a11y) | 2–3 dias |
| M3 (lane B, condicionada) | 4–7 dias (fora do MVP) |
| **MVP (M0–M2)** | **11–17 dias-pessoa** |

Incertezas que puxam a estimativa: o spike (pode voltar "congela"),
a mudança do `parts` na timeline (dependência externa) e o retrabalho de
histórico do Claude.

---

## 13. Testes (sintéticos, sem dados pessoais)

Nenhum teste foi executado nesta rodada. A lista abaixo é o plano de provas,
com o nome de arquivo sugerido e o que cada um **deve** demonstrar. A suíte
alterna entre `node --test` (unidade/núcleo) e Electron headless com
`desk/tests/helpers.mjs` (UI), como o resto do app.

### 13.1 Núcleo e unidades

1. `desk/tests/expr.test.mjs` — precedência, unários, notação científica,
   domínios (`sqrt(-1)`, `log(0)`), limites (200 chars/128 nós), `^`
   associativo à direita, fuzz com semente fixa.
2. `desk/tests/activity.test.mjs` — normalização da spec (ids, caps, unidades),
   rejeição de spec sem alternativa textual, `gradeCheck` numérico/escolha
   (tolerância, "não sei"), `carryState` (compatível transporta, incompatível
   não), `activityMarkdown` determinístico (golden string), `plotPaths` (bordas,
   NaN, 1 ponto, escala invertida).
3. `desk/tests/activity-store.test.mjs` — gravação atômica, JSON torto não
   destrói, caps de 64 KB/16 KB, poda, leitura sem caminho fora de
   `<runtime>/activities`, ausência de caminho absoluto no estado.

### 13.2 Contrato e motores

4. `desk/tests/activity-bridge.test.mjs` — token por conversa, escopo mudado
   durante o await recusa, teto de bytes, payload inválido recusado sem gravar.
5. `desk/tests/activity-engine.test.mjs` — o mesmo payload publicado pelo
   caminho Pi (extensão/HTTP) e pelo caminho Claude (MCP/callback) gera a mesma
   spec normalizada e a mesma referência; `allowedTools` inclui o nome do tool;
   `details` ausente no cache do Claude não impede a recuperação (store por
   `toolCallId`).
6. `desk/tests/profiles.test.mjs` (existente) — `EXPECTED_ACTIVE` inclui a
   ferramenta; `npm run profile` sem drift.

### 13.3 UI e ordem (Electron sintético, `fake-pi`)

7. `desk/tests/activity-ui.mjs`
   - streaming `fala → atividade → fala`: ordem no DOM durante e depois;
   - recarregar a conversa (`openSession`/nova sessão sintética): card volta no
     mesmo lugar, com attempt/revealed;
   - dois cards na mesma conversa e troca de conversa: nenhum vaza;
   - placeholder → card; erro de ferramenta → nota curta;
   - teclado: slider/foco/`Esc`; `aria-live` do feedback.
8. `desk/tests/hunt-activity.mjs` (caos)
   - ferramenta cancelada no meio (placeholder vira nota);
   - reentrega do mesmo `toolCallId` (substitui, não duplica);
   - card aberto durante streaming + "levar ao tutor" → item na fila, sem
     segundo prompt;
   - conversa longa: 30 cards com render preguiçoso.
9. `desk/tests/activity-no-inference.mjs` — contador de `pi-prompt` no
   `fake-pi` permanece zero após todas as interações locais; só o botão explícito
   incrementa (e via fila).

### 13.4 Export/backup

10. `desk/tests/activity-export.test.mjs` — `activityMarkdown` no export;
    PDF de texto gera `%PDF-` com ≥ 1 página e o KaTeX presente (pdf.js já é
    dependência de teste, ver `desk/tests/*pdf*`).
11. `desk/tests/study-backup-activity.test.mjs` — snapshot com atividades,
    verify com sha256, restore em runtime novo e leitura do estado; promoção
    de sessão Livre sintética mantém as atividades na conversa.

### 13.5 Lane B (somente se ligada)

12. `desk/tests/hunt-artifact-isolation.mjs` — probe local de rede recebe zero
    requisições; `localStorage`/`window.top.document`/`window.open`/`eval`
    negados; navegação do frame bloqueada; `file://` não lido; mensagem
    `postMessage` forjada (origem errada) ignorada.
13. `desk/tests/hunt-artifact-cpu.mjs` — laço infinito: registrar se o app
    congela; se OOPIF, watchdog destrói a view e o app segue; documentar o
    resultado real (sem asserção de tempo frágil — assertar *recuperação*,
    não milissegundos).

**Nota de higiene:** todos os fixtures são texto/JSON/HTML sintéticos; nada de
PDF pessoal, sessão real, captura do Xournal++ ou `config.json` do autor.

---

## 14. Critérios de aceitação

Verificáveis por teste ou inspeção:

1. Uma atividade de MRUV permite **prever**, mover o slider, **comparar** e ver
   posição/velocidade com unidade e explicação — o fluxo do
   `mesa-interactive-proposal.html` é reproduzido sem iframe e offline.
2. Uma atividade de cálculo permite explorar um parâmetro e tentar uma resposta;
   a conferência local é rotulada como automática e mostra a tolerância usada.
3. **Toda** atividade tem objetivo de aprendizagem e alternativa textual; spec
   sem alternativa é recusada pelo host com mensagem clara.
4. Ferramenta executada **depois** de uma fala aparece depois dela ao vivo e
   **conserva a posição** ao retomar a conversa.
5. Interagir/reabrir **nunca** dispara mensagem ou inferência (contador de
   prompt igual a zero); "levar ao tutor" é ação explícita, confirmada e
   durável (fila/pending).
6. Estado não atravessa conversas; nova versão/hash não herda tentativa
   incompatível; estado incompatível não quebra o card.
7. O card funciona nos temas claro/escuro, de ~310 px a ~650 px, com teclado e
   `prefers-reduced-motion`; Ampliar não perde estado.
8. Export: markdown do snapshot e PDF de texto seguem o pipeline existente;
   backup/restore preserva atividades; promoção não perde nada.
9. Lane B (se ligada): zero requisições de rede no probe, sem leitura de
   arquivo local, sem acesso ao pai, sem Node/preload, com contenção provada e
   o resultado do spike registrado.
10. Pi e Claude publicam o mesmo card a partir da mesma spec; o histórico
    recupera nos dois, apesar de o cache do Claude descartar `details`.

---

## 15. Riscos e mitigação

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Frame inline compartilha o renderer → laço congela a Mesa | média até medir | alto | spike obrigatório (§8.6); gate da lane B; fallback WebContentsView/pôster; watchdog |
| `sandbox` sem `allow-same-origin` não bloqueia rede (crença errada) | alta se ignorado | alto | CSP `default-src 'none'` no documento + `will-frame-navigate` + teste de probe |
| "Fuga" do frame para `https:` via `location.href` | média | alto | `will-frame-navigate` no main + teste; sem `allow-top-navigation` |
| `srcdoc` herda CSP e mata o script inline | alta | médio | usar protocolo próprio; documentar (não perder tempo com srcdoc) |
| Overuse da ferramenta infla o contexto/custo | média | médio | descrição curta + política §10 + `EXPECTED_ACTIVE`/`profile` + revisão manual |
| Card no histórico perde posição (sem `parts`) | alta | médio | fallback determinístico (§7.2) + contrato de `parts` para a timeline |
| Cache Claude descarta `details` | certa | médio | store indexado por `toolCallId` desde o primeiro dia |
| Specs grandes/pesadas degradam a conversa | média | médio | caps do núcleo, render preguiçoso, placeholder + fallback textual |
| Expressão com resultado enganoso (NaN/domínio) | média | baixo | avaliador honesto + "sem valor" + testes de domínio |
| Conferência local "viciada" (tolerância larga do modelo) | média | médio | tolerância declarada e exibida; tutorial do prompt; o usuário vê; o tutor pode discordar depois |
| Acentuar/estilizar errado no tema escuro | média | baixo | CSS por variáveis do app + captura sintética nos dois temas |
| Feature quebra o portão Bend/perfil | média | médio | laws/proofs, `npm run verify:bend`, `npm run profile`, artefatos commitados |
| Promoção/backup deixar atividade para trás | baixa | médio | store por conversa + teste de ida-e-volta |
| Duplicar o quiz (dois caminhos para pergunta objetiva) | média | baixo | política §10 + teste "quiz continua sendo quiz" |

---

## 16. Perguntas abertas (decisões de produto)

1. **Lane B no MVP ou só depois?** Recomendo depois; se o usuário quiser a
   "visualização livre" já na primeira entrega, o spike vira trabalho de
   primeira linha e o MVP atrasa ~1 semana.
2. **Limite de cards por conversa** (40?) e por resposta (1?) — números que
   afetam a sensação de liberdade do tutor.
3. **Envio da tentativa**: direto pela fila (recomendado, um clique) ou
   "rascunho no composer para revisar e enviar" (mais conservador)? O mock faz
   o segundo; a fila é mais durável, mas menos inspecionável.
4. **Ampliar**: `<dialog>` no renderer (simples) ou WebContentsView (isolamento
   maior, mais uma superfície)? Recomendo `<dialog>` no MVP.
5. **Lateral**: manter sem a ferramenta (recomendado) ou dar a ela só a
   **leitura** dos cards do principal?
6. **Nota pedagógica do card**: mostrar o objetivo de aprendizagem sempre
   (recomendado) ou só na Ampliar?

---

## 17. Anexo A — exemplo de spec (MRUV, alinhado ao mock)

```json
{
  "title": "MRUV: posição com aceleração",
  "objective": "Relacionar aceleração, velocidade inicial e posição em 3 s.",
  "textAlternative": "A posição é s(t) = v0·t + ½·a·t². Com v0 = 2 m/s e a = 2 m/s², em t = 3 s resulta 15 m.",
  "predict": {"prompt": "Quanto o objeto percorre em 3 s?", "kind": "numeric",
              "unit": "m", "tolerance": 0.01, "correct": 15},
  "controls": [
    {"id": "a", "kind": "slider", "label": "Aceleração (a)", "unit": "m/s²",
     "min": 0, "max": 4, "step": 0.5, "value": 2},
    {"id": "v0", "kind": "slider", "label": "Velocidade inicial (v₀)", "unit": "m/s",
     "min": 0, "max": 5, "step": 0.5, "value": 2}
  ],
  "views": [
    {"kind": "plot", "x": {"id": "t", "min": 0, "max": 5, "unit": "s"},
     "series": [{"label": "s(t)", "unit": "m", "expr": "v0*x + 0.5*a*x^2"}]},
    {"kind": "value", "label": "s(3)", "unit": "m", "expr": "v0*3 + 0.5*a*9"}
  ],
  "check": {"prompt": "Confira sua previsão para s(3)", "kind": "numeric",
            "expr": "v0*3 + 0.5*a*9", "tolerance": 0.01, "unit": "m",
            "explanation": "Com a = 2, o termo da velocidade inicial vale 6 m e a aceleração acrescenta 9 m; total 15 m. Dobrar a aceleração não dobra a posição porque só o termo quadrático depende dela."},
  "explain": "Mover a aceleração muda a curvatura; a velocidade inicial só muda a inclinação."
}
```

## 18. Anexo B — decisões que ficam registradas (ADR curto)

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | MVP declarativo; HTML livre depois | HTML livre desde já | segurança, recuperação, offline, testes e prazo |
| 2 | Ferramenta publica e retorna | ferramenta espera o usuário (modelo do quiz) | interação local não deve segurar o motor nem o contexto |
| 3 | Mensagem guarda referência; spec no store | spec inteira no JSONL | contexto do modelo e tamanho |
| 4 | Store indexa por `toolCallId` | depender de `details` do resultado | o cache do Claude descarta `details` |
| 5 | CSP própria + protocolo `mesa-artifact://` | `srcdoc`/`file:` | CSP herdada e leitura de arquivos locais |
| 6 | `will-frame-navigate` fecha a navegação do frame | confiar no `sandbox` | sandbox não bloqueia navegação do próprio frame |
| 7 | Avaliador próprio sem `eval` | `Function`/biblioteca de eval | offline, determinístico, testável, sem superfície de código |
| 8 | "Levar ao tutor" pela fila durável | envio direto do card | respeita `busy`, fechamento do app e a guarda de recuperação |
| 9 | Fallback de histórico antes de `parts` | esperar a reforma da timeline | entrega incremental sem bloquear a prioridade |
| 10 | Lane B atrás de flag, default off | ligada por default | um artefato malicioso não pode ser o comportamento normal |

---

## 19. Validação desta rodada (o que foi e não foi feito)

- **Feito:** leitura estática do código citado (grep/sed/cat), conferência de
  `git status` (muitas mudanças locais preservadas, nada tocado por mim),
  escrita deste documento.
- **Não feito:** nenhum teste, nenhum `npm run`, nenhum app aberto, nenhum PDF
  gerado, nenhum commit/push/release, nenhuma instalação, nenhum acesso a
  dados pessoais.
- **Próximo comando sugerido para quem for implementar (a medir, não medido):**
  `cd desk && npm run verify:bend` para o portão do núcleo depois de M0, e
  `node --test tests/expr.test.mjs tests/activity*.test.mjs` para as unidades.
