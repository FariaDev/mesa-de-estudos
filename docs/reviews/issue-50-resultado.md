# Issue #50 — aposentar o app Conversa

Data: 2026-10-16. Ticket: <https://github.com/FariaDev/mesa-e-conversa/issues/50>.
Branch: `claude/cranky-bassi-ccedc5` (commits locais; nada foi publicado).
Base: `6892454`.

O usuário não usa mais a Conversa; a aba Livre da Mesa ocupa o lugar dela.

## Tag de recuperação

`conversa-final` aponta para `6892454`, o último commit com `chat/`, o bilhete e os
14 núcleos só da Conversa. Ela foi criada **antes** de qualquer remoção e é
**local**: não foi enviada ao remoto. Para ver o código antigo:

```sh
git show conversa-final:chat/README.md          # ler um arquivo
git worktree add ../conversa conversa-final     # abrir a árvore inteira
```

## O que saiu

| Camada | Removido |
|---|---|
| App | `chat/` inteira: 158 arquivos rastreados (~43 mil linhas), com `package.json`, lockfile, scripts e testes |
| Núcleo | 13 módulos só da Conversa — `chatlist`, `comfortview`, `findbar`, `gaugeview`, `keysview`, `lightboxview`, `msgview`, `notifyview`, `paletteview`, `popoverview`, `searchview`, `toolpolicy`, `welcomeview` — e o `handoff`, cada um com leis e prova (42 arquivos `.bend`) |
| Build e portão | entradas do `core/build.mjs` e do `core/PROOF.bend`; `GEN_DIRS` de `core/verify.mjs` agora é só `desk/src/generated`; `gate-hash.mjs` e `coregate.test.mjs` sem `chat/src/generated` |
| Artefato | `desk/src/generated/handoff.core.js` |
| Bilhete na Mesa | `desk/handoff.cjs`; o ciclo do bilhete em `desk/send.cjs` (agora só `deliverPrompt`); os ganchos `onHandoff`/`onHandoffProblem` do `preload.cjs`; o recebimento no `main.cjs` e os avisos em `src/main.mjs`; o check de `desk/scripts/doctor.mjs` |
| Testes | `handoff.test.mjs`, `hunt-handoff.mjs`, `snapshot.test.mjs`; `appcontract.test.mjs` virou `rpc-contract.test.mjs` (só a Mesa); `send.test.mjs` reescrito sem bilhete |

`core/search.bend` **não** saiu, apesar de ser da Conversa: `pdfref.bend` e
`studysearch.bend` o importam. Por isso 13 dos 14 artefatos "só da Conversa"
saíram, e `search` ficou. Antes de cada remoção a busca com `rg` confirmou que
a Mesa (`desk/`) não importava o núcleo.

**Bytes de `desk/src/generated/`:** o `verify:bend` reporta "62 artefatos
reproduzíveis (nenhum byte mudou)". A única diferença na pasta é o
desaparecimento de `handoff.core.js`. Nenhum outro artefato mudou, e o
`--pin` não alterou `core/toolchain.json`. Comentários de `.bend` que citavam
`chat/` foram atualizados; o portão confirmou depois que isso não muda byte.

## O que ficou e por quê

- **`[Da Conversa]` em `desk/text.mjs` e `core/sessions.bend#mesaSuffix`.**
  Sessões gravadas antes da #50 trazem o bloco no fim da mensagem; sem o padrão
  elas voltariam a mostrá-lo no transcript e na lista. Só o comentário mudou.
- **A pasta `<runtime>/handoff/`** não é lida nem apagada pela Mesa. O backup a
  trata como arquivo comum do runtime (vai e volta byte a byte).
- **`core/search`, `statusview`, `composerview`, `talkview`, `state`, `attachments`,
  `slashview`, `framing`, `sessions`…** eram compartilhados: continuam e só
  deixam de gerar para `chat/`. `statusview.footStatus` perdeu o único consumidor
  (o rodapé era da Conversa); fica no núcleo, anotado em `core/README.md` e
  `desk/UI-PORT.md`, para uma limpeza própria.
- **Capacidade `handoff` do contrato de motores** (`desk/src/agents/`): sem
  consumidor na UI, mas é parte do contrato dos adaptadores Pi/Claude, e tirá-la
  mexe em `claude-adapter.cjs` e nos testes de contrato. Fica como follow-up.
- **`.gitignore`** mantém `chat/node_modules/`, `chat/.runtime/`,
  `chat/.test-runtime-*/` e `Conversa.app/`, com comentário: instalações antigas
  ainda têm esses restos, e eles não devem aparecer como arquivo novo.
