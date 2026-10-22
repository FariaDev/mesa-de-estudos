# Revisão independente r4 — correções F1–F5 do context/tutor/resume (2026-10-07)

Escopo: revisão READ-ONLY da rodada de correção de `codex-plugin/mesa-study`
(source `0.2.2-experimental`; cache instalado
`~/.codex/plugins/cache/mesa-study-local/mesa-study/0.2.1-experimental`
permanece intocado). Sem editar implementação, sem commit/push/install, sem
reiniciar app, sem inferência/captura, sem filhos/agentes, sem ler material
pessoal: fixtures sintéticas em `/tmp/mesa-r4-review` (removidas ao fim).
Leitura: `server/bounded.mjs`, `server/profiles.mjs`, `server/persistence.mjs`,
`server/tools.mjs`, `server/checks.mjs`, `server/config.mjs`, `server/index.mjs`,
`server/CONTRACT.md`, `scripts/doctor.mjs`, `scripts/prepare-local.mjs`,
`skills/mesa/SKILL.md`, `ui/desk.html`, testes. Correções verificadas por
reprodução própria, não só pelos testes do autor.

## Veredito

**Aprovado para empacotamento/instalação local.** O blocker F1 está corrigido e
F2–F5 estão corrigidos. Nenhum blocker novo. A suíte completa passa:
`npm test` → **172 testes, 172 pass, 0 fail, 0 skipped** (6,3 s), contra 159 do
estado pré-correção; foco perfis+checkpoint → **28/28**. (Esses números são da
revisão conferida; durante a sessão o root editou `ui/desk.html` — escopo dele —
e o tree atual diverge; ver “Testes assinados”.) O resíduo de TOCTOU do
Node portátil continua documentado (não se promete fechar toda corrida global de
filesystem), e três observações não bloqueantes ficam registradas ao fim.

## F1 (era BLOQUEADOR) — candidato confinado por lexical + realpath antes de lstat/classificar — RESOLVIDO

Local: `server/persistence.mjs:296-357` (`evaluateCandidate`).

Ordem implementada: `checkpoint.page.path` → `path.resolve` (lexical) →
`inspectRoots` + confinamento lexical contra as raízes congeladas válidas (sem
IO) → `realpath` → confinamento do resolvido → **só então** `lstat` +
classificação (`symlink`/não-arquivo → `path-invalid`, extensão `.pdf` do
caminho resolvido). `document.path`/`name` saem de `lexicalPath` quando a recusa
é lexical e do caminho resolvido depois disso.

Verificação independente (fixtures sintéticas reais; `lstat` instrumentado):

| Caso | Resultado |
|---|---|
| `<root>/../fora/alvo.pdf` (textual) | `available:false`, `reason:'outside-roots'`, **0 lstat** de caminho externo |
| `<root>/atalho/alvo.pdf` com `atalho` symlink de dir para fora | `available:false`, `reason:'outside-roots'`, **0 lstat** |
| `<root>/folha.pdf` symlink de ARQUIVO para fora (extra) | `available:false`, `reason:'outside-roots'`, **0 lstat** |
| `<root>/sub/../doc.pdf` normalizado | `available:true`, `reason:'ready'`, `document.path` = realpath, único lstat = caminho já confinado |
| `nota.txt` dentro da raiz | `available:false`, `reason:'not-pdf'` |
| inexistente | `available:false`, `reason:'path-missing'` |
| sem página | `available:false`, `reason:'no-page'` |

Integração: o mesmo caminho `..`/symlink recusado pelo `mesa_page` via host →
`PATH_OUTSIDE_ROOTS` (conferido também direto em `host/paths.mjs` com
`resolveAuthorizedFile`). Testes do autor: `tests/mcp-persistence.test.mjs:588-680`
(candidato) e `:655` (integração com `mesa_page`), passando. Aceite cumprido:
confinamento antes de `lstat`, sem `lstat` fora das raízes, caminho/extensão do
resolvido, válido continua `ready`.

## F2 (MÉDIO) — leitura limitada de verdade (perfis runtime/startup e checkpoint) — RESOLVIDO

Local: `server/bounded.mjs` (novo, 240 linhas), consumido por
`server/profiles.mjs:87,112` e `server/persistence.mjs:175-228`.

