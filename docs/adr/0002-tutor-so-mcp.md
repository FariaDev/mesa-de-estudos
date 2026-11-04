# 2. Tutor só com ferramentas da Mesa por MCP

**Status:** aceita e implementada em 2026-11-01. As decisões do Lucas sobre
as perguntas da seção 9 estão registradas abaixo. A medição da #91 foi
dispensada por ele.

## Contexto

A #78 levou a jaula do tutor até o limite: classificador de shell em
`desk/src/tool-sandbox/`, confirmação do aluno, jaula de SO em
`desk/tool-jail.cjs`, plugin do OpenCode, sinal de carga da jaula e o núcleo
`core/toolsandbox.bend`. Em 2026-10-31 eram ~4.000 linhas, e o teste manual no
Mac mostrou a fragilidade: o OpenCode 2.2.4 mudou o formato de plugin e deixou
bash passar; o Pi bateu em sandbox dentro de sandbox; o diálogo de permissão
muda de formato a cada versão do OpenCode.

O tutor, porém, não precisa de shell. O que ele faz hoje cabe nas ferramentas
da própria Mesa: ler PDF, buscar material, mostrar quadro, figura e GeoGebra,
propor revisão, preparar PDF. O T3 Code (público, commit `5732bbee`) mostra o
desenho: as ferramentas do app são um servidor MCP, e o agente chama o app em
vez de receber `bash`/`edit`/`write`. O Claude recebe `tools` + `allowedTools`;
o Pi roda com `--no-builtin-tools`/`--no-tools` e uma extensão que registra as
ferramentas do app.

A #91 pediu medição antes de decidir. O Lucas dispensou a medição e decidiu:
o tutor fica só com as ferramentas da Mesa nos três motores; nada de `bash`,
`edit`, `write`, `read` nem de outra ferramenta nativa; a jaula sai do código.

## Decisão