- **A regra "Dois apps" do `AGENTS.md`** continua: ela trata da Mesa e do
  programa de escrita (Xournal++), não da Conversa, e `agents-md.test.mjs` a
  exige. Saiu a regra "Mesa e Conversa não se embutem"; entrou a que diz que o
  chat avulso mora na aba Livre.
- **Docs históricos** (`docs/reviews/**`, `docs/design/**`, `docs/STATUS-*`,
  `docs/REVIEW-*`, `docs/RESILIENCE-*`, `docs/AVALIACAO-*`, `docs/PLANO-*`)
  mantêm as menções: são registro do que era verdade na data.
- **Testes com `chat/` por motivo válido:** `updater.test.mjs` (lista de caminhos
  que o updater não toca) e `updateflow.test.mjs` (instalação antiga com `chat/`).
- **Menções a "Conversa" que são outra coisa:** `lib.cjs` troca o rótulo
  "Conversa" por "Sessão" (o núcleo `sessions` ainda diz "Conversa" sem data), e
  `CONTEXT.md`/UI falam de "conversa" como sinônimo de sessão.

## Dado antigo continua abrindo

Testes de regressão, com fixture antigo (a tag guarda o código que o escrevia):

- `desk/tests/conversa-aposentada.test.mjs` (unitário): `displayUserText` e
  `sessionPreviewFromJsonl` cortam o bloco `[Da Conversa]` (sozinho, depois de
  `[Contexto da Mesa]` e com referências trazidas); o backup leva e restaura
  `handoff/` em todas as fases (`conversa.json`, `reivindicado-*`, `enviando-*`,
  `entregue-*`, `arquivo/`, `falha/`, `duvida/`); e o código vivo da Mesa não
  menciona mais o bilhete nem depende de `chat/`.
- `desk/tests/conversa-aposentada-ui.mjs` (janela, com o Pi de mentira): a Mesa
  abre com `handoff/` completa e uma sessão antiga; a mensagem antiga aparece
  sem o bloco; o preload não expõe mais o bilhete; um turno novo **não** leva o
  `conversa.json` pendente; nenhum aviso de bilhete aparece; a pasta antiga fica
  intacta (hash do conteúdo igual antes e depois).

## Updater e instalação

- O updater já nunca tratava `chat/` como gerenciado (`isReplaceable` não o
  aceita; `removeOrphans` recusa entrada fora da lista). A #50 não mudou
  `desk/updater.cjs`. O teste novo em `desk/tests/updateflow.test.mjs`
  ("#50: instalação antiga com chat/ no disco…") monta uma instalação com
  `chat/` (código, `node_modules`, `.runtime`), manifesto antigo que lista
  caminhos de `chat/`, `handoff.cjs` e módulos da Conversa, e aplica um zip
  novo: `chat/` fica intacto, os órfãos gerenciados saem, o log diz
  "entrada de manifesto recusada: chat/main.cjs" e o manifesto novo não lista
  `chat/`.
- **Modo git:** o `git pull --ff-only` remove os arquivos rastreados de `chat/`
  (isso é o git, não o updater); o que ele ignora (`node_modules`, `.runtime`)
  fica. Está documentado em `docs/agents/release.md` e `desk/SETUP.md`; não há
  teste, porque o comportamento é do git.
- `docs/agents/release.md`: o snapshot público não tem `chat/` e fecha o portão
  sem `--no-verify` por causa do app irmão.

## Docs atualizados

`AGENTS.md`, `README.md`, `CONTEXT.md`, `desk/SETUP.md`, `desk/UI-PORT.md`,
`core/README.md` (agora 65 provas, 64 arquivos de leis, 2.903 declarações `law`,
62 saídas), `docs/agents/mapa.md` (linha do bilhete vira a do ciclo de envio e
as fases do protocolo saem), `docs/agents/portoes.md` (sem `hunt-handoff` e sem
`chat/`; cita `desk/scripts/doctor.mjs` e `desk/tests/native-rpc.mjs`),
`docs/agents/release.md`, `claude-mod/AGENTS.md`, `codex-plugin/AGENTS.md` e
comentários de código. `native-rpc.mjs`, `native-mcp.mjs` e
`rpc-settled.test.mjs` passaram a exercitar só a Mesa (`native-rpc` usa
`pinnedArgs` no lugar do `spawnArgs` da Conversa).

## Tempo do `verify:bend`

| | Relógio | CPU (user) | Artefatos |
|---|---|---|---|
| Antes | 1:02,2 | 79,3 s | 91 |
| Depois (3 execuções) | 1:04,4 · 0:56,6 · 1:26,0 | 78,2 · 74,7 · 98,5 s | 62 |

