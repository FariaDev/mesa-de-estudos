# Motor OpenCode: o grátis do Zen sem resposta (403 `FreeTierError`) — resultado

Data: 2026-10-20. OpenCode CLI v2.0.32. Branch `claude/magical-mclaren-d928c3`,
commits locais, sem push e sem PR.

| Commit | O quê |
|---|---|
| `0a82329` | Erro do provedor visível na conversa; frase própria para o 403 do grátis |
| `b7f6c11` | O servidor cunha o `ses_` da sessão; o grátis responde |
| (este) | Manual, mapa e este relatório |

## Causa

O Zen recusa os modelos grátis quando o **id da sessão não saiu do gerador do
próprio OpenCode**. A Mesa cunhava o seu (`ses_` + 16 bytes em base64url) e o
mandava no `POST /api/session`; o `opencode run` deixa o servidor cunhar.

### Prova

Tudo contra o mesmo `opencode serve --hostname 127.0.0.1 --port 47911` puro,
com `deepseek-v4.1-flash-free` e "Diga só: oi". As sondas foram um script em
pasta temporária fora do repositório (`fetch` cru nas rotas do serve), sem
mudar nada no repo. A senha do serve era uma de teste, e nenhuma credencial foi
lida.

| Caso | Corpo do `POST /api/session` | Resultado |
|---|---|---|
| `opencode run --server …` (sem `--session`) | o cliente oficial; o servidor cunha `ses_ea5e2cf67ffe…` | responde "oi" |
| sonda, sem `id` | `location` + `model` | responde "oi" |
| sonda, sem `id`, com as 4 permissões de estudo | `location` + `model` + `permissions` | responde "oi" |
| sonda, `id` no formato da Mesa | `ses_EbonCQkDQ8ct0IV_r6RrbA` | `session.step.failed` + `session.execution.failed`, 403 `FreeTierError` |
| **`opencode run --session ses_CFvHtzo0icooIRtiPvv5PA`** (cliente oficial, id no formato da Mesa) | o próprio `run` cria a sessão com esse id | **403 `FreeTierError`** |
| sonda, `id` no formato nativo (`ses_` + 12 hex de tempo + 14 base62) | `ses_ea5e2000affeZzYyXxWwVvUuTt` | responde "oi" |
| sonda, `ses_` + 26 base62 aleatórios (sem o prefixo de tempo em hex) | `ses_XC2vGCQXUr6bwzTdawh9m0s1zZ` | 403 |

Só o id muda o resultado, e o cliente oficial com o id da Mesa também leva o
403. Então o bloqueio não depende de qual programa chama: ele confere o
formato (o prefixo de tempo) do id que o OpenCode manda ao provedor no
cabeçalho `x-opencode-session`. As hipóteses que a sessão anterior descartou
(user-agent, 64 hex, sessão sem permissões, ambiente) batem com isso: nenhuma
gerava um id do gerador do OpenCode.

## Conserto

Escolha do usuário entre três saídas: (1) o servidor cunha o id, (2) a Mesa
imita o formato, (3) só o erro visível. A opção (2) moldaria o id para passar
no filtro do provedor, e por isso não foi usada. Foi a (1), a rota oficial do
OpenCode.

- **O `ses_` vem do servidor.** O descritor `opencode-<uuid>.json` nasce com
  `nativeSessionId: null`. Na primeira ligação, o `OpenCodeAdapter` faz o
  `POST /api/session` **sem `id`**, adota o `ses_` devolvido
  (`adoptSession`) e chama `onSessionId`. O host grava esse id no descritor uma
  vez. A regra (`null` → `ses_` uma vez; depois imutável pelo
  `sameNativeIdentity` do núcleo) mora em `desk/src/agents/native-identity.cjs`,
  fora do `conversations.cjs`, que estava no teto de 500 linhas. Reabrir,
  recriar a sessão sumida e trocar de servidor mandam o id guardado, que o
  servidor aceita (medido). Saiu o `mintWireSessionId`, e `core/` não mudou.
- **Erro visível em qualquer caso.** `session.step.failed` guarda o erro do
  passo; `session.execution.failed` emite um `error` não fatal
  (`OPENCODE_TURN_FAILED`, `fatal: false`) antes do `turn_end`, um por turno,
  com a frase do provedor como mensagem marcada
  (`opencode.event.providerFailed`: "O OpenCode não respondeu: {reason}"). O 403
  `FreeTierError` tem frase própria (`opencode.event.freeTier`): "O OpenCode Zen
  recusou o modelo grátis nesta sessão (403). Comece uma sessão nova do
  OpenCode ou escolha um modelo da sua conta." As duas estão em `pt-BR.json` e
  `en.json`. Passo que falha e turno que termina bem não geram aviso. A janela
  mostra a frase no diário do turno e num aviso rápido; a conexão fica de pé.

