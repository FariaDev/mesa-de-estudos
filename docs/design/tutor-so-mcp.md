# Tutor só com ferramentas da Mesa por MCP (#91)

**Nota (2026-11-04):** a regra continua valendo, mas o texto é da época dos três motores. O Pi foi aposentado, só o OpenCode é visível e vários arquivos citados aqui (`tool-jail`, `opencode-jail`, `rpc.cjs` e outros) saíram do código; o estado atual está em [`docs/agents/mapa.md`](../agents/mapa.md).

**Status:** implementado em 2026-11-01; decisões finais na ADR 0002; atualizado pela #92 (cartões `quiz`/`perguntar`).
**Base:** `feat/tutor-sandbox` em `7efa55f`.
**Decisão do Lucas:** o tutor fica só com as ferramentas da Mesa nos três
motores; nada de `bash`, `edit`, `write`, `read` nem de outra ferramenta
nativa do harness; a jaula sai do código; a medição da issue foi dispensada.
**Referência estudada:** T3 Code, commit `5732bbee` (clone em `/tmp/t3code`).
**#92:** o quiz e a pergunta deixam de ser `ask_user`/`quiz` do Pi e
`AskUserQuestion` do Claude. Viram ferramentas da Mesa (`quiz`/`perguntar`) nos
três motores, com cartão persistido e resultado numa mensagem nova. As seções
4.1, 4.3 e 9 abaixo estão anotadas com essa mudança.

## 1. Decisão

O tutor deixa de ser um agente de código. Ele continua lendo PDF, buscando no
material, mostrando quadro, figura e GeoGebra, propondo revisão, preparando
PDF, calculando, listando materiais e gravando uma nota dentro da matéria.
Tudo chega ao modelo como ferramenta da Mesa: **Claude** pelo servidor MCP
`mesa` em processo (`createStudyToolsServer`); **OpenCode** pelo MCP `mesa` por
stdio (`desk/src/extensions/mesa-mcp`); **Pi** por extensões finas em
`desk/src/extensions/` (o Pi não fala MCP; a casca é a mesma fonte de texto e
código). Sai a camada que existia só para tornar `bash`/`edit`/`write` seguros:
classificador de shell, confirmação do aluno, jaula de SO, plugin do OpenCode,
sinal de carga da jaula e o núcleo `toolsandbox`. Entram três ferramentas
pequenas, uma invariante no Bend e testes de que as nativas não chegam ao
modelo.

## 2. Evidência dos binários (2026-11-01)

