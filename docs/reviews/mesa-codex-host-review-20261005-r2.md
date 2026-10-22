# Revisão independente r2 — plugin experimental Mesa para Codex (servidor MCP + host + skill)

Revisor: agente independente (somente leitura). **Único arquivo escrito: este relatório.**
Sem commit/push, sem instalar/carregar plugin, sem reiniciar apps, sem chamar modelo, sem ler PDFs pessoais/materiais de curso, sem executar o helper real ou `screencapture` real.
Probes rodaram só em `os.tmpdir()` (`/private/var/folders/.../T/opencode/mesa-review/`), com PDFs e PNGs sintéticos; nenhum arquivo do produto foi alterado.

**Escopo revisado**: `codex-plugin/mesa-study/server/**` (inclui `CONTRACT.md`), `host/**`, `package.json`/`package-lock.json`, `tests/mcp-*.test.mjs`, `skills/mesa/SKILL.md`, `tests/manual-study.md`. Origem `claude-mod/mesa-study/host` lida apenas para comparação.
**Fora do escopo por instrução** (em mutação por outro agente): `scripts/**`, README, manifest/`.codex-plugin`, assets e testes de empacotamento — não revisados nem avaliados.

## 1. Snapshot congelado e ambiente

- `codex-plugin/mesa-study` é untracked (`?? codex-plugin/`); a revisão vale para o snapshot lido em 2026-10-05.
- Hashes conferidos **independentemente** por sha256 (script próprio, não o teste): **12/12 arquivos de `host/` batem com `SNAPSHOT.json` e com a origem**; `capture.mjs` bate com `originSha256 2276a0ae...` e `copySha256 2c27c664...`. Confirma a claim "paridade byte a byte exceto o default do helper absoluto".
- Node v26.10.0, npm 12.2.0 (engines `>=22.19.0` ok); `npm ls --depth=0` → `@modelcontextprotocol/sdk@1.32.0`, `zod@4.6.5`, coerentes com `package.json`/lock.
- Poppler real presente e usado nos testes (não houve skip).
- **Diferenciação de camadas**: protocolo MCP stdio e Poppler são exercitados de verdade; a captura nos testes é **simulada** (`run` injetado, `screencapture` falso); o helper real, o app Codex, a permissão de Gravação de Tela e a leitura da imagem pelo modelo continuam **não validados**.

## 2. Evidência própria executada

- **Suíte**: `cd codex-plugin/mesa-study && npm test` (`node --test tests/mcp-*.test.mjs`) → **23/23 passam, 0 fail, 0 skip**, ~3,6 s. Os 3 testes Poppler reais rodaram (pdfinfo/pdftocairo reais), incluindo caminho com espaços/não-ASCII e teto de imagem.
- **Probe 1** (`probe1-config.mjs`, config pura + processo real): precedência, JSON malformado, dedupe, `--help`.
- **Probe 2** (`probe2-server.mjs`, servidor MCP em processo via `InMemoryTransport`, `run` injetado + Poppler real): status, timeouts, redação, cache symlink, confinamento de PNG, root trocada por symlink.
- **Probe 3** (`probe3-output.mjs`): poda de retenção.
- Reproduções completas em `os.tmpdir()/opencode/mesa-review/` (scripts e saídas citadas abaixo).

## 3. Achados

### A. [Médio — não bloqueador] `--root` não vence um `MESA_STUDY_ROOTS` malformado: o env é parseado mesmo quando a flag o substitui

- **Onde**: `server/config.mjs:161` — `const envRoots = parseRootsFromEnv(env);` roda incondicionalmente, antes de decidir `flags.roots.length > 0 ? flags.roots : envRoots.roots` (`:162-163`). O contrato diz "flag de linha de comando vence o ambiente" (`server/config.mjs:9`, `CONTRACT.md:26`).
- **Por quê importa**: com um `MESA_STUDY_ROOTS` quebrado no ambiente do app, `--root` explícito **não** evita o exit 2 — o plugin não inicia e a mensagem culpa o env. O teste `tests/mcp-parity.test.mjs:231-238` cobre só env válido; o caso "flag vence env inválido" ficou de fora.
- **Evidência** (probe 1): `node server/main.mjs --root /tmp` com `MESA_STUDY_ROOTS='{oops'` → `status 2`, stderr `{"ok":false,"error":{"code":"STARTUP_INVALID","message":"MESA_STUDY_ROOTS precisa ser um JSON de array..."}}`. Contraste: `--max-image-bytes 8192` com `MESA_STUDY_MAX_IMAGE_BYTES=abc` → ok 8192 (o env só é parseado quando usado).
- **Correção mínima**: só chamar `parseRootsFromEnv(env)` quando `flags.roots.length === 0` (mover para o ramo do `else`).