Garantias verificadas por reprodução própria com IO injetado determinístico:

- **Teto real**: leitura via descritor no máximo `maxBytes+1`. Crescimento no
  sync → `oversize` com 9 bytes aceitos para `maxBytes=8` e corpo ausente;
  crescimento no async → `oversize`; arquivo real de 10 MiB com `maxBytes=1024`
  → `oversize` **sem nenhuma leitura** (tamanho do fstat já recusa).
- **Troca na janela**: lstat→open com dev/ino divergente → `changed`, **0
  leituras**, sem corpo; fstat pós-leitura divergente → `changed`, sem corpo;
  leaf que vira symlink no fim → `changed`; realpath que "pisca" (volta
  diferente do primeiro) → `changed` sem congelar o destino intermediário.
- **Canônico antes do conteúdo**: em runtime, `allowCanonical` recusa antes do
  `open` (0 opens e 0 leituras) quando o realpath ≠ congelado.
- **Startup não congela destino de symlink em corrida**: variantes testadas
  (fstat divergente; `O_NOFOLLOW`→ELOOP; realpath flip-flop) → `symlink`/`changed`,
  `canonical:null` — o destino da corrida nunca vira identidade congelada.
- **Edição normal preservada**: troca atômica (rename por cima) de perfil
  regular entre chamadas → `ready` com o texto novo e o mesmo canônico;
  arquivo estável real → `ready` (inclusive UTF-8 não-ASCII).
- **Sem `readFile` de arquivo inteiro em produção**: `grep` em `server/` mostra
  perfis/checkpoint usando só `bounded.mjs` (`open`/`fstat`/`read`/`close`);
  `png.mjs`/`ui.mjs` têm `readFile` de outros escopos (imagem/HTML), fora do
  aceite do F2. `config.mjs:125` usa `inspectProfilePathSync` (limitado) e o
  caminho do checkpoint usa `inspectStatePathSync` (só lstat/realpath, sem
  conteúdo).

Testes do autor: `tests/mcp-profile.test.mjs:296-484` (8 novos: corrida de
symlink, teto, realpath flip-flop, gate de canônico antes do open, trocas
lstat→open e durante a leitura, happy path) e
`tests/mcp-persistence.test.mjs:740-791` (teto do checkpoint + troca de
identidade sem leitura), passando. Limitação portátil declarada no cabeçalho de
`bounded.mjs` e no CONTRACT (sem `openat`/dirfd). Aceite cumprido.

## F3 (BAIXO) — cache inseguro não lê checkpoint nem forma candidato — RESOLVIDO

Local: `server/tools.mjs:279-297` (`loadState`, gate `inspectCacheDir`) e
`:366-379` (`currentResumeCandidate`) + `:313-345` (`persistenceDescriptor`).

Verificado com fixture real: startup aceita o cache; depois `chmod 0777` no
cache e checkpoint com JSON inválido (canário) → `mesa_context`:
`resumeCandidate {available:false, state:'cache-unavailable',
reason:'cache-unavailable', error STATE_CACHE_UNAVAILABLE}`,
`persistence {available:false, state:'cache-unavailable', present:false}`;
`action=set` → `saved:false` + `CACHE_DIR_PERMISSIONS` (honesto). Nenhum parse
de `invalid` aparece — o gate retorna antes de `loadCheckpoint`, portanto o
checkpoint não é lido. Teste do autor:
`tests/mcp-persistence.test.mjs:694-738`, passando. Aceite cumprido.

## F4 (BAIXO) — nota sobrevive ao render explícito do MESMO doc+página — RESOLVIDO

Local: `server/tools.mjs:381-427` (`persistActiveCheckpoint`): funde a página
guardada quando o processo não tem página e funde a nota só quando
`note === null` **e** página guardada e página nova batem exatamente em
`path`+`page`; a página nova vem do render já validado pelo host, logo o
candidato é necessariamente válido.

Verificação independente (Poppler real, PDF sintético, múltiplos processos
in-process com MCP real):

1. Processo 1: render pág. 2 + `set note:'retomar daqui'` → checkpoint
   `{page:{doc.pdf,2}, note:'retomar daqui'}`.
