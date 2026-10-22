# Revisão independente — context/tutor/resume do plugin Codex Mesa (2026-10-07)

Escopo: revisão READ-ONLY do estado ATUAL de `codex-plugin/mesa-study` (source
0.2.2-experimental; installed cache `~/.codex/plugins/cache/mesa-study-local/mesa-study/0.2.1-experimental`
intocado). Sem editar implementação, sem commit/push/install/restart, sem
inferência/captura, sem ler material pessoal: apenas fixtures sintéticas em
`/tmp`. Leitura: `server/profiles.mjs`, `server/persistence.mjs`,
`server/tools.mjs`, `server/config.mjs`, `server/checks.mjs`, `server/state.mjs`,
`server/CONTRACT.md`, `scripts/doctor.mjs`, `scripts/prepare-local.mjs`,
`skills/mesa/SKILL.md`, `ui/desk.html`, testes relevantes.

Suíte no estado atual: `npm test` → **159 testes, 159 pass, 0 fail** (6,7 s).
Isso já inclui o ajuste da raiz no gate de snapshot (ver "Verificado bom").
Repros sintéticos deste relatório: `evaluateCandidate` com checkpoint
adulterado; corrida lstat→readFile em perfil; cacheDir 0777 × candidato.

## Veredito

Não há blocker para os invariantes centrais do pedido (7 ferramentas, único
render `mesa_open`, sem Pi/inferência, sem reabertura automática, sem captura
automática, default sem persistência, estado atômico 0600 só com referências,
UI protocol inalterado). Há **1 defeito de validação do candidato de retomada**
que quebra o contrato declarado (corrigir antes de empacotar/instalar) e
3 achados menores (corrida de identidade/leitura de perfil, inconsistência de
diagnóstico cache×candidato, nota apagada em render pós-restart) + 1 lacuna de
documentação de códigos.

## F1 — `evaluateCandidate` não resolve realpath: `available:true` para caminho fora das raízes (ALTERO / bloqueador do aceite declarado)

- Evidência: `server/persistence.mjs:317-330` — `docPath` é usado cru
  (`checkpoint.page.path`) e o confinamento é textual:
  `state.valid.some((root) => isInsideRoot(docPath, root))` em
  `server/persistence.mjs:328`, sem `realpath`. `path.basename` (linha 318) e
  `path.extname` (linha 340) também usam o caminho cru.