### B. [Médio — não bloqueador] `mesa_status.ready` diz "pronto" para helper/roots/cache inexistentes (configuração ≠ disponibilidade)

- **Onde**: `server/tools.mjs:92` (`helperConfigured` só checa string não vazia), `:121` (`helperReady`), `:155-159` (`ready.windows = helperReady`, `ready.capture = helperReady && cacheConfigured`, `ready.pdf = roots+cache+poppler`); `server/windows.mjs:18-30` não faz `stat`/`X_OK`. `CONTRACT.md:40` chama o campo de "capacidades".
- **Por quê importa**: `SERVER_INSTRUCTIONS` manda ler `mesa_status` antes das demais (`server/server.mjs:17`); o status pode afirmar `ready` para helper/roots/cache que não existem, e a chamada seguinte falha (`CAPTURE_HELPER_MISSING`, `PATH_NOT_FOUND`). O `guidance` (`tools.mjs:55-77`) só avisa quando **não configurado**, nunca quando configurado e ausente.
- **Evidência** (probe 2): config com `--root`, `--cache-dir` e `--xournal-helper` apontando para caminhos inexistentes → `{"ready":{"pdf":true,"windows":true,"capture":true},"configured":{"roots":true,"cache":true,"helper":true}}` e `mesa_windows` → `CAPTURE_HELPER_MISSING`. Note a assimetria: Poppler é verificado por `X_OK` (`server/config.mjs:215-227`), o helper não.
- **Correção mínima**: `ready.windows/capture` exigirem `isExecutableFile(config.xournalHelper)` (checagem somente leitura, já disponível no host) e/ou renomear para `configured`; para roots/cache, não prometer "ready" sem verificação.

### C. [Baixo] Root substituída por symlink depois da inicialização redireciona a autorização

- **Onde**: `host/paths.mjs:32-41` reavalia `realpath(root)` a cada chamada; `server/config.mjs:74-81` congela a *string* realpath no startup, não a identidade do diretório.
- **Por quê importa**: "raízes fixadas na inicialização" é congelamento de caminho. Se a root (mesmo já existente e canonicalizada) for trocada por um symlink para outro diretório, o realpath da root passa a apontar para o alvo e arquivos do alvo são autorizados.
- **Evidência** (probe 2, "root swapped for symlink"): antes da troca, PDF no alvo → `PATH_OUTSIDE_ROOTS`; depois de `rm -r root && ln -s target root`, a **mesma config congelada** renderiza o PDF do alvo (`afterHasImage:true`).
- **Limite**: exige ator local com escrita no diretório-pai (mesmo UID); o modelo não cria symlink. É defesa em profundidade, não escalada.
- **Correção mínima**: na chamada, recusar se `realpath(root) !== frozenRoot` (ou se a root for symlink), mantendo a autorização pelos caminhos canônicos.

### D. [Baixo–Médio] A skill aponta um "fluxo de aprovação do host" que o host/servidor não implementa

- **Onde**: `skills/mesa/SKILL.md:53` — "o fluxo de aprovação é o do host". O servidor afirma o contrário: `server/tools.mjs:52-53` ("o servidor não verifica consentimento e não existe parâmetro booleano que finja essa verificação") e a descrição da tool (`:350`); na origem, `claude-mod/mesa-study/hooks/register.mjs:5` ("Nada aqui aprova ferramentas").
- **Por quê importa**: a frase pode induzir o modelo a supor que o host bloqueia/registra consentimento de captura, quando a única salvaguarda é a própria skill; o app Codex pode ter aprovação de tool call, mas isso está explicitamente **não validado** (`tests/manual-study.md:3`).
- **Correção mínima**: condicionar — "se o host/app oferecer aprovação, siga o fluxo dele; o servidor não verifica consentimento" — ou remover a referência a um fluxo inexistente.

### E. [Informativo] `CAPTURE_PROVENANCE` afirma pedido explícito e se desmente na mesma frase

- **Onde**: `server/tools.mjs:52-53`; descrição em `:350`; o aviso é coberto por `tests/mcp-stdio.test.mjs:100-103`.
- **Avaliação de honestidade**: aceitável — o mesmo campo diz que o servidor não verifica consentimento e que a chamada só registra a proveniência da instrução; o contrato (`CONTRACT.md:62-63`) não promete consentimento. Porém a 1ª oração ("Captura solicitada explicitamente...") é uma asserção que o servidor não pode conferir e pode ser citada isoladamente por um modelo. Sugestão de redação: "Instrução registrada como pedido explícito de conferência para a janela escolhida; o servidor não verifica consentimento."

