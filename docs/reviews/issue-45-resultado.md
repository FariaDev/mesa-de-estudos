# Issue #45 — Avisos de atualização do Pi e do Claude Code (resultado)

Branch `claude/laughing-chaum-acc5bd`, cortada de `38062bf`. Sem push, sem PR, sem
subagentes, sem inferência real. Não rodei `brew upgrade`, `npm i -g` nem
`claude update` de verdade (os testes usam `brew`/`npm`/`claude` falsos e nomeados,
em `desk/tests/fake-tool-binaries.mjs`). O Claude Code só foi consultado por
`--version`: nada de `auth status`, login nem inferência. Não rodei `npm run setup`,
`update` nem `install-app`; o bundle e os defaults de `desk/config.cjs` ficaram intocados.

## O que mudou

- **Claude Code entra em "O que a Mesa usa"**: versão por `claude --version`, mais nova
  pelo registro de `@anthropic-ai/claude-code`, e a versão do binário de reserva do SDK (#32).
- **Conferência diária comum** para Pi e Claude Code (cache de 24 h em `update.json`).
  Sem rede: nenhum aviso e nenhum erro; a linha diz "não deu para conferir".
- **Aviso discreto**: ponto no ⚙ (título "Ajustes · há uma atualização") e uma linha por
  ferramenta no topo do Sobre. Sem toast, sem modal. O ponto some ao abrir o Sobre e só
  volta para uma versão mais nova. "Lembrar depois" e "Ignorar esta versão" ficam no
  estado de interface (`desk.json`, `toolNotices`), nunca no `config.json`.
- **Atualizar pelo instalador que a pessoa usa**:

  | Instalação | Ação |
  |---|---|
  | Pi da Mesa (`desk/.pi-local`) | o botão de sempre ("Atualizar o Pi") |
  | Pi pelo Homebrew | confirmação → `brew upgrade <fórmula>` |
  | Pi pelo npm global | confirmação → `npm i -g @earendil-works/pi-coding-agent` |
  | Claude Code | confirmação → `claude update` |
  | Não reconhecida | só o comando, com **Copiar** |

  A confirmação mostra o comando exato; nada roda antes do clique. A saída aparece numa
  área rolável (rabo de 64 KB, sem códigos ANSI) e o resultado vem em uma frase. A ação
  fica desligada, com a dica, enquanto o tutor responde. Depois de atualizar, o tutor religa.
- **"Testada com esta Mesa"** (`desk/src/tested-versions.json`: Pi 1.3.0, Claude Code
  2.1.301): versão mais nova aparece como "mais nova que a testada" e a confirmação avisa.
  Nunca bloqueia.
- **Decisão no núcleo Bend**: `core/updatenotice.bend` (65 leis e provas, `upd_*`):
  `noticeOf`, `afterOpen/afterPostpone/afterIgnore`, `doneSentence` e os nós da linha,
  da ação e da confirmação. `core/proofs/dialogsview.bend` ganhou 4 provas.
  Os artefatos regenerados estão commitados; o portão não achou `@unsafe`.

## Decisões que valem registrar

- **Os avisos nunca executam o Pi**: leem só o `package.json` (`readOnly`). `pi --version`
  carrega extensões, e o teste `free-host-ipc` pegou o Pi falso subindo com `cwd` fora da
  matéria/Livre na abertura. Teste de regressão: "notices: nunca executa o Pi para ler a versão".
- **Bug achado pelas provas**: `verMax(NoVer, x)` devolvia `NoVer` e teria quebrado o
  primeiro "ver" e o primeiro "ignorar". Corrigido no núcleo (lei `upd_maior_com_sem_versao`).
- O ponto e as linhas só dependem do que o main calcula pelo núcleo; o renderizador só liga
  os cliques. Comandos nunca são montados com texto do renderizador (a fórmula do Homebrew
  passa por uma lista de caracteres seguros).
- Os ganchos de teste (`LEARNING_DESK_TOOL_LATEST`, `LEARNING_DESK_TOOL_FAKE_BIN`,
  `LEARNING_DESK_CLAUDE_LAUNCHER`) só valem com `DESK_TEST=1`.
- Vocabulário: o nome "Pi" aparece só no Sobre e nas Configurações; o título do ⚙ diz
  "atualização", sem nome de programa.

## Portões

Rodada completa feita depois do rebase sobre o `main` local (`5cc08f3`, com a #48 e as R1–R3),
em sequência e sem sobrepor outra sessão, no commit final desta branch:

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | verde: "All terms check", 89 artefatos reproduzíveis |
| `MESA_GATE_CACHE=0 npm test` | verde: 1398 passam, 0 falham (inclui o teto de esperas fixas da #48) |
| `npm run ui` | verde: 60 janelas ok, 0 falhas, 3 por vez, 242 s |
| `npm run hunts` | verde: 23 ok, 0 falhas, 1 pulado (`hunt-handoff`: a Conversa, `chat/`, não está instalada aqui) |
| `npm run test:claude-ui` | verde |
| `node tests/tool-updates-ui.mjs` com `MESA_REVIEW_SHOTS` | verde nos 5 cenários; 27 capturas em `learning-canvas-capturas/issue-45/` |

Rodadas anteriores a esta (antes do rebase, sobrepostas às medições da #48) foram descartadas.
O que elas mostraram valeu como pista e virou correção, abaixo.

## Falhas que a janela achou e o que mudou

- `sidechat-claude-ipc-smoke.mjs` e `claude-ui-smoke.mjs` trancavam "o binário do Claude nunca
  roda". O Sobre agora roda `claude --version` (é o pedido da issue), então as duas travas
  passaram a ignorar só as linhas terminadas em `--version`; login, `auth` e inferência
  continuam proibidos e contados.
- `claude-sdk-binary-ui.mjs` (#32) exige que o binário de reserva do SDK nem seja consultado
  quando o do usuário está no par. Os avisos da abertura chamavam `<reserva> --version`. Corrigi
  no código: `collectTools` com `readOnly` não consulta a reserva (ela só aparece no Sobre).
  Regressão: "notices: nunca consulta o binário de reserva do SDK".
- `tool-updates-ui.mjs`: esperas fixas trocadas por `nextFrames` e por uma leitura de
  `toolNotices()` (regra da #48); a asserção do cenário offline confere linhas, ponto e
  `unreachable`, sem exigir o formato inteiro do resumo.

## Ajustes feitos ao rodar a janela

- `LEARNING_DESK_TOOL_PI_PATH` (só com `DESK_TEST=1`): o Pi "instalado" que os avisos leem
  fica separado do `LEARNING_DESK_PI` que o tutor executa. Sem isso o teste de janela não
  tinha tutor online.
- `fake-tool-binaries.mjs` ganhou `install: 'solto'` (pacote com `package.json` numa pasta que a
  Mesa não reconhece). `unknown` segue sendo o script solto sem `package.json`, cuja versão
  nem é lida.
- Consequência de produto a notar: com instalação `unknown` (sem `package.json` por perto) a
  versão do Pi não é lida, então não há aviso nem ação; o "só o comando, com Copiar" vale para o
  pacote encontrado fora do Homebrew e do npm global.
