# #51: Claude Code do usuário, faixa de versões e sem binário reserva

Resultado da issue #51. A Mesa passa a usar sempre o Claude Code que a pessoa
instalou, aceita uma faixa de versões em vez da versão exata e não procura mais
o binário de reserva do SDK. Os commits ficam locais, na branch da worktree. Não
houve push nem PR.

## O defeito, em uma linha

`CLAUDE_PINNED_VERSION = '2.1.301'` aceitava uma versão só. A reserva do #32
(o binário do SDK, na versão do par) não existe no `Mesa de Estudos.app`,
porque o `bundle-runtime.cjs` a deixa fora de propósito (`externalClaude`). No
app instalado, o Claude Code 2.1.296 do usuário derrubava o tutor com
"ClaudeAdapterError: Versão do Claude Code fora do pareamento desta ponte".
Nenhum teste rodava o bundle. Todos rodavam a partir de `desk/`, onde o binário
do SDK existe.

## A faixa escolhida

**Aceita `>= 2.1.296` e `< 2.2.0`.** A faixa sai de `desk/src/tested-versions.json`,
a tabela "testada com esta Mesa" do #45, que vira a fonte única:

```json
"claude": "2.1.301",
"claudeMinimum": "2.1.296"
```

- O `claude` testado é a referência da série (`2.1.x`). É o mesmo número que o
  Sobre usa para "mais nova que a testada". Não há outro literal no código: o
  `CLAUDE_RANGE` do `claude-environment.cjs` lê a tabela, e um teste
  (`#51: a tabela "testada com esta Mesa" é a fonte da faixa e é coerente`)
  confere que o mínimo e a testada estão na mesma série e que mínimo ≤ testada.
- De 2.1.296 a 2.1.301: aceita, sem aviso.
- De 2.1.302 a 2.1.x: aceita, como "mais nova que a testada". Uma linha vai para
  o `desk.log`, o Sobre mostra o aviso e nada é bloqueado.
- Abaixo de 2.1.296, inclusive a série 2.0.x: recusa e oferece **Atualizar
  Claude Code**.
- Série nova (2.2.0, 3.0.0): recusa e oferece **Abrir o Sobre**, para procurar
  uma Mesa nova. Atualizar o Claude Code não traria a série de volta.
- Versão ilegível: recusa e oferece **Atualizar Claude Code**.

Uma versão fora da faixa nunca passa do `--version`. O `auth status` só roda
numa versão aceita, como antes.

### Por que o mínimo é 2.1.296

O mínimo é a versão mais antiga do CLI cujo protocolo a Mesa revisou e cujos
harnesses de contrato rodaram. Olhei três fontes.

1. **O par anterior revisado.** A auditoria do #28
   (`docs/reviews/2026-10-12/issue-28-audit.md`) revisou o protocolo e os
   harnesses com SDK 0.3.296 e CLI 2.1.296, a paridade publicada pelo SDK. Até o
   #46, todos os harnesses (`test:claude-ui`, `claude-adapter.test.mjs` e os
   testes de tipos contra o `sdk.d.ts`) rodaram com esse par. Abaixo de 2.1.296
   nada foi revisado: o pin anterior era 2.1.246, e a auditoria registra
   correções de permissões, replay e MCP depois dele.
2. **O changelog do SDK, de 0.3.297 a 0.3.301**, cada um com "parity with
   Claude Code v2.1.29x/30x". Nenhuma entrada exige uma versão mínima do CLI.
   - 0.3.297 e 0.3.298 só acompanham a paridade.
   - 0.3.299 traz `property_order` no `elicitation` (a Mesa não usa
     elicitation) e recusa os nomes reservados de servidor MCP (`__proto__` e
     afins); o servidor da Mesa se chama `mesa`.
   - 0.3.300 passa a validar o `updatedInput` dos hooks e descarta chaves
     desconhecidas. No CLI 2.1.296–2.1.299 não há validação, e o `callRef` do
     `activity-call-gate` passa do mesmo jeito (já era chave declarada).
   - 0.3.301 traz `permission_policy` por ferramenta em servidores MCP do SDK
     (a Mesa não manda), `addPlugins` (não usado), uma correção do `setModel()`
     no limite de uso e a troca do código de erro de disco cheio.
3. **O `sdk.d.ts`.** O 0.3.296 foi o que acrescentou `claude_code_version` à
   resposta do `initialize`. O `sdk.d.ts` 0.3.301 descreve os campos novos como
   "absent on CLIs that predate the field" (`claude_code_version`,
   `sdk_mcp_manifests_parked`): o SDK foi escrito para conversar com CLIs mais
   antigos e trata a falta desses campos. A Mesa lê `claude_code_version` do
   `system/init`, que existe em toda a faixa.