### Prova com modelo real (depois do conserto)

Script fora do repo usando o `OpenCodeAdapter` da worktree, com o grátis
DeepSeek e "Diga só: oi":

| Caminho | Resultado |
|---|---|
| Adaptador contra `opencode serve` puro, sessão nova | id adotado `ses_ea5325245ffe…`, resposta "oi", sem erro |
| Adaptador pelo `createServeOwner` da Mesa (o serve que o app sobe, com ledger) | id adotado `ses_ea531f8f9ffe…`, resposta "oi"; ledger vazio ao parar |
| Adaptador com um id no formato antigo da Mesa | `error` com `opencode.event.freeTier`, `fatal: false`, `turn_end` com `isError` |

Os serves que subi foram encerrados pela porta/pid exatos. Os dois
`opencode serve` que continuam vivos (`--service` de 2026-10-19 e um
`--port 0` de 13:02) já existiam antes e não foram tocados.

## Testes novos ou mudados

- `tests/opencode-events.test.mjs`: o 403 vira um `error` com a frase própria;
  `execution.failed` sem erro usa o do passo; passo que falha com turno que
  termina bem não avisa; sem frase cai no genérico.
- `tests/opencode-adapter.test.mjs`: `connect` vai sem `id` e adota o do
  servidor (regressão do 403); servidor trocado recebe o id já cunhado, gravado
  uma vez; reabrir manda o id guardado; o 403 do fake vira `error` antes do
  `turn_end` com erro, com entrega `accepted` → `settled`.
- `tests/native-identity.test.mjs` (novo) e `tests/opencode-conversations.test.mjs`:
  `null` → `ses_` uma vez, imutável depois, `null` e formato errado recusados.
- `tests/fake-opencode.mjs`: `FREE_TIER_403` medido e `failTurn: 'free-tier'`
  / `FAKE_OPENCODE_FAIL=free-tier`.
- `tests/opencode-free-tier-ui.mjs` (novo, janela): a frase aparece na coluna
  da conversa (fora do aviso rápido), o envio volta e o tutor segue online.
  Conferido ao contrário: com a frase esperada trocada por uma falsa, o teste
  falha por prazo.
- `tests/opencode-ui.mjs`: a sessão é criada sem `id`, o descritor guarda o
  `ses_` do servidor e o prompt vai a ele; cada conversa tem o seu.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | Verde: 68 artefatos reproduzíveis, "All terms check." |
| `MESA_GATE_CACHE=0 npm test` | Verde: 1848 testes, 0 falhas |
| `npm run typecheck`, `npx eslint .` | Limpos |
| `npm run test:claude-ui` | Verde até o fim (10 arquivos) |
| `npm run test:packaged` | Verde |
| `npm run ui -- opencode,free-models,ui-smoke` | 4 ok (`opencode-free-tier-ui`, `opencode-ui`, `free-models-ui`, `ui-smoke`), repetido com `MESA_GATE_CACHE=0` |
| Arquivos com `FAKE_PI`/`fakePiSource` | O `fake-pi.mjs` não mudou; nada a rodar por ele |

## O que ficou sem prova

- **O MiniMax M3.1 Flash Free:** só o DeepSeek foi chamado, por ser o de
  retenção zero. O MiniMax deve se comportar igual, porque o bloqueio olha o id
  da sessão e não o modelo, mas isso não foi medido.
- **O app instalado:** não rodei `install-app` (regra). A janela foi provada
  contra o fake, e o modelo real pelo adaptador e pelo dono do servidor da Mesa
  num script.
- **Conversas OpenCode antigas:** a sessão no servidor já existe com o id da
  Mesa e segue com 403 nos grátis. A frase manda abrir sessão nova; não há
  migração automática, porque o id nativo é imutável.
- **A regra exata do Zen:** se ela confere só o prefixo de tempo, ou também a
  idade ou a ordem do id, não foi isolado além das sondas acima. Uma versão
  futura do OpenCode pode mudar o gerador. Como o id vem sempre do servidor, a
  Mesa acompanha.
- **O roteiro manual** `docs/manual/opencode-motor.md` (passos 2 a 11) segue
  sem execução.
