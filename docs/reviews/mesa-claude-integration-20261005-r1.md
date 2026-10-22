# Revisão D — Mesa + Claude Code (snapshot em movimento)

**Papel:** revisão read-only de integração. Sem edições, commits, pushes, bundle, install, login/inferência; sem leitura de `.runtime`, `.claude`/`.pi` pessoais ou `Courses`; sem spawn de agentes; app irmão `chat/` intocado (só leitura de `chat/handoff.cjs` para conferir o contrato do bilhete).

**Método:** leitura dos arquivos do escopo + 5 arquivos de teste puros novos (`node --test`, sem build/Electron) + 3 micro-repros puros (fixture/adaptador em tmp, sem mutação do repo). Os arquivos de A/C/principal estavam sendo editados durante a revisão; cada achado abaixo foi reverificado contra o mtime indicado, às **01:02 de 05/10**.

**Evidência própria executada**
- `desk/tests/{claude-adapter,claude-environment,conversations,agent-history,agent-service}.test.mjs` → **62/62 passam** (inclui o teste de `sessionId` precriado, que já reflete a correção de A).
- Micro-repro 1 (fixture): prompt `olá Claude [claude:image]` → resposta `"Recebi 0 bloco(s) de imagem."`; prompt `segue a imagem` → `"Resposta de teste do Claude (fixture).\nVocê disse: segue a imagem"`.
- Micro-repro 2 (adaptador): `canUseTool('Bash', …)` → `{behavior:'deny', message:'ferramenta não permitida nesta versão: Bash'}`, **sem** `permission_request`.
- Micro-repro 3: `exportConversationMarkdown({engine:'claude'})` → título `## Claude` (não `## Claude Code`).
- Não rodei gates/build/`npm test`/Electron (coordenação do principal). Nada autenticado; nenhuma alegação de Claude logado.

---

## Achados adicionais (fora da lista conhecida)

### 1. [Alto para evidência] O smoke Claude não fecha com o comportamento implementado — `desk/tests/claude-ui-smoke.mjs`
O arquivo é recente (mtime 00:56) e C ainda termina UI/smoke, mas neste snapshot ele **não pode passar** e não serve de evidência. Pontos:

| # | Linha | Status | O que acontece |
|---|---|---|---|
| 1a | `:119` | **Reproduzido** | Espera `'fixture'` após o prompt `[claude:image]`; a fixture responde `"Recebi 0 bloco(s) de imagem."` (sem a palavra). O `waitForFunction` estoura 30 s. |
| 1b | `:126` | **Reproduzido** | Espera `'bloco(s) de imagem'` após o prompt sem marcador; a fixture responde `"…(fixture)…"` sem contagem. As duas esperas estão trocadas entre si. |
| 1c | `:135-143` | **Reproduzido** | `[claude:permission-allow]` chama `canUseTool('Bash')` (`fixtures/claude-sdk-fake.mjs:227`), mas o adaptador nega Bash antes de criar pedido (`ALLOWED_TOOLS`); não abre diálogo e nunca sai `'concedida'`. O 4b "negar pelo diálogo" (`:144-150`) passa pelo motivo errado (também não abre diálogo). |
| 1d | `:113` | Inspecionado | Espera `/enfileira/` no `#composer-hint` com o composer **ocioso**; a dica só cita "enfileira" quando `S.busy` (`state.mjs:303-304`; ociosa em `:305-306`). |
| 1e | `:189` | **Reproduzido** | Espera `/## Claude Code/` no export; `history.cjs:262` produz `## Claude` e `agent-history.test.mjs:140` fixa `## Claude`. |

**Correção:** alinhar fixture/marcadores (ex.: `segue a imagem [claude:image]` + esperas certas), fazer o cenário de permissão usar ferramenta permitida (ex.: `Read`) para realmente exercitar o diálogo, e decidir o rótulo do export (se for `Claude Code`, atualizar `history.cjs` e `agent-history.test.mjs:132-142` juntos). Depois rodar `npm run test:claude-ui`.

### 2. [Médio] Rótulo "Pi está pensando…" em conversa Claude — `desk/src/chat.mjs:587`
- **Trigger:** qualquer turno Claude com o diário aberto (a `paintLive` roda a cada 1 s e cai no fallback).
- **Impacto:** a faixa de atividade mostra "Pi está pensando…" numa conversa Claude Code — contradiz o trabalho de `agentLabel`.
- **Correção:** `` `${S.agentLabel} está pensando…` `` (o caminho com passo já usa `worklog.liveLabel`).
- **Status:** inspecionado.