**O que isso não prova.** Nenhum turno autenticado rodou com um CLI real de
2.1.296 a 2.1.300. Do Claude real só rodou `--version`. O mínimo se apoia na
revisão de protocolo e nos harnesses com SDK sintético, não em inferência real.

**Ponto de atenção:** o changelog do Claude Code 2.1.299 corrige "a regression
in 2.1.296 where cloud and headless sessions could run an approved tool call
twice if a new message arrived as the session resumed after a restart". O caso
é o `CLAUDE_CODE_RESUME_INTERRUPTED_TURN`, que a Mesa não liga. Fica registrado.
Na 2.1.296, o botão Atualizar Claude Code do Sobre resolve.

**A série como teto.** Numa série nova o protocolo do SDK pode mudar de verdade,
e os campos do SDK que a Mesa usa (`supportedModels`, `applyFlagSettings`,
replay, hooks) são revisados por série. Subir a série é decisão de release
(`docs/agents/release.md`).

## A decisão mora num núcleo Bend

`core/claudeversion.bend` é um módulo só da Mesa, com leis em
`core/laws/claudeversion.bend` (30 leis) e provas em
`core/proofs/claudeversion.bend`:

- `fitOf(encontrada, mínimo, testada)` devolve `FitTested`, `FitAhead`,
  `FitBelow`, `FitSeries` ou `FitUnreadable`. `accepted`/`ahead` saem disso;
- `refusal` monta a frase da recusa (chave do catálogo + versão encontrada +
  faixa, como `msg.bend`);
- `fixFor` diz qual conserto a coluna oferece (`update`, `about` ou nenhum);
- `verText`/`seriesText` escrevem "2.1.296" e "2.1.x".

O módulo reaproveita o `Ver` e o `verNewer` de `updatenotice.bend`. Conferi
que as provas pegam erro: trocar `"about"` por `"update"` numa lei faz o
`bend proofs/claudeversion.bend` falhar, e com a lei restaurada ele volta a fechar.

## A mensagem da coluna

Fora da faixa, a coluna do tutor diz uma frase, com a versão encontrada e a
faixa aceita. As frases moram nos catálogos do #41: `claude.version.below`,
`.series` e `.unreadable`, em `pt-BR` e em `en`. Os botões são
`tutor.claude.update` / `.about`. Exemplos em pt-BR:

> Atualize o Claude Code: a versão 2.1.250 é anterior à faixa que a Mesa aceita (2.1.296 a 2.1.x).

> O Claude Code 2.2.0 é de uma série que a Mesa ainda não aceita (2.1.296 a 2.1.x): procure uma versão nova da Mesa no Sobre.

Como chega lá:

- `detectClaude` lança `CLAUDE_VERSION_UNSUPPORTED`. A `message` é a frase em
  português (log, doctor) e `detail.notice` é a mensagem do catálogo;
- o `pi-connect` (`tutorFacingError` em `main.cjs`) entrega `detail.notice` à
  janela e grava a frase em português no `desk.log`;
- `desk/src/tutor-reason.mjs` (novo, sem DOM) reconhece a mensagem do catálogo
  e pede o conserto ao núcleo. O núcleo `tutorstate` ganhou `stateViewFix`, e o
  `stateView` de sempre é o mesmo com conserto vazio, fato provado por lei.
  O view-host traduz no idioma da interface;
- **Atualizar Claude Code** abre o Sobre já na confirmação do #45
  (`openAbout({ask:'claude'})` → `askUpdate('claude')`), com "Vai rodar: claude
  update". Nada roda sem o clique;