2. Processo 2 (nota ativa nula): render explícito do MESMO doc+página →
   `storedNote:'retomar daqui'` preservada; `context.note` continua `null`
   (a nota não vira ativa) e `context.capture` continua `null` (nada
   restaurado). Imagem `mesa_open` do mesmo pedido conta como render (skill),
   sem render duplicado.
3. Outra PÁGINA do mesmo doc → `note:null` (não herda).
4. Outro DOCUMENTO → `note:null` (não herda).
5. Processo extra com nova nota + render do mesmo doc+página → nota preservada.
6. `action=clear` remove só o checkpoint (`cleared:true, removed:true`).

Teste do autor: `tests/mcp-persistence.test.mjs:793-886` (reinício/render,
outra página, outro doc, clear), passando. Aceite cumprido.

## F5 (BAIXO, doc) — códigos `STATE_CACHE_*` listados — RESOLVIDO

`server/CONTRACT.md:183-186` agora lista `STATE_CACHE_SYMLINK`,
`STATE_CACHE_NOT_DIRECTORY` e `STATE_CACHE_UNAVAILABLE` com a origem ("os dois
primeiros vêm da recusa do cacheDir em `saveCheckpoint`/`clearCheckpoint`; o
último do diagnóstico/gate de cache"). Alcance confirmado na superfície real:
cache trocado por symlink em runtime → `clear` devolve `STATE_CACHE_SYMLINK` e
`mesa_context` devolve `STATE_CACHE_UNAVAILABLE`; cache trocado por arquivo →
`clear` devolve `STATE_CACHE_NOT_DIRECTORY`. O CONTRACT também documenta a
ordem do F1, a leitura limitada do F2, o gate do F3, a fusão de nota do F4 e o
resíduo TOCTOU.

## Regressões e contrato público (conferidos)

- **7 ferramentas, só `mesa_open` com template**: `TOOL_DEFS` = 7; apenas
  `mesa_open` tem `_meta`; teste `tools/list` da suíte passa.
- **Sem flags, nada de perfil/checkpoint**: default `studyProfile` não
  configurado e `stateFile:null`; `mesa_status` não cria cache; nenhum arquivo
  extra lido/gravado (`mcp-persistence`).
- **UI/protocolo**: na revisão conferida, diff de `ui/desk.html` contra o
  instalado 0.2.1 = só o snapshot de `captureRequest` no envio da ajuda (6
  linhas), nenhuma automação de retomada/perfil/captura e 43 testes de UI
  cliente passando; na versão atual o root está no meio de uma refatoração de UI
  (fora do escopo) e os testes de UI ainda não acompanharam — ver “Testes
  assinados”. O fato server-side que importa (7 ferramentas, só `mesa_open` com
  template, recurso único) não depende do conteúdo do HTML e segue verificado.
- **Root (fora do meu escopo, só verificado)**: skill confere
  `resumeCandidate.available`, orienta preservar a nota antes do render e diz
  que a imagem de `mesa_open` do mesmo pedido vale sem render duplicado;
  instruções do servidor dizem que perfis são preferência, não substituem
  instruções do hospedeiro; `package.json`/`.codex-plugin/plugin.json`/README em
  `0.2.2-experimental`; `.mcp.json` encaminha as 7 envs.
- **Exports**: `server/index.mjs` mantém a superfície estável; `bounded.mjs` não
  é reexportado. Em relação ao 0.2.1 instalado, `index.mjs` ganha os exports já
  documentados de `profiles`/`persistence` (feature deste trabalho). Mudanças de
  costura internas (não documentadas como API): `loadCheckpoint` passou a usar
  `{io}` (era `{readFile,lstat}`) e `evaluateCandidate` ganhou
  `realpath`/`io`; helpers de perfil esperam `open/fstat/read/close`.
- **Parity**: hashes da cópia continuam incondicionais (12 arquivos +
  `capture.mjs` em `manifest.adjusted`), comparação com a origem mutável segue
  opt-in (`MESA_VERIFY_SNAPSHOT_ORIGIN=1`); a origem atual de `config.mjs`
  divergiu (o host em `claude-mod` mudou), então a rodada opt-in falharia por
  desenho — a cópia empacotada é que está íntegra.
- **Staging/doctor**: `scripts/prepare-local.mjs` copia a pasta `server/`
  inteira; o teste de integração `tests/integration-stage.test.mjs` sobe o
  pacote preparado (que importa `profiles`→`bounded`) com as 7 ferramentas e
  render real — prova que o helper novo entra no pacote. Doctor/prepare-local
  espelham a aceitação e passam.

## Testes assinados

- `cd codex-plugin/mesa-study && npm test` → **tests 172 / pass 172 / fail 0 /
  skipped 0** (6,3 s). Rodada duas vezes, mesmo resultado.
- `node --test tests/mcp-profile.test.mjs tests/mcp-persistence.test.mjs` →
  **28/28** (13 perfil + 15 checkpoint).
- **Edição concorrente do root no meio da revisão**: após os checks, o root
  reescreveu `ui/desk.html` (mtimes 22:26–22:29) sem atualizar
  `tests/ui-client.test.mjs` (mtime 20:11). Re-execuções durante essa edição dão
  resultados instáveis — 167/172 (5 falhas) e, numa janela em que o arquivo foi
  capturado no meio da escrita, 140/172; **todas as falhas são em
  `tests/ui-client.test.mjs`** (capability/fullscreen/zoom/ajuda) e cobrem só
  arquivos root-owned fora do meu escopo server; nenhum arquivo server mudou
  depois de 21:20. O root precisa fechar a edição de UI, ajustar os testes de UI
  e re-assinar a suíte antes de empacotar.
- Reproduções independentes (não são testes do repo), em `/tmp/mesa-r4-review`
  (fixtures sintéticas, removidas): F1 (matriz lexical/realpath), F2 (teto,
  trocas lstat→open→read, flip-flop de realpath, edição atômica, gate de
  canônico), F3 (0777), F4 (6 processos), F5 (3 códigos), host
  (`PATH_OUTSIDE_ROOTS` para as duas variantes).

## Observações não bloqueantes

1. **`readFile` morto no seam de injeção** —
   `scripts/doctor.mjs:300-304` e `scripts/prepare-local.mjs:283-287` ainda
   montam `profileIo` com `readFile`, mas `bounded.mjs` não consulta mais essa
   chave (usa `open/fstat/read/close`); com filesystem real o comportamento
   está correto e os testes passam, mas um teste futuro que quisesse injetar
   conteúdo por `readFile` não teria efeito. Limpeza opcional do root
   (fora do meu escopo).
2. **Falso-negativo lexical conservador** — um `page.path` cujo lexical escapa
   do canônico congelado mas cujo `realpath` cai dentro (ex.: `/tmp/...` vs
   `/private/tmp/...`) é recusado como `outside-roots` antes do realpath.
   Checkpoints legítimos gravam o realpath de `host/page.mjs:267`, então o
   fluxo normal não é afetado; a recusa conservadora é segura. Registro para
   honestidade, não é defeito.
3. **Resíduo TOCTOU portátil** — sem `openat`/fd de diretório, uma troca de
   diretório-ancestral entre o confinamento e o `lstat` não é fechada; está
   declarado em `bounded.mjs` e no CONTRACT. Não prometer fechamento global.

## Ambiente e integridade

- Esta revisão só escreveu este relatório. O repositório teve atividade
  CONCORRENTE do agente root durante a sessão: `.local-smoke/mesa-context-final-check-*`
  (22:09) e `.local-smoke/mesa-context-final-install-*` (22:10) e a reescrita de
  `ui/desk.html` (22:26–22:29) — nenhuma dessas é escrita minha (o `find` das
  22:18 ainda estava vazio e os arquivos server-owned não mudam desde 21:20).
  Trabalho sujo não relacionado (`desk/`, `core/`, `chat/`, `claude-mod/`,
  `visual-check/`, bundle instalado, docs) preservado.
- Cache instalado `0.2.1-experimental` intocado: versão 0.2.1, sem
  `server/profiles.mjs`/`persistence.mjs`/`bounded.mjs`, mtimes anteriores à
  rodada de correção (11:45 de 2026-10-07).
- Sem install, inferência, captura real, commit, push, restart, agentes filhos.
  Poppler local usado apenas com PDFs sintéticos; captura só no teste
  simulado da suíte.