### F. [Informativo] Depois de captura falha, `mesa_context` mantém a captura bem-sucedida anterior; skill/manual a chamam de "captura atual"

- **Onde**: `server/state.mjs:49-63` (só atualiza no sucesso), `server/tools.mjs:280-284`; `SKILL.md:25` ("metadados da captura atual"); `tests/manual-study.md:48`.
- **O que está certo**: o requisito "falha nunca devolve imagem antiga" está cumprido — o resultado de erro não tem bloco `image`, o contexto não é reescrito e a pasta própria é removida (`tests/mcp-capture.test.mjs:291-302`; probe 2: timeout → `leftovers:[]`, `contextCapture:null` sem sucesso anterior). O risco é só de leitura: "captura atual" pode ser interpretada como a tentativa que falhou; `tools.mjs:363` usa o termo mais preciso "última captura".
- **Sugestão**: padronizar "última captura bem-sucedida" na skill/manual; opcionalmente marcar `context.capture` como último sucesso.

### Notas menores (não achados funcionais)

- `--cache-dir=` / `--xournal-helper=` vazios sombreiam o env e reportam `source:'flag'` com `configured:false` (`server/config.mjs:177-191`); cosmético, mas a mensagem de status fica estranha.
- `MESA_STUDY_ROOTS='[]'` → `source:'env'` com `configured:false` (`server/config.mjs:85,163`); cosmético.
- `--help` junto de argumento desconhecido sai 2 e não mostra a ajuda (`server/config.mjs:126-159`); defensivo, mas reduz a utilidade do `--help`.
- Root que é arquivo regular autoriza a si mesma (`host/paths.mjs:9-13`, `realPath === realRoot`); sem fuga, só semântica de "diretório" no config.
- `host/config.mjs:52` exporta `CAPTURE_HELPER_RELATIVE` morto (cópia byte a byte da origem); inofensivo.
- `captureOperation` poda com `Date.now()` real ignorando `deps.now` (`host/capture.mjs:219`), inconsistente com `host/page.mjs:205`; só testabilidade.
- `svgPreviewForPng` é calculado e descartado no caminho do servidor (`host/capture.mjs:275-276`; `server/tools.mjs` não usa `result.svg`); custo à toa, sem impacto funcional.
- `WINDOW_ID_MAX` duplicado (`server/tools.mjs:24` vs `host/config.mjs:29`); risco de drift.
- Validação de PNG é só pelo magic (`server/png.mjs:58-66`); PNG sem IHDR passa com `width/height:null`. Produtores são Poppler/screencapture; robustez, não bug.

## 4. Áreas testadas sem achado (verificação independente)

- **Precedência flag×env (casos válidos)**: roots/cache/max; dedupe por realpath (symlink + alvo → 1 root) — correto.
- **Config malformada**: JSON inválido, array com item não-string, >64 roots → `STARTUP_INVALID`; root inexistente é pulada quando outra existe (probe 2: render real com sucesso) — correto.
- **Confinamento de cache**: cacheDir leaf symlink → `CACHE_DIR_SYMLINK` no uso (probe 2); PNG fora do cache → `IMAGE_INVALID` (probe 2); arquivo completo preservado no teto (`IMAGE_TOO_LARGE`, sem truncar) — correto.
- **Timeouts de captura** (não cobertos pela suíte): helper `timedOut` → `CAPTURE_HELPER_TIMEOUT`, sem imagem; `screencapture` `timedOut` → `CAPTURE_TIMEOUT`, sem imagem, sem pasta deixada para trás, contexto intacto (probe 2) — correto.
- **Erro inesperado**: non-HostError → payload `INTERNAL`, log stderr genérico `[mesa-study] ferramenta mesa_capture falhou (INTERNAL)`, sem caminho (probe 2) — redação correta.
- **Revalidação de captura**: 3 listagens (seleção/antes/depois), `-l<id>` sempre, mudança de identidade descarta a captura e remove a pasta (`tests/mcp-capture.test.mjs`) — correto. Limitação conhecida e documentada: helper real não emite `ownerPID`, então produção compara só id+app (`host/capture.mjs:13-18`).
- **Estado em falha**: nenhuma falha de página/captura atualiza o store; resultado nunca contém imagem antiga — correto.
- **Retenção** (probe 3): marcador válido velho removido; novo, marcador inválido e diretório alheio preservados (`removed:1, scanned:3`) — correto.
- **stdout/stderr**: stdout só protocolo (testes stdio reais + `--help`/erro no stderr); sem `console.log`, sem `child_process` fora de `proc.mjs`, sem `shell:true` — correto.
- **Concorrência**: não reproduzi corrupção; o store é memória do processo e o último evento vence. Sem achado.