O tempo quase não mudou, e o ruído da máquina (a última execução rodou com
carga) é maior que a diferença. A razão: os 29 artefatos que saíram eram cópias
dos da Mesa, geradas junto com ela, e o custo do portão está em `bend PROOF.bend`
(provas), que perdeu só os módulos da Conversa. O ganho aqui é de superfície
(29 artefatos a menos, 42 arquivos `.bend` a menos, ~43 mil linhas de app), não
de relógio.

## Testes

Escopo combinado com o usuário no fim do ticket: a bateria completa
(`npm run ui` sem filtro, `npm run hunts`, `test:claude-ui`) roda uma vez no
`main`, a cada 2 ou 3 tickets, e **não** foi rodada aqui. Rodado neste ticket:

| Portão | Resultado |
|---|---|
| `npm run verify:bend` + `--pin` | verde; 62 artefatos reproduzíveis, nenhum byte mudou, `toolchain.json` sem diff |
| `MESA_GATE_CACHE=0 npm test` | 1381/1381 (+5/5 do portão do núcleo). Uma rodada anterior reprovou 2 testes de Electron (`free-host-ipc`, `study-ipc`) por "o app não fechou em 15 s", com a suíte inteira em paralelo; isolados e na rodada seguinte passaram |
| `npm run ui -- conversa-aposentada,free-study,material,settings,first-run,sidechat,chat,composer,send,tutor,settled,qol,ui-smoke` | 28 ok, 0 falha, 0 pulados (191 s) |
| `node tests/native-tool-parity.mjs` | ok |

Não rodados: `npm run ui` completo, `npm run hunts`, `test:claude-ui`,
`native-tutor-pdf` e `native-activity-tool`; `native-rpc.mjs` e `native-mcp.mjs`
foram portados para a Mesa e só passaram por `node --check` (exigem o Pi real ou
o SDK instalado). Antes dos testes de janela confirmei que não havia Electron de
outra worktree (só o bundle instalado do usuário, que não toquei).

**Áreas tocadas, para observar na rodada completa:** o envio e a fila do chat
principal (`send.cjs`, `main.cjs`: `pi-prompt`, `onAccepted`); toasts e
`preload` (saíram `onHandoff`/`onHandoffProblem`); a aba Livre (sessões antigas
com `[Da Conversa]`); o `doctor`; o backup do runtime (`handoff/`); o updater
(instalação com `chat/`). Hunts que valem na rodada: `chat`, `queue`, `timeline`,
`chaos` (o `handoff` deixou de existir). Sugestão de filtros da tabela de
`portoes.md`: "Chat principal, turnos e fila" e "Estudo livre e materiais".

## Tamanho do #49 sem a Conversa

O #49 (migrar a fronteira `Nat` de `BigInt` para `number`) perde o lado da
Conversa inteiro: os itens "Conversa", "testes e paridades do `chat/`" e a
regeneração de `chat/src/generated` somem, e o teste que trava a regra passa a
varrer só `desk/`. A contagem de `BigInt(`, `bigint` e literais `\d+n`, com o
mesmo padrão, antes e depois da #50:

| Onde | Linhas | Arquivos |
|---|---|---|
| `desk/` antes (tag `conversa-final`) | 110 | 37 |
| `desk/` agora | 110 | 37 |
| `chat/` antes (some) | 12 | 10 |

A #50 não toca no `Nat` da Mesa (nenhum arquivo do `desk/` que usa `BigInt`
foi removido), então o trabalho que sobra é o da Mesa, igual ao de antes: ~110
linhas em 37 arquivos nesta contagem (o ticket estimou ~190 usos em 42 arquivos
com outra regra de busca; a lista do relatório do #47 manda). Os helpers
repetidos `nat = (n) => BigInt(n)` caíram de 4 para 3 (`chat/rpc.cjs` saiu;
sobram `desk/rpc.cjs`, `desk/src/activity-view.mjs` e `desk/src/layout-presets.mjs`).
Também some a metade do refixar: 62 artefatos em vez de 91 para regenerar e
conferir, e uma única suíte (a da Mesa) para ficar verde. A Conversa tinha 307/340
testes verdes no HEAD do Bend; esse passivo sai junto. O limite de 2^53 e o `F32`
só precisam ser levantados para a Mesa. Na prática o #49 fica restrito ao `desk/`
e ao núcleo, que é o escopo que sobraria de qualquer modo para a regra
"biblioteca atrás de uma casca".

## Follow-ups

- Tirar a capacidade `handoff` do contrato de motores (`desk/src/agents/`).
- Decidir o destino de `statusview.footStatus` (sem consumidor).
- Apagar, quando o usuário quiser, a pasta `handoff/` do runtime e a `chat/`
  que ainda estiver no disco dele: nada disso é feito automaticamente.