### 3. [Médio] Auto-conexão Claude sempre ocorre — `desk/src/main.mjs:473` e `:509`
- **Trigger:** boot ou salvar Configurações numa conversa Claude, mesmo **sem** binário Claude.
- **Causa:** o host manda `detectedClaude` como caminho ou `''` (`desk/main.cjs:214`); `data.detectedClaude!==false` é sempre verdadeiro (o `false` nunca chega). O comentário do próprio código diz "a conversa Claude segue a mesma regra com o executável detectado".
- **Impacto:** tentativa de conexão + toast de erro (`CLAUDE_NOT_FOUND`/login) no boot/save; no Pi, `detectedPi` vazio não conecta.
- **Correção:** usar a veracidade (`data.detectedClaude`) ou o host devolver `false` quando não houver binário.
- **Status:** inspecionado.

### 4. [Médio] Descritor inteiro (até ~12 MiB) relido em caminhos quentes — `desk/main.cjs:829` (+ `:781`) e `:260`/`:242-220`
- **Trigger A:** `pi-health` a cada 15 s enquanto conectado espalha `conversationData()`, que inclui `messages` (`:214`) — leitura + `JSON.parse` do descritor e envio IPC de vários MiB por poll, sem que o renderer use `messages` no health.
- **Trigger B:** `save-state` (debounce de 400 ms em `state.mjs:150`) → `persist()` (`:260`) → `courseSessions()` (`:242`) → por sessão `sessionInfo` (`:216`) faz `conversationEngine` + `readClaudeConversation`; para a ativa, ainda `previewFile` (`:238`) — até 3 parses completos. Histórico grande = travadas ao digitar.
- **Impacto:** custo de CPU/IO/IPC crescente com o histórico; o Pi não tinha esse custo (lê só 200 KB do JSONL).
- **Correção:** leitor de metadados sem `messages` para health/config/`courseSessions` (e cache em memória do descritor ativo); manter `messages` só em `init`/`pi-connect`/`new-session`/`open-session`/`switch-course`.
- **Status:** inspecionado.

### 5. [Médio-baixo] Bilhete da Conversa fica pendente sem aviso em conversa Claude — `desk/main.cjs:871`
- **Trigger:** a Conversa escreve `conversa.json` com uma conversa Claude ativa; o usuário envia mensagens.
- **Causa:** `bilhete=engine()==='pi'?claimHandoff():null`; `handoff` é `false` em `claudeCaps` (`core/agentcaps.bend:67-71`), mas nenhuma UI consulta `supportsCapability('handoff')` e `onHandoff` (`preload.cjs:238`) só dispara quando o bilhete é reivindicado.
- **Impacto:** o requisito do plano (§6) "mantém bilhetes pendentes no disco **e informa a indisponibilidade**" não é cumprido — o bilhete espera em silêncio até uma conversa Pi.
- **Correção:** peek não-reivindicador (`pendentePath`/`readHandoff`) no caminho Claude do `pi-prompt` e aviso (toast/faixa) de que o bilhete será entregue quando uma conversa Pi assumir; o arquivo continua pendente.
- **Status:** inspecionado.

### 6. [Baixo] Toast duplicado de fila segurada em erro de turno Claude — `chat.mjs:687-692` + `:668-681`, `queue.mjs:27-32`
- **Trigger:** `result` de erro com fila não vazia: o adaptador emite `error` e depois `turn_end` (`claude-adapter.cjs:1342-1355`); `desk_error` e `agent_settled{isError}` disparam `desk-failed`, e `holdQueue` toasta toda vez com motivo.
- **Impacto:** dois avisos "a fila ficou guardada" (cosmético).
- **Correção:** só tostar na transição para `held` (ou não tostar se `held` já era true).
- **Status:** inspecionado.

### 7. [Baixo] Descritor gerenciado corrompido ainda derruba listagem/boot — `desk/main.cjs:216-220` / `conversations.cjs:364-372`
- **Trigger:** `claude-*.json` existente e inválido (edição manual/interrupção externa; as escritas do app são atômicas).
- **Causa:** `sessionInfo` chama `engine(file)` → `conversationEngine` lança `CLAUDE_DESCRIPTOR_INVALID`; `courseSessions()` (usado por `init` e `persist`) propaga. O fallback novo de `:219` (`'Conversa indisponível — arquivo preservado'`) é inalcançável para corrompido, porque `kind==='claude'` só sai de leitura válida.
- **Impacto:** `init` rejeita e o app abre sem dados; `persist` também falha. A intenção "nunca vira Pi calado" é correta, mas a listagem poderia degradar para um item inválido.
- **Correção:** em `sessionInfo`/listagem, capturar o código de corrupção e marcar o item como indisponível (sem reclassificar como Pi nem apagar), mantendo o lançamento para operações da conversa.
- **Status:** inspecionado.