- de quebra: a coluna mostrava o nome da classe do erro ("ClaudeAdapterError:
  …"). O `reasonText` agora tira qualquer `XxxError:` do começo, com teste de
  regressão.

Nada de "pareamento" nem de "ponte": os testes conferem a frase nos dois
idiomas contra `pareamento|ponte|bridge|SDK|Pi|conversa|chat`.

## O que saiu do #32

- Em `claude-environment.cjs` saíram `CLAUDE_PINNED_VERSION`, `SDK_PACKAGE`,
  `SDK_ARCHS`, `detectMusl`, `sdkBinaryCandidates`, `findSdkBinary`,
  `defaultResolveSdkPackage`, `describeSelection` (a mensagem "usando o binário
  do SDK"), a escolha `source: 'sdk'`/`'user'` e os campos `userVersion`,
  `sdkPath`, `sdkVersion` e `expected`. A opção `sdkBinaryPath` também saiu.
  No lugar entraram `CLAUDE_RANGE`, `versionRecord`, `claudeFit` e
  `describeVersion` (a linha de "mais nova que a testada").
- Em `claude-adapter.cjs` saiu `executableSource`. `executableNote` continua,
  agora com a linha de "mais nova".
- Em `main.cjs` saíram `testSdkBinary` e `claudeSdkBinary`, o
  `detectedClaude: …||claudeSdkBinary()` e o `sdkBinary` dos fixtures.
- `tool-facts.cjs`: saiu `reserveVersion`. `components.cjs`: saíram a coluna
  `reserve`, "Reserva da Mesa: …" e "a Mesa usa a reserva embutida". A dica da
  linha do Claude Code passa a dizer a faixa quando a versão fica fora.
  `tool-updates.cjs` e `update-host.cjs`: saiu `sdkBinary`. O "o tutor religou
  com a versão nova" agora vale para qualquer versão dentro da faixa.
- Testes:
  - `tests/claude-sdk-binary-ui.mjs` foi removido e substituído por
    `tests/claude-version-range-ui.mjs`. São quatro cenários na janela: 2.1.296
    (principal e lateral retomam os IDs nativos exatos pelo binário do usuário),
    2.1.400 (conecta e o log avisa), 2.1.250 (recusa, e o botão abre a
    confirmação do #45) e 2.2.0 (recusa e abre o Sobre). Entra no
    `test:claude-ui`.
  - Em `claude-environment.test.mjs`, os 13 testes do #32 e o do #28 viraram 8
    testes do #51: a faixa inteira (aceitas, recusadas e chamadas a `auth`), o
    2.1.296 do defeito, a versão ilegível, a coerência da tabela,
    `claudeFit`/`versionRecord`, a linha de log, conflito e login numa versão
    mais nova, e "sem reserva". O último confere que as funções saíram e que o
    `CLAUDE_NOT_FOUND` não fala em SDK.
  - Também foram reescritos para o comportamento novo: o teste do adaptador
    (`#51: detector injetado…`), `tool-facts`, `tool-updates` ("religa" dentro
    da faixa, série nova sem promessa, avisos só com `--version`) e
    `components`.
- `tests/electron-env.mjs`: a guarda "sem binário do SDK" virou a guarda "sem o
  Claude Code real". `LEARNING_DESK_CLAUDE_HOME` (só com `DESK_TEST`) aponta para
  um **Claude de guarda** que só responde `--version` com 0.0.0, fora da faixa.
  O motivo apareceu nos testes: vários testes de janela sem `claudePath`
  dependiam, sem dizer, de existir um Claude real em `~/.local/bin`, porque a
  Mesa só liga sozinha quando acha um launcher. Antes isso era seguro porque o
  real (2.1.296) era recusado no `--version`. Dentro da faixa, ele chegaria ao
  `auth status`. Com a guarda, a Mesa ainda acha um launcher e qualquer
  detecção para no `--version`. `claude-ui-smoke` (cenário "sem binário") e
  `claude-offline-queue-ui` passam `LEARNING_DESK_CLAUDE_HOME: ''` para usar a
  casa vazia deles.

**O `package.json` não muda.** O SDK declara os oito
`@anthropic-ai/claude-agent-sdk-<plataforma>` como `optionalDependencies`, e o
`npm ci` baixa o da plataforma (~250 MB no macOS arm64) sem uso. O npm não tem
como excluir um opcional transitivo específico. Os caminhos possíveis seriam um
`override` apontando para um pacote vazio de terceiros, que é risco de cadeia
de suprimentos, ou `--omit=optional`, que também tiraria os
`@napi-rs/canvas-*` opcionais do PDF.js. O SDK não exige o pacote: a Mesa
sempre passa `pathToClaudeCodeExecutable`. Fica como está. O bundle segue sem o
binário: `bundle-runtime.cjs` não mudou nisso, e o teste do app empacotado
confere.

**O Claude Code continua fora do PATH.** A Mesa procura o caminho configurado e
o `~/.local/bin/claude` do instalador oficial. O app aberto pelo Finder recebe
um PATH mínimo, então procurar no PATH não ajudaria o atalho. No teste do app
empacotado o falso fica em `~/.local/bin` de uma casa temporária, e essa pasta
também vai no PATH.

## O teste do app empacotado

`tests/packaged-app-ui.mjs` roda com `npm run test:packaged`, só no macOS.
Fica fora do `npm run ui`, como os outros testes do app instalado.

1. Clona o `node_modules/electron/dist/Electron.app` (`cp -c`, que no APFS não
   copia bytes) para `Mesa de Estudos.app` numa pasta temporária.
2. Monta o bundle com **a mesma rotina do `install-app`**. A rotina saiu do
   script para `installBundle` em `desk/bundle-runtime.cjs`: versão no
   Info.plist, payload, procedência, manifesto com órfãos e auxiliares. O
   `install-app.mjs` chama a mesma função e só depois assina e cria o atalho.
   O teste não assina, não cria atalho, não registra no LaunchServices e não
   toca no `~/Applications` nem no `Mesa de Estudos.app` do repositório. Um
   teste de unidade novo cobre o `installBundle` (`bundle-runtime.test.mjs`).
3. Confere que o bundle tem o SDK e **nenhum** `claude-agent-sdk-<plataforma>`.
4. Sobe pelo executável do bundle (`Contents/MacOS/Electron`) com `HOME` numa
   casa temporária e o Claude Code falso em `~/.local/bin/claude`. A detecção é
   a de produção. A Query é o SDK sintético, copiado para dentro do payload
   temporário, onde o main exige os fixtures.
5. Três versões:
   - **2.1.296**, o do defeito, conecta e roda a Query pelo Claude do usuário;
   - **2.1.400** conecta com aviso no `desk.log` e "mais nova que a testada"
     na linha do Sobre;
   - **2.2.0** recusa com a frase e o botão Abrir o Sobre, sem `auth` e sem
     Query.

**O teste pega o defeito.** Com `claudeMinimum` igual à testada, que é o par
exato antigo, o cenário 2.1.296 falha (`statusOnline` estoura o prazo). Uma
primeira versão do teste lia a versão do cenário da própria tabela e passava
mesmo assim. Corrigi para o literal `'2.1.296'`, aqui e no
`claude-version-range-ui`.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok: 63 artefatos reproduzíveis, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 1382 testes, 0 falhas (+5 do portão do núcleo) |
| `npm run test:claude-ui` | 9 de 9 ok (inclui o novo `claude-version-range-ui`) |
| `npm run ui -- about,claude,tutor` | 6 de 6 ok |
| `npm run test:packaged` | ok, 3 cenários (~11 s) |

Antes de cada rodada com Electron conferi que não havia Electron de outra
worktree. Não rodei `npm run ui` completo nem `hunts`: a bateria completa roda
depois, no `main`. Isso pesa mais aqui, porque a guarda do Claude no
`electron-env` vale para **todos** os testes de janela. Dos testes de janela que
eu editei, o `tool-updates-ui.mjs` ficou fora do filtro pedido. A mudança nele
foi tirar uma variável de ambiente que deixou de existir.

Sem inferência: do Claude real só rodou `--version`, e só pelo Sobre de testes
antigos que já o liam. O Claude Code do usuário não foi atualizado. Não rodei
`setup`, `update` nem `install-app` de verdade.

## Áreas tocadas

- **Núcleo:** `core/claudeversion.bend` (novo) + leis e provas; `tutorstate.bend`
  (`stateViewFix`, `claudeFixView`) + 11 leis; `PROOF.bend`, `build.mjs`,
  `README.md`. Gerados: `claudeversion.core.js` (novo), `tutorstate.core.js` e
  `firstrun.core.js`, que importa o `tutorstate`.
- **Host:** `src/agents/claude-environment.cjs`, `src/agents/claude-adapter.cjs`,
  `main.cjs`, `components.cjs`, `tool-facts.cjs`, `tool-updates.cjs`,
  `update-host.cjs`, `bundle-runtime.cjs` (`installBundle`) e
  `scripts/install-app.mjs`.
- **Renderer:** `src/tutor-reason.mjs` (novo), `src/tutor-state.mjs`,
  `src/main.mjs` (`openAbout({ask})`) e `src/tool-notices.mjs` (`askUpdate`).
- **Dados:** `src/tested-versions.json` (`claudeMinimum`) e
  `locales/pt-BR.json` e `en.json` (7 chaves).
- **Testes:**
  - novos: `claude-version-range-ui.mjs`, `packaged-app-ui.mjs` e
    `tutor-reason.test.mjs`;
  - reescritos: `claude-environment.test.mjs`, `claude-adapter.test.mjs`,
    `components.test.mjs`, `tool-facts.test.mjs`, `tool-updates.test.mjs`,
    `bundle-runtime.test.mjs`, `claude-ui-smoke.mjs`,
    `claude-offline-queue-ui.mjs`, `tool-updates-ui.mjs`, `electron-env.mjs`,
    `run-claude-ui.mjs` e `suite-files.mjs`;
  - removido: `claude-sdk-binary-ui.mjs`.
- **Docs:** `docs/agents/release.md` (o release confere a faixa testada),
  `docs/agents/mapa.md` (linha nova e linhas do tutor e dos avisos),
  `docs/agents/portoes.md` (a guarda e o `test:packaged`) e
  `docs/CLAUDE-TRANSPORT-EXPERIMENTAL.md` (seção "Escolha do executável (#51)").

## Fica para depois

- **Chat lateral:** fora da faixa, ele mostra a frase em português (a
  `message` do erro), sem o botão. A frase com conserto e tradução é só da
  coluna principal.
- **Conta real:** falta um turno autenticado com um Claude Code entre 2.1.296 e
  2.1.300, conferido à mão, para fechar o "o que isso não prova" acima.