## 5. Revisão da skill (`SKILL.md`) — checklist do pedido

- **Preserva a intenção do aluno**: sim. Se pedir solução/derivação completa, resolve direto (linha 40); formato pedido é preservado (linha 41); loop padrão só sem modo pedido (linha 42).
- **Sem socrático forçado**: sim, explícito na linha 40 ("Não transforme o pedido em interrogatório socrático nem retenha a resposta").
- **Ativação apropriada**: descrição (linha 3) cobre estudar/revisar/corrigir/conferir e exclui conversa geral, edição de arquivos e captura sem pedido; `$mesa` e nomes de tools são declarados não validados (linhas 12-13).
- **Atribuição explícita da captura**: sim (linha 50: imagem vai ao modelo, não é prévia só local); ressalva D sobre a aprovação; o "se o aluno ainda não sabe disso" é condicional — risco baixo de o modelo pular a explicação por suposição.
- **Escolha ambígua**: com >1 janela manda listar e perguntar (linha 31). O caso "confere" sem local está no roteiro (`manual-study.md` I2) mas não explícito na skill; sugiro acrescentar "se o pedido não disser onde, pergunte antes de capturar".
- **Falha/imagem antiga sem estado falso**: sim (linhas 31 e 57: reporta a falha real, diz o que não aconteceu, não reaproveita imagem). Correto.
- **Sem instrução perigosa**: não abrir/fechar apps, não salvar `.xopp`, não varrer vault, não contornar raízes — tudo presente (linhas 33-34, 52, 59).

## 6. Revisão dos testes `tests/mcp-*.test.mjs`

- **Forças**: protocolo stdio real com SDK oficial e processo filho; schemas/anotações; congelamento de config e campos extras descartados; escape de caminho/symlink; Poppler real com espaços/não-ASCII; teto sem truncar; helper falso com anomalias/permissão; captura injetada com revalidação, sem imagem antiga e sem tela inteira; paridade por hash/diff/comportamento; stdout só MCP.
- **Lacunas de cobertura** (comportamentos que verifiquei manualmente e estão corretos, mas sem teste): `CAPTURE_HELPER_TIMEOUT`; `CAPTURE_TIMEOUT`; `CACHE_DIR_SYMLINK`; `readBoundedPng` recusando PNG fora do cache; root ausente pulada com outra válida; poda de retenção; redação de log non-HostError. Recomendo adicionar casos — são baratos e sintéticos.
- **Qualidade**: `tests/mcp-poppler.test.mjs:158-162` retorna cedo ("passa") quando o PNG medido é ≤ 4096 B, sem exercitar `IMAGE_TOO_LARGE` nem marcar skip; numa máquina com página minúscula o caso vira vazio. Preferir `t.skip()`/fixture maior. Precedência do helper flag×env não é coberta (roots/cache/max são).
- **Não é validação de app/modelo**: os próprios testes e `CONTRACT.md:79-87` delimitam isso corretamente; `manual-study.md` mantém os casos como pendentes.

## 7. Não validado / limites desta revisão

- Carregar o plugin/skill no app Codex, nomes reais das tools, aprovação de tool call do app e leitura do bloco `image/png` pelo modelo (entrega via SDK ≠ visão do modelo).
- Execução do helper real `visual-check/windows`, `screencapture` real e permissão de Gravação de Tela.
- Adesão do modelo à skill (só o roteiro manual mede; pendente por design).
- Empacotamento/manifest/README/scripts — em mutação por outro agente, fora do escopo.
- Achado C exige ator local (mesmo UID); não testei o helper real, apenas a lógica com `run` injetado.
- Nenhum PDF pessoal ou material de curso foi lido; todas as fixtures são sintéticas.

## 8. Veredito

Host/servidor tecnicamente sólido e honesto sobre o que testa: **23/23 passam, 0 fail, 0 skip**, paridade de snapshot confirmada por hash independente, Poppler real exercitado, captura explicitamente simulada. **Nenhum bug crítico/alto.** Dois achados médios não bloqueadores (A: env malformado derruba startup mesmo com flag; B: `ready` confunde configuração com disponibilidade), um baixo de confinamento (C: root trocada por symlink) e um baixo–médio de honestidade da skill (D: fluxo de aprovação inexistente). A skill preserva a intenção do aluno, não força socrático e trata falha/imagem antiga sem estado falso. Correções mínimas sugeridas em cada achado; o agente pai deve aplicá-las em delegação nova, com os testes correspondentes.