---

## Itens conhecidos: o que já mudou durante a revisão (reconferir no congelamento)
O snapshot andou muito entre 00:50 e 01:01; para o principal não gastar esforço no que A já fechou:
- `_buildOptions` agora usa `options.sessionId`/`options.resume` (`claude-adapter.cjs:1055-1056`) e `base.DISABLE_AUTOUPDATER='1'` (`:1067`).
- Persistência de entrega: `_record` grava status (incl. `accepted`/`uncertain`) e `_finalizeTurn` emite `turn_end{uncertain}` (`:771-784`, `:820-849`, `:970-975`); `persistDelivery` do host cobre todos os status (`main.cjs:375`).
- `setToolPolicy` existe e o host o chama antes do prompt (`adapter:498`, `main.cjs:886-887`) — o caso "readPaths copiados" parece endereçado.
- Correlação de aceite agora é avaliada em **toda** mensagem, incluindo `stream_event` (`:1133-1173`) — o carimbo `user_message_uuid` do primeiro stream event deixou de ser ignorado.
- Ainda aberto pelo que inspecionei: o host **não persiste** o `sessionId` do `init` no descritor (`main.cjs:379` só grava modelo/executável) — a divergência de ID nativo continua possível de não ser reconciliada; e o AskUserQuestion estruturado segue sem UI (negação clara no adaptador, mas o diálogo de texto ainda aparece).

## Regressão Pi (inspeção)
Nenhuma regressão funcional encontrada nos caminhos revisados: capacidades default `true` para Pi (`state.mjs:27-32`); identidade de evento agora sempre presente (host injeta `conversationId`, `main.cjs:398`) e o renderer só descarta evento de outra conversa; `agent_settled` do Pi não traz `cancelled/isError/uncertain`, então fila/idle continuam como antes; o fechamento de diálogo por `_requestId` não tem caminho Pi que troque `currentDialog` entre abrir/fechar; `desk-held` só dispara em `cancelled&&!aborted` (Pi não emite); `enqueueFromComposer` só age sem `steer` (Pi tem steer). Ressalvas: o custo do achado 4 vale para o app inteiro, e o achado 7 (descritor corrompido) pode impedir boot/persist de qualquer usuário. As evidências do principal (432 unitários, `verify:bend`, session-switch fakePi) são aceitas como relatadas, não reexecutadas.

## Limites desta revisão
- Read-only; sem gates/build/`npm test`/Electron; sem `.runtime`, `.claude`/`.pi`, `Courses`; sem login/inferência. Os testes puros usaram tmp do sistema.
- Snapshot móvel: adaptador 00:50→01:01, `service.cjs` 00:55, `main.cjs` 00:58, smoke 00:56; achados verificados às 01:02 — **reconferir após o congelamento de A/C**.
- A fixture honra `options.sessionId`/`isReplay`; por isso os testes não pegam divergência de ID nativo nem o ack real. `getSessionMessages` real, imagem/PDF/permissões/retomada e assinatura seguem sem validação autenticada. Nada aqui alega Claude funcionando.

## Critérios propostos para a rodada final
1. **A (congelar):** testes do adaptador verdes com persistência de `accepted/uncertain/refused/settled`, `sessionId`/`resume`, correlação em `stream_event`, `setToolPolicy`, negação clara de AskUserQuestion e limpeza de timers/turnos; atualizar `docs/CLAUDE-TRANSPORT-EXPERIMENTAL.md` (lista de capacidades e carimbo no stream event).
2. **C:** corrigir os 5 pontos do smoke (achado 1), rodar `npm run test:claude-ui` verde provando: descriptor JSON, **zero processo Pi** via trap, permissões permitir/negar/cancelar, reabertura/export e incerteza sem retry; rótulo do export consistente com `agent-history.test.mjs`.
3. **Principal:** `npm test` completo (432 + novos) e `npm run verify:bend` (incluindo provas `agentcaps`/`agentdelivery`), `syntax-check` com `agents/`; regressões Pi (session-switch/ui-smoke/hunts pertinentes); reconferir achados 2–7.
4. **Transporte real:** repetir o probe isolado (sem login/inferência) e confirmar que a factory do SDK só entra com `DESK_TEST` + fixtures.
5. **Fase 4 autenticada continua do usuário** (imagem, PDF, permissão, cancelamento, retomada); nenhuma conclusão de "Claude com assinatura" antes disso.
