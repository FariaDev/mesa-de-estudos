# Auditoria: existe expiração de 7 dias no histórico de conversas Mesa/Pi?

Data: 2026-10-07 · Branch: `codex/mesa-backup-study-tools` · Autor: subagente Mesa (escopo
estatísticas/Caderno/histórico).

## Veredito

**Não existe regra que apague ou filtre conversa por idade (7 dias ou qualquer
outra) no Mesa, no Pi ou no overlay.** O histórico de sessões continua inteiro no
disco e na lista, inclusive com muitos meses.

Existe **uma** regra de 7 dias diferente, no overlay do Pi (fora deste
repositório): ela apaga a **nota-espelho de estudo** (`type: learning-render-cache`,
"Temporary Math Mirror") e os *assets* dela em `Courses/<matéria>/Sessions/` —
cache de render, **não** histórico de conversa. Nada foi alterado: os arquivos
do overlay são globais e a decisão é do root (seção "O que fazer").

## Evidência (executada agora, 2026-10-07)

### 1. Sessões reais com mais de 7 dias continuam no disco

```sh
find ~/.pi/agent/sessions -name "*.jsonl" -mtime +7 | wc -l   # 78
find ~/.pi/agent/sessions -name "*.jsonl" | wc -l             # 107
find ~/.pi/agent/sessions -name "*.jsonl" -exec stat -f "%m %N" {} \; | sort -n | head -3
# → 2026-07-12, 2026-07-13, 2026-07-14 (quase 3 meses)
```

Um filtro/limpeza de 7 dias teria apagado esses 78 arquivos. Eles estão lá.

### 2. O Pi NÃO filtra por idade ao listar

Teste novo `desk/tests/study-history-retention.test.mjs` (passa): cria uma
sessão sintética de 40 dias num diretório temporário e chama o próprio
`SessionManager.list` do Pi instalado — a sessão velha e a recente voltam as
duas, sem corte.

### 3. A Conversa agrupa o antigo em "Anteriores" em vez de sumir

`chat/src/sessions-view.mjs` (`WEEK = 7 * DAY` na linha 12, `startWeek` na 52,
`key = 'older'` na 65 e `week` na 69) **rotula** a semana; o que é mais velho cai
no grupo "Anteriores" e continua listado. O teste cobre isso com uma sessão de
30 dias.

### 4. O Mesa lista tudo que existe no disco

`desk/main.cjs#courseSessions` (linhas 361–373) filtra só por `fs.existsSync` e
ordena por `started` — nenhuma comparação com `Date.now()` além do fallback
quando a sessão não tem data no nome. `desk/lib.cjs#sessionStartedFromPath`
(linhas 75–76) lê o começo do nome do arquivo (`/pi-(\d+)\.jsonl$/`) e
`formatSessionLabel` (129) só monta o rótulo. Sessão antiga aparece com a data
dela; nada é escondido.

### 5. A regra de 7 dias que existe (overlay do Pi, fora do repositório)

| Arquivo (global) | Linha | O que faz |
|---|---|---|
| `.pi/lib/learning-artifacts.ts` | 23 | `export const RENDER_CACHE_DAYS = 7;` |
| `.pi/lib/learning-artifacts.ts` | 216 | `cleanupExpiredLearningArtifacts(courseRoot, now, currentSessionId)` |
| `.pi/lib/learning-artifacts.ts` | 222 | `cutoff = now - RENDER_CACHE_DAYS * 24 * 60 * 60 * 1000` |
| `.pi/lib/learning-artifacts.ts` | 241 | `rmSync(file)` — só para `Sessions/*.md` com frontmatter `type: learning-render-cache` e identidade de sessão válida, mais velho que o corte, e nunca a sessão atual |
| `.pi/lib/learning-artifacts.ts` | 258 | `rmSync(directory, {recursive: true})` — só diretórios de asset com marcador `learning-render-assets` |
| `.pi/extensions/learning-session.ts` | 169 | chama a limpeza no `session_start` |
| `.pi/extensions/learning-session.ts` | 130 | rótulo de status "7-day cache" |
| `.pi/lib/learning-core.ts` | 111 | `retention_days: 7` no frontmatter da nota gerada |

O que essa limpeza **não** toca: `~/.pi/agent/sessions/**/*.jsonl` (conversas),
`runtime/review.json`, `runtime/study-stats.json`, `runtime/review-schedule.json`
nem qualquer arquivo fora de `Courses/<matéria>/Sessions/`. As linhas 136/140/457/469
do mesmo arquivo são limpezas de render temporário (aliases `.pdf`), não de
conversa.

### 6. Nenhuma outra regra nos overlays/políticas globais

Varredura em `~/.pi/agent/extensions/*` (`observational-memory`, `context-mode`,
`subagents`, `workspace-guard`, `mcp-policy`, `harness.json`) não achou poda de
sessão por idade; os únicos `prune`/`cleanup` são de estado local de UI/subagente.
O "7 dias" que aparece em `desk/tests/claude-lifecycle-ui.mjs` e em
`desk/src/agents/claude-adapter.cjs` (`seven_day`, `seven_day_opus`, …) é a
**janela de limite de uso do Claude** — não apaga nem filtra histórico.

## O que fazer

- **Histórico de conversa:** nada. A suspeita não se confirmou; não há código a
  remover. (A instrução "remover apenas chats" só se aplicaria se houvesse
  apagar/filtro por idade de chat — não há.)
- **Nota-espelho de 7 dias (overlay):** decisão do root. Se quiser que as notas
  "Temporary Math Mirror" durem mais, é uma linha em
  `.pi/lib/learning-artifacts.ts` (`RENDER_CACHE_DAYS`, linha 23). Não foi
  alterada por ser arquivo global. **Não** mexer nisso por causa do pedido de
  expiração de histórico: é cache de render, e os TTL/permissões/janelas que o
  pedido manda preservar continuam valendo.
- **Prova viva:** `desk/tests/study-history-retention.test.mjs` fica no portão
  comum (`npm test`) para a regressão não voltar calada.

## Testes

```sh
cd desk
node --test tests/study-history-retention.test.mjs
# 5 testes: Pi lista sessão de 40 dias; Conversa joga a de 30 dias em
# "Anteriores"; Mesa lê o começo antigo; nenhuma remoção por idade no host;
# nenhuma política de expiração no repositório.
```