1. **Ferramentas nativas desligadas nos três motores.**
   - Claude: `tools: []`, `allowedTools: ['mcp__mesa__*']`,
     `disallowedTools` com as nativas e `strictMcpConfig: true`; o
     `canUseTool` só libera MCP (a #92 tirou o `AskUserQuestion`).
   - OpenCode: `tools` do config com as nativas em `false`, `permission` com
     `*: deny` e `mesa_*: allow` (o `tools` sozinho não fecha `execute`, `skill`
     e `opencode_*` no 2.2.4), `OPENCODE_DISABLE_PROJECT_CONFIG=1` e sem
     `OPENCODE_CONFIG` herdado — o `opencode.json` da pasta reabriria o shell;
     sem o plugin da jaula. Falha ao gravar o config sobe o servidor com o
     mesmo JSON inline; nunca cai em `ask`.
   - Pi: `--no-builtin-tools`, `--no-mcp` e `--exclude-tools` para nomes de
     MCP, mais `--tools` com o allowlist de `mesa-tool-catalog.cjs` (as
     extensões de cartão incluídas); sem a extensão `tool-approval` e sem
     `LEARNING_DESK_TUTOR_WORKSPACE`.
2. **A jaula sai.** São removidos `desk/tool-jail.cjs`, `desk/jail-notice.cjs`,
   `desk/src/tool-sandbox/`, `core/toolsandbox.bend` e suas leis/provas,
   `desk/src/extensions/tool-approval/`, `desk/src/extensions/opencode-jail/`,
   `desk/src/agents/opencode-sandbox.cjs`, `desk/src/agents/opencode-turn-guard.cjs`,
   `desk/src/agents/claude-adapter-permissions.cjs` e os testes/fakes
   correspondentes.
3. **Três ferramentas novas**, iguais nos três motores:
   - `calcular`: reaproveita `desk/calculator.mjs` (parser sem `eval`, sem laço,
     teto de 500 caracteres);
   - `listar_materiais`: lista os PDFs da matéria/Livre da sessão, até 200;
   - `salvar_nota`: grava `Notas/<titulo>.md` dentro da matéria (ou da Livre),
     nunca sobrescreve e nunca sai da pasta.
   A #92 acrescenta `quiz` e `perguntar`: o cartão aparece na conversa e o
   resultado volta numa mensagem nova, sem prender o turno. A forma do cartão
   é invariante em `core/quizcard.bend`, com provas; a interface fica em JS.
4. **Invariante no Bend.** “O tutor nunca escreve fora da pasta da matéria”
   vira `core/tutornotes.bend`, com lei em `core/laws/tutornotes.bend` e prova
   em `core/proofs/tutornotes.bend`; o artefato
   `desk/src/generated/tutornotes.core.js` é regenerado e commitado, conforme a
   ADR 0001. O host faz a parte de SO (realpath, symlink, `O_EXCL`, `rename`).
5. **Prompts.** Os trechos que prometem shell, imagem em
   `PI_LEARNING_ASSET_DIR`, subagente ou apagar arquivo saem de
   `desk/src/agents/desk-prompts.cjs`. O tutor passa a dizer que só usa as
   ferramentas da Mesa.

O desenho completo, com inventário por arquivo, evidência dos binários e
fatias, está em [`docs/design/tutor-so-mcp.md`](../design/tutor-so-mcp.md).

## Consequências

- **Ganha-se** previsibilidade: o tutor não depende de `bwrap`, `sandbox-exec`,
  formato de plugin do OpenCode, diálogo de permissão ou versão de CLI para
  fazer o que faz. O mesmo catálogo de ferramentas vale nos três motores, o que
  prepara a #87 (sessão única com troca de motor).
- **Perde-se** a capacidade de rodar comandos, ler arquivo arbitrário, editar
  texto e gerar imagem por script. Quem precisar disso no futuro cria uma
  ferramenta da Mesa com escopo, teste e invariante; não reabre a nativa.
- **O Pi perde ferramentas de extensão** que não estejam no allowlist.
  A #92 tirou `ask_user`/`quiz` do perfil: quiz e pergunta agora são cartões
  da Mesa (`mesa_quiz`/`mesa_perguntar`, `mcp__mesa__quiz`/`mcp__mesa__perguntar`,
  `mesa_quiz`/`mesa_perguntar` no OpenCode).
- **O config vale nas duas versões; o turno exige 2.x.** O 1.19.5 resolve o
  mesmo `tools`/`permission`, mas o adaptador fala a API v2 do `serve` e ele
  responde `400 InvalidRequestError: Missing key at ["prompt"]` a todo turno —
  isso vem de antes da #91. O 2.2.4 traduz `tools` para permissões `deny` e é
  o alvo do turno; a Mesa recusa a 1.x ao conectar, com a versão na mensagem.
- **A falha fechada muda de lugar:** antes era a jaula que precisava carregar;
  agora é o config de ferramentas que precisa ser gravado. Se ele não puder ser
  gravado, o servidor não sobe com as nativas ligadas.
- **O `config.cjs` não muda.** `desk.pinnedExtensions` continua existindo, mas
  não reabre ferramenta nativa no tutor: o allowlist vale sempre.

## Decisões do Lucas (2026-11-01)

1. ~~`ask_user` e `quiz` do Pi continuam no allowlist, listados por nome.~~
   Substituído pela #92: o quiz e a pergunta passam a ser cartões da Mesa nos
   três motores e as extensões antigas saem do perfil.
2. ~~O `AskUserQuestion` do Claude fica, junto com `mcp__mesa__*`...~~ A #92
   removeu a pergunta nativa: `tools: []` e `canUseTool` só libera MCP. O
   `claude-questions.mjs` e a validação continuam para o diálogo genérico de
   revisão; o `question` nativo do OpenCode já estava desligado.
3. `salvar_nota` grava em `Notas/<título>.md` na raiz da matéria (na Livre, em
   `Notas/` do workspace), com sufixo `-2`, `-3`… e nunca sobrescreve.
4. `listar_materiais` devolve o nome e o caminho canônico absoluto, só de PDFs
   da biblioteca da sessão, até 200.
5. `calcular` usa `graus:false` (RAD) por padrão, com o campo explícito; não
   segue o último modo da calculadora da janela.
6. O mesmo `tools`/`permission` trava as nativas no 1.19.5 e no 2.2.4, mas o
   turno exige 2.x: o adaptador usa a API v2 e o 1.19.5 responde 400
   `Missing key at ["prompt"]`; isso vem de antes da #91. A Mesa recusa a 1.x
   ao conectar, com a versão na mensagem.
7. `desk.pinnedExtensions` continua existindo, mas não reabre ferramenta
   nativa; o allowlist do tutor vale sempre.
8. O chat lateral não recebe `salvar_nota`; recebe `listar_materiais`,
   `calcular`, `ler_pdf`, `buscar_material` e os cartões `quiz`/`perguntar`
   (com concessão própria, chaveada pelo id `sc-…`).

## Alternativas consideradas

- **Manter a jaula e o MCP como estão.** É o caminho da #78; cada versão nova
  de harness reabre o mesmo teste manual e a mesma fragilidade. Rejeitada pela
  decisão do Lucas.
- **Jaula opcional (modo avançado).** Mantém as duas superfícies e o dobro de
  testes; o tutor continuaria precisando de shell para justificar a jaula.
  Rejeitada: não há uso de shell que as ferramentas da Mesa não cubram.
- **Seguir o T3 Code ao pé da letra, mantendo as nativas.** O T3 ainda oferece
  `bash`/`edit` e usa permissão/sandbox para contê-los. A Mesa quer menos
  superfície, não a mesma; aproveitamos o padrão MCP e o allowlist, não a
  política de ferramentas nativas.
- **Trocar o Pi por um adaptador MCP (`pi-mcp-adapter`).** As cascas atuais já
  são finas e compartilham o mesmo código; o adaptador adicionaria dependência
  sem tirar código. Rejeitada por enquanto.

## Referências

- Issue #91 (decisão e critérios) e #87 (sessão única com troca de motor).
- ADR 0001 (Bend só para invariantes de domínio).
- T3 Code, commit `5732bbee`: `apps/server/src/mcp/McpHttpServer.ts`,
  `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts:1544,1691,1714`,
  `packages/provider-pi/src/server/mcpInjection.ts:64,273`,
  `packages/provider-opencode/src/server/adapter.ts:595`.