- Contrato violado: `server/CONTRACT.md:80-83` ("`resumeCandidate` só é
  `available:true` se o documento ainda cai numa raiz congelada válida… senão
  devolve `available:false` com `reason` (`…outside-roots…`)") e o comentário
  do módulo (`server/persistence.mjs:298-303`). Um checkpoint adulterado
  (o próprio módulo assume tamper como ameaça: allowlist em
  `server/persistence.mjs:112-118`) pode gravar `page.path` escapando por
  `..` textual ou por symlink de DIRETÓRIO dentro da raiz.
- Reprodução sintética (ambas confirmadas em `/tmp/mesa-review/repro-*`):
  - `page.path = <root>/../fora/alvo.pdf` (string crua; `validateCheckpoint`
    só exige absoluto/≤`MAX_PATH_CHARS`): `evaluateCandidate` →
    `available:true, reason:'ready'`; `mesa_page` com o mesmo caminho →
    `PATH_OUTSIDE_ROOTS` (host resolve realpath em `host/paths.mjs`).
  - `page.path = <root>/atalho/alvo.pdf` com `atalho` symlink de diretório
    para fora: `evaluateCandidate` → `available:true, reason:'ready'`;
    `realpath` do documento = fora da raiz; `mesa_page` recusaria.
- Impacto: diagnóstico desonesto (`resumable:true` para retomada que
  `mesa_page` recusa), instrução enganosa ao modelo via skill ("inspecione o
  caminho/página candidato e renderize"), e `lstat`/leitura de metadados de
  caminho arbitrário fora das raízes a partir de checkpoint adulterado (oráculo
  de existência/tipo; nenhum byte de PDF é lido e o render continua recusando —
  não há leitura não autorizada). Checkpoints legítimos gravam o realpath de
  `pageOperation` (`host/page.mjs:188,267`), então o defeito é de validação de
  entrada não confiável, não de operação normal.
- Aceite: em `evaluateCandidate`, resolver o realpath do documento antes do
  confinamento (ex.: `real = await realpath(docPath)`; se falhar →
  `path-missing`; se `!isInsideRoot(real, root)` → `outside-roots`);
  `document.path`/`name`/extensão derivados do caminho resolvido; sem lstat de
  caminho fora das raízes. Testes novos: checkpoint com `..` textual e com
  symlink de diretório interno → `available:false, reason:'outside-roots'`, e
  `mesa_page` desse caminho recusa; caso legítimo (realpath dentro) continua
  `ready`.

## F2 — Leitura de perfil: identidade/canonical derivados DEPOIS do read e sem teto real de memória (MÉDIO)

- Evidência startup: `server/profiles.mjs:100-114` — `readFile(filePath)` na
  linha 102 (conteúdo inteiro em memória), checagem de teto em
  `decodeProfileBuffer` (`server/profiles.mjs:73-74`, chamada na linha 106) e
  `realpath` só na linha 110 → o canônico congelado é derivado do que foi
  lido. Sem re-lstat/`dev+ino` antes/depois.
- Evidência runtime: `server/profiles.mjs:145-166` — `readFile` na 147,
  teto/decodificação na 151, `realpath`/comparação com o congelado só em
  158-166. O corpo não vaza em troca para symlink (estado `changed`), mas o
  arquivo inteiro é lido antes das checagens.
- Evidência checkpoint: `server/persistence.mjs:188-195` — `readFile` na 188,
  `buffer.length > MAX_STATE_BYTES` só na 193 (identidade é revalidada em
  199-204, mas depois da leitura inteira).
- Reprodução sintética (`/tmp/mesa-review/repro-race.mjs`, io injetado
  simulando a janela de corrida lstat→readFile): `lstat` vê arquivo regular,
  `readFile` segue symlink, `realpath` devolve o alvo; resultado
  `inspectProfilePathSync` = `{state:'ready', canonical:'…/privado-nao-autorizado.md'}`,
  ou seja, um symlink de leaf escapa da recusa "symlink → STARTUP_INVALID" e
  passa a ser o perfil canônico adotado. No runtime, a comparação de canônico
  contém a troca (erro sem corpo), mas não o consumo de memória.
- Impacto: (a) o teto de 64 KiB não limita bytes alocados — arquivo que cresce
  entre `lstat` e `readFile` (ou alvo de symlink) pode ser lido inteiro antes de
  virar `oversize`; (b) corrida de TOCTOU no startup adota o alvo do symlink
  como identidade congelada (requer escritor local na pasta do perfil; janela
  estreita; troca posterior do leaf já não vaza corpo). Não é vazamento no
  fluxo normal de um arquivo regular estável.
- Aceite: leitura limitada de verdade (ex.: `fsp.open` + `read` de
  `maxBytes+1`; oversize se exceder) e revalidação `dev+ino` antes/depois da
  leitura (ou `realpath` antes de ler) em `inspectProfilePathSync`/`readProfile`
  e em `loadCheckpoint`; teste com io injetado da janela de troca → `changed`
  sem corpo.

## F3 — `resumeCandidate.available:true` com `persistence.state:'cache-unavailable'` (BAIXO)

- Evidência: `server/tools.mjs:308-320` bloqueia o checkpoint quando
  `inspectCacheDir` reprova (ex. cache gravável por grupo/outros), mas
  `currentResumeCandidate` (`server/tools.mjs:354`) usa o checkpoint lido
  direto de `loadState` (`server/tools.mjs:279-282`), e `loadCheckpoint` só
  revalida symlink/tipo/confinamento, não dono/modo do cache.
- Reprodução (`/tmp/mesa-review/repro-cacheperm2.mjs`): cache 0777 com
  checkpoint de página dentro da raiz → `mesa_context`:
  `resumeCandidate {available:true, reason:'ready'}` e ao mesmo tempo
  `persistence {available:false, state:'cache-unavailable', present:false}`;
  `action=set` corretamente falha `saved:false CACHE_DIR_PERMISSIONS`.
- Impacto: diagnóstico contraditório (a operação de retomada em si continua
  segura: render revalida raízes e a leitura é de referências validadas).
- Aceite: derivar o candidato do mesmo gate de cache do descriptor (ou
  `available:false, reason:'cache-unavailable'`) e cobrir com teste de cache
  0777.

## F4 — Render em processo novo apaga a `note` do checkpoint preservado (BAIXO — decisão a documentar)

- Evidência: `server/tools.mjs:365-376` funde só a PÁGINA quando o store não
  tem página; a gravação usa `note: current.note` do processo
  (`server/tools.mjs:377-382`). Sem merge da nota anterior.
- Reprodução (`/tmp/mesa-review/repro-annot.mjs`): checkpoint
  `{page:{doc,2}, note:'retomar daqui'}`; depois do restart:
  `set note` preserva a página (bom, coberto por desenho);
  `mesa_page` explícito grava `note:null` e perde a anotação anterior.
- Impacto: a retomada explícita apaga a dica de estudo que o próprio
  checkpoint carregava; o usuário/modelo só a viu em `resumeCandidate` antes do
  render. Nenhum teste cobre esse caminho.
- Aceite: decidir explicitamente — ou fundir a nota anterior quando
  `current.note === null` (como a página), ou documentar no CONTRACT/README que
  um novo render zera a nota; teste correspondente.

## F5 — CONTRACT não lista códigos `STATE_CACHE_*` alcançáveis (BAIXO — doc)

- Evidência: `server/CONTRACT.md:159-163` lista `STATE_INVALID, STATE_OVERSIZE,
  STATE_SYMLINK, STATE_NOT_FILE, STATE_OUTSIDE, STATE_NOT_JSON, STATE_CHANGED,
  STATE_IO, STATE_WRITE_FAILED, STATE_TOO_LARGE`, mas `stateError`
  (`server/persistence.mjs:66-70`) produz também `STATE_CACHE_SYMLINK` e
  `STATE_CACHE_NOT_DIRECTORY` (via `saveCheckpoint`/`clearCheckpoint`, linhas
  236/288) e `tools.mjs:316` emite `STATE_CACHE_UNAVAILABLE`. Todos
  alcançáveis pelo cliente.
- Aceite: acrescentar os três códigos à lista do CONTRACT (e/ou enumerar os
  estados de `persistence.state`).

## Verificado bom (sem achado)

- Sete ferramentas e só `mesa_open` com template MCP Apps (`TOOL_DEFS` em
  `server/tools.mjs`); teste de contrato passa. UI sem qualquer referência a
  perfil/checkpoint/retomada (`ui/desk.html`) — nada reabre PDF ou captura
  automaticamente; ajuste de ajuda da raiz (snapshot de `captureRequest`/
  `helpMessage` antes do `ui/message`, `ui/desk.html:1312-1337`) preserva a
  origem do pedido, 43 testes de cliente UI passam.
- Sem flags: nenhum perfil/checkpoint configurado, nenhum arquivo lido/gravado
  a mais (teste `mcp-persistence`); `mesa_status` não cria o cache.
- Perfis: congelamento no startup com flag vencendo env; `missing` aceito;
  symlink/diretório/teto/não-UTF8 → `STARTUP_INVALID`; status sem corpo;
  `mesa_context` só com texto dos arquivos declarados; troca pós-startup sem
  corpo; log real sem corpo (testes `mcp-profile`, 5/5).
- Checkpoint: filho direto `.json` do cache canônico; gravura atômica
  temp 0600+fsync+rename+chmod; allowlist recusa campo extra; clear só o
  checkpoint; falha de persistência não derruba render (`saved:false` + erro);
  reinício nunca restaura página/captura; candidato não é render
  (`mcp-persistence`, 10/10). Nota preservada no `set` pós-restart (sem página).
- Defaults legado: limites, schemas, `mesa_page`/`mesa_capture`/`mesa_library`
  e checagens de raiz congelada intactos; `.mcp.json` encaminha as três envs
  novas; doctor/prepare-local com paridade testada (`package-doctor-startup-parity`,
  `package-prepare-local`).
- Gate de snapshot: a suíte normal verifica TODOS os hashes da cópia fixada
  (`tests/mcp-parity.test.mjs:53-63`), inclusive `capture.mjs` ajustado, sem
  exigir a origem mutável; a comparação com `claude-mod` virou opt-in
  (`MESA_VERIFY_SNAPSHOT_ORIGIN=1`). Não enfraquece a integridade da cópia.
- Installed 0.2.1 sem `server/profiles.mjs`/`server/persistence.mjs` — não foi
  tocado por este trabalho.

## Método

Somente leitura no repositório; repros e fixtures em `/tmp/mesa-review`
(sintéticas, removidas ao fim). `npm test` e subconjuntos executados na source
atual. Nenhuma instalação, inferência, captura, commit, push ou restart.