| Motor | Comando rodado | O que confirma |
|---|---|---|
| Claude Code | `claude --version` → `2.1.314`; `claude --help` | `--allowedTools` e `--disallowedTools` existem; o SDK pinado em `desk/package.json` é `0.3.314` |
| Agent SDK | `sdk.d.ts` do SDK 0.3.301 do bundle local | `tools?: string[] \| {preset}`; `[]` desliga todas as nativas; `allowedTools` pré-aprova; `disallowedTools` remove do contexto |
| OpenCode 1.19.5 | `OPENCODE_CONFIG_DIR=/tmp/oc-cfg opencode debug config` | `tools` e `permission` resolvidos, mas o turno não roda: a API v2 do adaptador recebe 400 `Missing key at ["prompt"]` (vem de antes da #91) |
| OpenCode 2.2.4 | `OPENCODE_CONFIG_DIR=/tmp/oc-cfg opencode --standalone debug config` e `debug agents` | o 2.2.4 traduz `tools` para permissões `shell`/`edit`/`read` em `deny`; `write` vira `edit` |
| Pi 1.4.0 | `pi --help` | `--no-tools`, `--no-builtin-tools`, `--tools <lista>` e `--exclude-tools <lista>` existem; `--tools` é allowlist e mantém ferramentas MCP |

O T3 Code faz o mesmo recorte: as ferramentas do app são um servidor MCP
(`apps/server/src/mcp/McpHttpServer.ts`, `layerOrchestratorToolkit`), o Claude
recebe `tools` + `allowedTools` (`ClaudeAdapterV2.ts:1544,1691,1714`) e o Pi
roda com `--no-builtin-tools`/`--no-tools` mais a extensão que registra as
ferramentas do T3 (`packages/provider-pi/src/server/mcpInjection.ts:64,273`).
O T3 não usa jaula de SO no OpenCode; usa regras de permissão
(`packages/provider-opencode/src/server/adapter.ts:595`). A Mesa vai além: como
não sobra ferramenta nativa, a permissão deixa de ser a defesa principal.

## 3. Inventário do que sai

Contagem por `wc -l` no commit base. “Remover” é apagar o arquivo; “adaptar” é
mexer no que sobrou. A soma dos grupos removidos é ≈6.000 linhas; a estimativa
de código novo é ≈1.100.

### 3.1 Núcleo, classificador e jaula

| Arquivo | Linhas | Ação |
|---|---:|---|
| `desk/tool-jail.cjs` | 316 | remover |
| `desk/jail-notice.cjs` | 40 | remover |
| `desk/src/tool-sandbox/` — `classify.mjs` 364, `paths.mjs` 242, `protected-files.mjs` 47, `shell-command.mjs` 337, `shell-git.mjs` 56, `shell-heredoc.mjs` 56, `shell-interpreters.mjs` 141, `shell-network.mjs` 123, `shell-syntax.mjs` 128, `shell-tokenizer.mjs` 204, `shell-verbs.mjs` 40, `shell-wrappers.mjs` 267 | 2.005 | remover todos |
| `core/toolsandbox.bend` 86; `core/laws/toolsandbox.bend` 90; `core/proofs/toolsandbox.bend` 73; `desk/src/generated/toolsandbox.core.js` 64 | 313 | remover (gerado não se edita) |
| `desk/src/extensions/tool-approval/index.ts` | 24 | remover |
| `desk/src/extensions/tool-approval/lib.mjs` | 188 | remover |
| `desk/src/extensions/opencode-jail/index.mjs` | 151 | remover |
| `desk/src/extensions/opencode-jail/rewrite.mjs` | 72 | remover |
| `desk/src/agents/opencode-sandbox.cjs` | 199 | remover |
| `desk/src/agents/opencode-turn-guard.cjs` | 90 | remover |
| `desk/src/agents/claude-adapter-permissions.cjs` | 271 | remover (permissão e `AskUserQuestion`) |
| `desk/src/extensions/mesa-pdf/guard.mjs` | 35 | remover (não há mais `read` nativo de PDF) |
| `desk/src/extensions/mcp-policy/index.ts` 27; `lib.mjs` 18 | 45 | remover do perfil do tutor; arquivo pode ficar se outro uso aparecer |

### 3.2 Adaptadores, hosts e configuração

| Arquivo | Linhas | Ação |
|---|---:|---|
| `desk/src/agents/claude-adapter.cjs` | 800 | adaptar: saem `respond`, `_permissions`, `toolPolicy`, `workspaceRoots`, `permissionTtlMs` e o cabeçalho de sandbox |
| `desk/src/agents/claude-adapter-query.cjs` | 366 | adaptar: `tools: []`, `allowedTools` só `mcp__mesa__*`, sem `sandbox`, `hooks`, `canUseTool` e `settings.permissions` |
| `desk/src/agents/claude-adapter-contract.cjs` | 221 | adaptar: listas de ferramentas nativas (sem mexer em `permissions`, que a UI não consulta) |
| `desk/src/agents/claude-adapter-input.cjs` | 245 | adaptar: saem `normalizeToolPolicy`, `extractPathFromInput` e a validação de `AskUserQuestion` |
| `desk/src/agents/claude-adapter-controls.cjs` | 432 | adaptar: `permissionPending` deixa de existir |
| `desk/src/agents/claude-adapter-turns.cjs` | 265 | adaptar: sai `_invalidatePermissions` |
| `desk/src/agents/claude-turn-policy.cjs` | 677 | sem mudança: `rg` não achou jaula nem permissão ali; a política de liquidação fica |
| `desk/src/agents/service.cjs` | 151 | adaptar: sai o mapeamento de `permission_request`/`permission_cancelled` |
| `desk/src/agents/opencode-adapter.cjs` | 462 | adaptar: saem `STUDY_PERMISSIONS` de `ask`, `gatePermission`, `respond` e o guard da jaula; pedido inesperado vira recusa |
| `desk/src/agents/opencode-events.cjs` | 326 | adaptar: sai a normalização de `permission.asked` |
| `desk/src/agents/opencode-serve-config.cjs` | 99 | adaptar: `tools` nativas em `false`, `permission` em `deny`, sem plugin; falha de gravação não cai em `ask` |
| `desk/opencode-tutor-host.cjs` | 228 | adaptar: saem `JAIL_*`, `jailRootsPath`, `jailReadyPath`, `rememberJailRoots` e `jailSignal`; entram as pontes das ferramentas novas |
| `desk/tutor-bridge-host.cjs` | 214 | adaptar: sem `jailNoticeOnce`, sem `tool-approval`, sem `LEARNING_DESK_TUTOR_WORKSPACE`; `piLaunch` ganha o allowlist |
| `desk/tutor-engine-host.cjs` | 162 | adaptar: sai `workspaceRootsOf` e `workspaceRoots` |
| `desk/tutor-prompt-host.cjs` | 137 | adaptar: sai `toolPolicy` do pedido |
| `desk/sidechat-engine.cjs` | 292 | adaptar: sai `toolPolicy` |
| `desk/sidechat.cjs` | 631 | adaptar: saem `readPaths` do caminho Claude |
| `desk/rpc.cjs` | 190 | adaptar: comentário de `--approve`; o Pi não recebe ferramenta de arquivo |
| `desk/profiles.cjs` | 128 | adaptar: `EXPECTED_ACTIVE` sem `bash`/`edit`/`read`/`write`; o perfil do tutor passa a declarar o allowlist |
| `desk/tests/profiles.test.mjs` | 131 | adaptar ao novo esperado |
| `desk/src/agents/mesa-tool-catalog.cjs` | 27 | adaptar: lista única das ferramentas e nomes para o `--tools` |
| `desk/src/agents/study-tools.cjs` | 26 | adaptar: registra `calcular`, `listar_materiais` e `salvar_nota` |
| `desk/src/extensions/mesa-pdf/index.ts` | 39 | adaptar: sai o hook `tool_call` que bloqueava o `read` de PDF |
| `desk/src/extensions/mesa-mcp/tools.mjs` | 172 | adaptar: as mesmas três ferramentas no MCP do OpenCode |
| `desk/tutor-materials.cjs` | 73 | adaptar: rota `/notes` na ponte já existente |
| `desk/src/study-data/services.cjs` | 63 | adaptar: `materialList` e `noteSave` com escopo do host |
| `desk/main.cjs` | 800 | adaptar: só ligação; o arquivo já está no teto, então o corpo novo vai para os hosts |

`desk/config.cjs` e `desk/config.example.json` não mudam. `desk.pinnedExtensions`
continua existindo, mas deixa de poder reabrir ferramenta nativa: o allowlist
do tutor vale sempre.

### 3.3 Testes, hunts e fakes

| Arquivo | Linhas | Ação |
|---|---:|---|
| `desk/tests/tool-sandbox*.test.mjs` — `test` 304, `paths-bypass` 154, `protected` 66, `shell` 168, `shell-bypass` 320 | 1.012 | remover |
| `desk/tests/tool-approval.test.mjs` | 229 | remover |
| `desk/tests/tool-jail.test.mjs` | 176 | remover |
| `desk/tests/jail-notice.test.mjs` | 33 | remover |
| `desk/tests/opencode-jail.test.mjs` | 231 | remover |
| `desk/tests/opencode-sandbox-wiring.test.mjs` | 110 | remover |
| `desk/tests/claude-sandbox.test.mjs` | 231 | remover |
| `desk/tests/hunt-opencode-2.2.4.mjs` | 260 | substituir por hunt de “sem nativas”, mantendo o serve real |
| `desk/tests/pdf-read-path.test.mjs` | 144 | adaptar: saem os casos de `pdfReadBlock`; ficam os de `resolveTutorPdf`/`isPdfPath` |
| `desk/tests/fake-tool-jail.mjs` 21; `fake-pi-confirm.mjs` 21; `fake-realpath.mjs` 51 | 93 | remover |

Os testes que ficam e precisam de ajuste: `claude-adapter.test.mjs` (1.894),
`claude-native-controls.test.mjs` (809), `claude-lifecycle-integration.test.mjs`
(295), `opencode-adapter.test.mjs` (483), `opencode-events.test.mjs` (225),
`opencode-tutor-wiring.test.mjs` (203), `tutor-bridge-host.test.mjs` (167),
`tutor-engine-host.test.mjs` (106), `tutor-prompt-host.test.mjs` (148),
`sidechat-claude.test.mjs` (183), `sidechat.test.mjs` (831),
`agent-service.test.mjs` (150), `pdf-tutor-claude.test.mjs` (70),
`claude-parity.test.mjs` (351), `desk-prompts.test.mjs` (334),
`native-tool-parity.mjs` (87), `mesa-mcp.test.mjs` (140) e
`prompts-leitura.test.mjs` (96).

### 3.4 Locales, UI e documentação

| Item | Linhas | Ação |
|---|---:|---|
| `desk/src/locales/pt-BR.json` e `en.json` | 2.611 cada | remover `opencode.jail.missing` e `err.opencode.jailMissing`; se `permission_request` sumir, remover também `err.opencode.permissionId`/`permissionRefused` e revisar `dialog.permission`/`sidechat.request.permission` |
| `desk/src/chat-dialogs.mjs` | 286 | manter o casco genérico (perguntas do Pi); sai o uso de permissão de bash |
| `desk/src/sidechat-requests.mjs` | 117 | manter perguntas; sai o caso `permission` se não houver produtor |
| `desk/src/claude-questions.mjs` | 303 | manter só avisos de limite/atividade; sai o caminho nativo de pergunta (#92) |
| `docs/agents/mapa.md` | 117 | reescrever as linhas 26, 32, 33, 42 e 90 |
| `docs/agents/portoes.md` | 31 | registrar o novo teste de “sem nativas” nos portões |
| `docs/manual/opencode-motor.md` | 69 | passo 9: não há ferramenta de arquivo para apagar |
| `docs/CLAUDE-TRANSPORT-EXPERIMENTAL.md` | 95 | seção de permissões: o Claude não pede permissão de ferramenta |
| `desk/README.md` | 124 | linha 38: o tutor não “consulta os arquivos”; usa as ferramentas da Mesa |
| `docs/reviews/prompts-leitura.md` | 1.947 | regenerar com `node scripts/prompts-leitura.mjs` |
| `desk/templates/TUTOR.md` | 18 | sem mudança obrigatória; “capturas e arquivos enviados” continua verdadeiro |

## 4. Como desligar as nativas em cada motor

### 4.1 Claude (`desk/src/agents/claude-adapter-query.cjs`)

Mudança em `_buildOptions`:

- `tools: []` (a #92 removeu o `AskUserQuestion`); o `noTools` do rascunho de
  revisão continua com `tools: []` e sem o MCP;
- `allowedTools: studyTools ? ['mcp__mesa__*'] : []`; o `canUseTool` só
  libera MCP e não abre mais pergunta nativa;
- `disallowedTools` com a lista explícita de nativas (`Read`, `Glob`, `Grep`,
  `Bash`, `Edit`, `MultiEdit`, `Write`, `NotebookEdit`, `Agent`, `Task`,
  `WebFetch`, `WebSearch`, `KillShell`, `BashOutput`, `Skill`);
- `mcpServers` só `mesa`; `strictMcpConfig: true`, `settingSources: []`;
- saem `options.sandbox` e `options.settings.permissions`; ficam o
  `canUseTool` (só MCP) e o hook PreToolUse (só o `callRef` da atividade).

**Prova:** o SDK pinado documenta que `tools` é a lista exposta e que
`allowedTools` auto-aprova; o T3 usa o curinga `mcp__t3-code__*` em
`allowedTools`. O teste `tests/claude-no-native-tools.test.mjs` usa o SDK fake
e afirma: `tools` é `[]`; `allowedTools` é exatamente
`['mcp__mesa__*']`; toda nativa está em `disallowedTools`; `mcpServers.mesa`
existe; `sandbox` e `settings` não existem.

### 4.2 OpenCode (`desk/src/agents/opencode-serve-config.cjs`)

O `opencode.json` da Mesa passa a ser:

```json
{
  "tools": {
    "bash": false, "shell": false, "edit": false, "write": false,
    "multiedit": false, "apply_patch": false, "patch": false,
    "read": false, "glob": false, "grep": false, "list": false,
    "task": false, "subagent": false, "webfetch": false, "websearch": false,
    "browser": false, "todowrite": false, "todoread": false,
    "question": false, "skill": false
  },
  "permission": {"bash": "deny", "shell": "deny", "edit": "deny", "write": "deny", "read": "deny", "*": "deny", "mesa_*": "allow"}
}
```

Sem `plugin` da jaula. Se a gravação do diretório falhar, o servidor sobe com
`OPENCODE_CONFIG_CONTENT` contendo o MESMO JSON; se nem isso for possível,
`connect()` falha. Nunca volta ao `OPENCODE_PERMISSION` em `ask`. O ambiente
do servidor descarta `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`,
`OPENCODE_CONFIG_DIR`, `OPENCODE_PERMISSION` e
`OPENCODE_CLI_CONFIG_CONTENT` herdados e põe
`OPENCODE_DISABLE_PROJECT_CONFIG=1`.

**Prova:** rodamos `opencode debug config` no 1.19.5 e
`opencode --standalone debug config`/`debug agents` no 2.2.4 com esse arquivo.
O 1.19.5 mostra `tools` e `permission`, mas não roda o turno: o adaptador usa
a API v2 e ele responde 400 `Missing key at ["prompt"]`; isso vem de antes da
#91. O 2.2.4 mostra `shell`, `edit` e `read` em `deny` (e
`write`/`patch`/`apply_patch` caem em `edit`). Medimos também o
furo: sem `*: deny`/`mesa_*: allow`, o `execute` do 2.2.4 expunha `fetch`
(rede) e os `opencode_*`; e um `opencode.json` na pasta da sessão reabria
`shell`/`edit`/`read` e rodava `echo > /tmp/...` — por isso as duas travas.
O teste `tests/opencode-serve-config.test.mjs` lê o `opencode.json` gerado e
confere `tools`, `permission` e o ambiente; o hunt do 2.2.4 mantém o serve
real, planta um `opencode.json` malicioso na pasta e confere que ele é
ignorado e que só as ferramentas da Mesa chegam ao modelo. O
`opencode-adapter` recusa qualquer `permission_request` inesperado com
`reject` e aviso, em vez de abrir diálogo.

### 4.3 Pi (`desk/tutor-bridge-host.cjs` e `desk/profiles.cjs`)

`piLaunch` acrescenta, antes das extensões da Mesa:

- `--no-builtin-tools` (segunda trava);
- `--no-mcp` (o Pi da Mesa não usa MCP) e `--exclude-tools` com
  `mcp__*`, `list_mcp_resources`, `list_mcp_resource_templates` e
  `read_mcp_resource` (o `--tools` mantém MCP registrado por padrão);
- `--tools <lista>` com os nomes de `mesa-tool-catalog.cjs` para a sessão:
  `mesa_ler_pdf`, `mesa_buscar_material`, `mesa_criar_pdf`,
  `mesa_criar_atividade`, `mesa_previsualizar_atividade`, `mesa_ver_figura`,
  `mesa_propor_revisao`, `mesa_geogebra`, `mesa_calcular`,
  `mesa_listar_materiais`, `mesa_salvar_nota`, mais `mesa_quiz` e
  `mesa_perguntar` (#92). No chat lateral, só as de leitura/busca/cálculo/lista,
  mais `mesa_quiz` e `mesa_perguntar`;
- saem `--extension tool-approval`, `LEARNING_DESK_TUTOR_WORKSPACE` e o
  `jailNoticeOnce`.

**Prova:** `pi --help` documenta `--no-builtin-tools` (“desabilita as nativas e
mantém extensões”), `--no-mcp`, `--exclude-tools` e `--tools` (allowlist).
O teste `tests/pi-no-native-tools.test.mjs` chama `piLaunch` com o host fake e
afirma que `extraArgs` contém `--no-builtin-tools`, `--no-mcp`,
`--exclude-tools` e `--tools`, que a lista é exatamente
`mesaToolNames({material})` (com `mesa_quiz`/`mesa_perguntar`) e que nenhum nome nativo
(`bash`, `read`, `edit`, `write`, `glob`, `grep`, `find`, `ls`, `powershell`,
`web_fetch`, `web_search`, `task`) aparece. `profiles.test.mjs` espera o perfil
sem essas ferramentas.

## 5. Ferramentas novas da Mesa

Todas seguem o padrão atual: descrição e campos em `guide.mjs`; `tool-fields.mjs`
monta zod, TypeBox e JSON Schema; o resultado volta em português (ou no idioma
do tutor). A mesma descrição chega aos três motores.

| Ferramenta | Campos | Limites | Onde mora |
|---|---|---|---|
| `calcular` | `expressao` (string), `graus` (boolean, padrão `false`) | 1..500 caracteres; parser sem `eval`, sem laço e sem I/O; `NaN`/infinito viram erro | `desk/src/extensions/mesa-calc/guide.mjs`; usa `desk/calculator.mjs` |
| `listar_materiais` | nenhum | até 200 PDFs; só a matéria/Livre da sessão; caminho canônico já autorizado | `desk/src/extensions/mesa-materials/guide.mjs`; host em `services.cjs#materialList` |
| `salvar_nota` | `titulo` (1..120), `conteudo` (1..100000) | só `Notas/` da matéria (ou da Livre); nunca sobrescreve; nome único; sem `..`, absoluto, symlink ou PDF | `desk/src/extensions/mesa-notes/guide.mjs`; host em `desk/src/study-data/course-notes.cjs` |

`calcular` não precisa de ponte: o Claude chama `calculate` no processo; o
OpenCode importa o mesmo módulo no MCP; o Pi importa na extensão. `listar_materiais`
usa a ponte de atividades (`LEARNING_DESK_ACTIVITY_BRIDGE`) com uma rota
`/materials`; `salvar_nota` usa a ponte de material (`LEARNING_DESK_MATERIAL_BRIDGE`)
com `/notes`, que já é exclusiva da sessão principal. O chat lateral recebe
`listar_materiais` e `calcular`, nunca `salvar_nota`.

**Invariante de `salvar_nota`:** novo `core/tutornotes.bend` com `noteTarget`
(raiz, título) → caminho relativo ou recusa. A lei
`core/laws/tutornotes.bend` prova que o caminho nunca sai de `Notas/` nem
aceita `..`, absoluto ou nome vazio; a prova fica em
`core/proofs/tutornotes.bend`; o artefato `desk/src/generated/tutornotes.core.js`
é regenerado e commitado. O host faz a parte de SO: `realpath` da raiz, recusa
de symlink, `O_EXCL` e `rename` atômico. PDFs e materiais de curso nunca são
tocados.

**Outras ferramentas que faltam:** nenhuma para o que os prompts pedem hoje.
`ler_pdf`, `buscar_material`, `criar_pdf`, `criar_atividade`,
`previsualizar_atividade`, `ver_figura`, `propor_revisao` e `geogebra` já
existem nos três motores. O que sai dos prompts é a promessa de shell, de
imagem salva em `PI_LEARNING_ASSET_DIR`, de subagente e de apagar arquivo.

## 6. Prompts do tutor

| Arquivo | Linha | Mudança |
|---|---:|---|
| `desk/src/agents/desk-prompts.cjs` | 75–105 | `PI_ENGINE_PROMPT`: sai “read nativo pede poppler”, “salve a imagem em PI_LEARNING_ASSET_DIR”, “peça antes de subagentes” e “antes de apagar”; entra “você não executa comandos nem edita arquivos; use as ferramentas da Mesa” |
| idem | 82–86 | `CLAUDE_ENGINE_PROMPT`: sai “ler, criar e editar arquivos e rodar comandos”; entra a mesma frase, mantendo PDF e busca |
| idem | 93–99 | `OPENCODE_ENGINE_PROMPT`: o mesmo corte |
| idem | 150–170 | `mainSessionPrompt`: acrescentar `calcular`, `listar_materiais` e `salvar_nota` à lista de ofertas, cada um em uma linha |
| `desk/src/agents/tutor-prompt-text.mjs` | 13–20 | acrescentar a abertura nova (“Você não executa comandos…”) para o histórico antigo não mostrar o prompt como fala do aluno |
| `desk/templates/TUTOR.md` | 16–18 | “Olhe as capturas e os arquivos enviados” continua; não citar shell |
| `desk/README.md` | 38 | “Pi consulta os arquivos quando necessário” vira “o tutor usa as ferramentas da Mesa” |
| `docs/manual/opencode-motor.md` | 30 | passo 9 deixa de falar em permissão `edit`/`shell`; a ferramenta não existe |
| `docs/CLAUDE-TRANSPORT-EXPERIMENTAL.md` | 60–66 | a seção de permissões vira “não há ferramenta nativa para pedir permissão” |

O texto de cada ferramenta continua em `guide.mjs`; não se escreve descrição de
ferramenta no prompt de sistema (regra do #40).

## 7. Ordem de implementação

Cada fatia é um commit e fecha com `MESA_GATE_CACHE=0 npm test`,
`npm run verify:bend` e `npm run hunts` verdes. Onde houver janela,
`npm run ui -- <filtro>` também.

| Fatia | Conteúdo | Linhas estimadas | Risco |
|---|---|---:|---|
| 1 | `calcular`, `listar_materiais`, `salvar_nota`; `core/tutornotes.bend` + leis/provas + gerado; guias, pontes, testes; nativas ainda ligadas | +700, ~80 alteradas | médio: escopo das pontes e Bend novo |
| 2 | Claude MCP-only: `tools: []`, `allowedTools` só `mcp__mesa__*`; sai `claude-adapter-permissions`, `respond`, `AskUserQuestion`; testes | −650, ~150 alteradas | médio: semântica do SDK e perguntas |
| 3 | OpenCode MCP-only: `tools`/`permission` no config, fallback inline, sem plugin/guard/sandbox; recusa pedido inesperado; testes + hunt 2.2.4 | −900, ~180 alteradas | alto: turno exige 2.x e falha fechada |
| 4 | Pi allowlist: `--no-builtin-tools` + `--tools`, sem `tool-approval`/workspace; perfil e testes | −450, ~100 alteradas | alto: extensões do curso e `pinnedExtensions` |
| 5 | Remover o resto da jaula: `tool-jail`, `tool-sandbox`, núcleo `toolsandbox`, testes, fakes, locales, docs | −2.500 | baixo, depois de 2–4 |
| 6 | Limpeza final de prompts, mapa, manuais, `prompts-leitura.md`; paridade dos três motores | ~200 alteradas | baixo |

A fatia 1 não muda comportamento: as nativas continuam ligadas, mas as
ferramentas novas já provam o caminho. A fatia 2 pode entrar sozinha; a 3 e a 4
são independentes entre si, mas dependem da 1. A 5 só começa quando nenhum
motor chama mais o classificador.

## 8. O que isso prepara para a #87

A #87 quer uma sessão só, com troca de motor no meio da conversa. Hoje a troca
carrega o passivo de cada motor: permissões, jaula, ferramentas diferentes. Com
o tutor só com ferramentas da Mesa, o contrato é um só
(`mesa-tool-catalog.cjs`), e a troca não precisa reconstruir permissão nem
ensinar o novo motor a se defender. Sobra para a #87 o que ela já previu:
resumo de passagem, PDFs anexados, matéria e ponto de parada; o descritor já
guarda motor, modelo e histórico. Nada aqui implementa a #87; só tira o atrito
de carregar dois mundos de ferramentas.

## 9. Perguntas em aberto para o Lucas

1. ~~**`ask_user` e `quiz` do Pi.**~~ Resolvido pela #92: viram `mesa_quiz` e
   `mesa_perguntar`, com cartão da Mesa, e as extensões antigas saem.
2. ~~**`AskUserQuestion` do Claude.**~~ Resolvido pela #92: `tools: []`; quiz
   e pergunta são `mcp__mesa__quiz`/`mcp__mesa__perguntar`.
3. **Destino de `salvar_nota`.** Recomendo `Notas/<titulo>.md` na raiz da
   matéria (e `Notas/` na Livre), com sufixo `-2` em vez de sobrescrever. Se
   você preferir `Sources/`, o invariante muda de pasta, não de força.
4. **Saída de `listar_materiais`.** Recomendo nome + caminho canônico absoluto,
   porque `ler_pdf` já usa caminho; só PDFs, sem `.md`/`.xopp`.
5. **Ângulo de `calcular`.** Recomendo `graus:false` (RAD) por padrão, com o
   campo explícito; não seguir o último modo da calculadora da janela.
6. **OpenCode 1.19.5.** O mesmo `tools`/`permission` vale nas duas versões, mas
   o turno exige 2.x: o adaptador usa a API v2 e o 1.19.5 responde 400
   `Missing key at ["prompt"]` (vem de antes da #91). A Mesa lê
   `opencode --version` ao conectar e recusa a 1.x com a versão na frase; a
   versão desconhecida segue sem bloquear.
7. **`desk.pinnedExtensions:false`.** Recomendo que o knob continue existindo,
   mas não reabra ferramenta nativa: o allowlist do tutor vale sempre. Se
   preferir, aposente o knob no tutor e registre na ADR.
8. **`salvar_nota` no chat lateral.** Recomendo não: o lateral é de leitura.
   Se você quiser escrever nota de lá, o grant precisa de escopo de escrita
   próprio.
