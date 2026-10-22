# core — o núcleo provado dos apps

Módulos puros escritos em [Bend](https://bend-lang.com) que os apps consomem.
A regra: **lógica que nunca pode quebrar mora aqui, com leis; apresentação e
mundo (DOM, arquivos, IPC) ficam nos apps.**

## Estrutura

- `<módulo>.bend` — o núcleo puro (ex. `wheel.bend`, `worklog.bend`).
- `laws/<módulo>.bend` — o contrato em leis (escrito à mão; não muda sem querer).
- `proofs/<módulo>.bend` — as provas (`def Laws.<nome>`), uma por módulo.
- `LAWS.bend` — índice humano; `PROOF.bend` — o portão que importa todas as provas.
- `build.mjs` (bun) / `build-safe.mjs` (node) — geram os artefatos dos apps; o
  caminho anotado no artefato é canônico (`// core/<módulo>`) de qualquer cwd.
- `proof.mjs` — roda o portão; sem bend instalado, avisa e sai com 0.
- `verify.mjs` — portão **estrito** de dev/commit: exige bun+bend, confere a
  identidade fixada em `toolchain.json` (plugin + versões), regenera e falha se
  o rebuild mudar qualquer byte, e roda as provas com o mesmo binário
  (`npm run verify:bend`; `--pin` aceita uma toolchain nova depois de validar o
  diff dos artefatos).
- `.githooks/pre-push` — roda o portão estrito antes de todo push. Ative no
  clone com `git config core.hooksPath .githooks`; `git push --no-verify` é a
  saída de emergência. Sem CI, é o que impede `verify:bend` de ser só
  disciplina (custa ~10 s).
- `playground/` fica fora daqui (é a vitrine da linguagem, em `../playground/bend`).

## Toolchain fixada

`core/toolchain.json` guarda a identidade do compilador — versão, sha256 do
`bend2/main.ts` e a **procedência** (repo@commit) — além da versão do bun. O
`verify` recusa qualquer diferença; o erro imprime de onde a toolchain fixada
veio.

Atualizar o Bend **não é rotina**: o build depende do **plugin TypeScript**
(`bun` importa `bend2/main.ts` no `Bun.build`), e os releases **2.0.8+ não o
distribuem** — viraram um executável único, cujo `-o .js` emite um *programa*
com `main` (sem `export`), não a biblioteca ESM que os hosts consomem. Mas o
**fonte do compilador continua no repo upstream**: instalar de um checkout do
repo (`cp -R bend2 guide`, abaixo) preserva o plugin, e a integração não muda —
foi assim o update para a 2.0.27, com os artefatos regenerados e as provas
verdes sem tocar em nenhuma lei, e o para a 2.0.37 (#49), em que nenhuma lei
mudou mas o `Nat` passou de BigInt para `number` na fronteira dos artefatos
(casca em `desk/src/bend-nat.mjs`). Duas diferenças de CLI que o portão já sabe
ler: a versão fala pelo subcomando `bend version` (2.0.7 e anteriores: flag
`--version`) e o CLI tem um *daily version check* (o único request que ele faz)
que os portões daqui desligam com `BEND_NO_TELEMETRY=1`.

Trocar de toolchain fixada (exemplo: a 2.0.37, o commit pinado `d2aeefc1`):

```sh
git clone https://github.com/bendlang/bend && cd bend && git checkout d2aeefc1
mkdir -p ~/.bend/versions/d2aeefc1
cp -R bend2 guide ~/.bend/versions/d2aeefc1/
ln -sfn ~/.bend/versions/d2aeefc1 ~/.bend/current
# o CLI é o próprio main.ts rodando com bun:
printf '#!/bin/sh\nexec "${BUN_BIN:-$HOME/.bun/bin/bun}" "$HOME/.bend/current/bend2/main.ts" "$@"\n' > ~/.bend/bin/bend
chmod +x ~/.bend/bin/bend
```

Confira com `bend version` (tem de dizer `bend 2.0.37`) e `node core/verify.mjs`:
o rebuild tem de sair byte a byte. Para aceitar a nova fixação, escreva
`version`/`pluginSha256`/`source` à mão em `core/toolchain.json` (o `--pin`
também aceita, mas a procedência é sempre escrita, nunca inventada). O diretório
da toolchain anterior (`~/.bend/versions/63bee70b`, a 2.0.27) fica no disco para
rollback: `ln -sfn ~/.bend/versions/63bee70b ~/.bend/current` e
`git restore core/toolchain.json desk/src/generated`. Uma toolchain fora do
`~/.bend` também serve: `BEND_HOME`, `BEND_BIN` e o `PATH` apontam para ela (o
`env.sh` de `~/.bend-toolchains/<commit>/` faz isso).

## Fluxo

1. Edite o `.bend` do módulo e, se a regra mudou, a lei correspondente.
2. `npm test` no app (ou `npm run build:bend` + `npm run test:proof`) —
   regenera os artefatos, roda `bend PROOF.bend` e os testes do app.
3. O artefato (`desk/src/generated/*.core.js`) é
   importado pelo adaptador do app (`desk/src/worklog.mjs`,
   `desk/courses.cjs`, `desk/src/pdf.mjs`, `desk/rpc.cjs`,
   `desk/src/study-data/search.cjs`, …). Sem bun/bend na máquina, o passo 2 avisa e segue usando o artefato que já
   está no repositório.

## Escrever uma lei

Nome e comentário dizem **exatamente** o que o enunciado prova — e o que não
cabe nele é declarado em vez de insinuado: fronteira de host ("o host compara,
o núcleo recebe o fato"), limite medido em outro lugar, caso que não fecha no
checker. O exemplo maduro do estilo é o bloco "O que não saiu (e por quê)" em
`laws/toolpolicy.bend`.

Duas armadilhas da mesma família, ambas já corrigidas:

- Comentário que promete uma escala que o caso não instancia
  (`worklog_tool_longo` dizia "maior que os tetos antigos de pilha" com um
  prefixo de 200 chars).
- Nome que sugere a composição pública quando a lei olha só um filho
  (`pv_mark_filho_texto`).

A revisão humana leve olha os enunciados e as fronteiras, não o JS gerado.

## Módulos

Hoje o `PROOF.bend` importa 70 provas (70 arquivos de leis, 3.121 declarações
`law`) e o build gera 68 saídas, todas em `desk/src/generated` (a Conversa e os
14 módulos só dela saíram na #50; `claudeversion` entrou na #51; `overlay`, na #52;
`ggbboard` e `toolmentions`, na #53; `freemodels`, na #44; `phonedrop`, na #36).

- **`phonedrop.bend`** — a Foto do celular (#36): o fluxo do site local
  (desligado → esperando → recebeu N → parado/expirou/erro de rede), a porta
  (servidor parado, token errado e caminho desconhecido dão o mesmo 404; só a
  página e o envio abrem) e a foto (só JPEG/PNG/WebP, teto por arquivo e por
  sessão). O host compara o token, reconhece a imagem, tira o EXIF e conta os
  bytes; os textos são do catálogo.

- **`updatenotice.bend`** — avisos de atualização do Pi e do Claude Code: a
  decisão (linha do Sobre, ponto do ⚙, "mais nova que a testada", sem rede não
  é erro), a memória de "visto", "ignorar esta versão" e "lembrar depois", as
  frases do resultado e os nós de ação, confirmação e saída. O host só lê as
  versões e roda o comando. Desde a #52 a linha mora também nas Configurações
  (`Surface`, `seesLine`, `noticeLinesFor`, "Ver no Sobre").

- **`overlay.bend`** — o contrato da view nativa do GeoGebra diante das
  sobreposições de página inteira (#52): aba inativa fica fora, ativa sem
  sobreposição aparece, com qualquer uma se esconde sem fechar (volta no mesmo
  lugar e com a mesma construção). O host só conta as sobreposições.

- **`claudeversion.bend`** — a faixa de versões do Claude Code que a Mesa
  aceita (#51): do mínimo até a série da testada (`tested-versions.json`),
  mais nova na série só avisa, série nova/abaixo do mínimo/ilegível recusa; a
  frase da recusa (chave do catálogo) e o conserto que a coluna do tutor
  oferece. O host só lê `--version`.

- **`conferir.bend`** — qual janela o Conferir captura (Xournal++ ou o
  programa escolhido; várias janelas → a da frente; app ausente → nunca outra
  janela) e a árvore do seletor de janela. O host só lista e captura.
- **`wheel.bend`** — decisão da roda do trackpad (vira página ou acumula).
- **`worklog.bend`** — máquina de estados do diário do turno: rajadas de
  pensamento, status dos passos, fechos. O adaptador `desk/src/worklog.mjs`
  mantém a API mutável antiga.
- **`library.bend`** — escolha dos PDFs de cada painel (preferido, sobra,
  nunca repetido). O adaptador `desk/config.cjs` calcula os fatos no JS e
  deixa a escolha para o núcleo.
- **`find.bend`** — contador e ciclo da busca do PDF. O adaptador vive no
  renderer (`desk/src/pdf.mjs`): o host monta as páginas com ocorrências e o
  núcleo decide o alvo do ciclo e o que o contador mostra.
- **`search.bend`** — busca de texto: dobra Latin-1 sem marcas, casamento,
  trecho com `…`, limite, papel da linha, decisão por arquivo (tetos/timeout) e
  agrupamento. Nasceu para o app Conversa (aposentado na #50); ficou porque
  `pdfref.bend` e `studysearch.bend` o importam, e os adaptadores da Mesa são
  `desk/src/study-data/search.cjs` e `desk/src/study-search.mjs`.
- **`courses.bend`** — matérias da Mesa: merge entre pastas descobertas e o
  config (rótulo/path do config vencem, ordem preservada) e biblioteca
  (dedupe por caminho canônico; a ordem final fica com o `localeCompare` do
  host). Adaptador `desk/courses.cjs`.
- **`study.bend`** — restauração do rascunho `.xopp` (título aparado em 240,
  sufixo e existência). Adaptador `desk/study.cjs`.
- **`pending.bend`** — a fila do composer no disco (Mesa): tetos (50 itens, 2
  referências por item, 40 MiB no arquivo), o que fica no item e a decisão de a
  fila lida de outra execução nascer segurada. Adaptador `desk/pending.cjs`
  (um arquivo por conversa, com a bandeja de anexos, poda e teto de disco).
- **`resume.bend`** — o registro local do "Encerrar por hoje" e o cartão de
  retomada: forma do registro (onde parei, próximo passo, questão, `.xopp` e
  páginas), trim + corte em 240, no máximo 2 PDFs e os textos do cartão.
  Adaptadores `desk/resume.cjs` (um registro por matéria) e `desk/src/resume.mjs`
  (o cartão acima do campo).
- **`framing.bend`** — framing das linhas JSON-RPC do stdout do Pi (split por
  LF, resto no buffer, overflow descarta tudo). Adaptador `desk/rpc.cjs`.
- **`statusview.bend` / `composerview.bend` / `talkview.bend`** —
  ficaram só com a Mesa depois da #50. `footStatus` perdeu o consumidor
  (o rodapé era da Conversa) e segue no núcleo até alguém limpá-lo; `settingsPanel` e os construtores
  legados de vazio, digitação, citação e chips de `talkview` foram removidos
  depois de conferir consumidores, testes, build, leis e provas. A Mesa usa
  `firstrun`/`tutorstate` nesses fluxos.
  Também saíram as projeções sem consumidor `sentReason`, `stoppedOf`,
  `actOf` e o predicado `view.isEl`. O registro da busca e das decisões está em
  [`../docs/reviews/issue-31-shared-core-cleanup.md`](../docs/reviews/issue-31-shared-core-cleanup.md).
- **`msg.bend`** — mensagem traduzível (#41): no lugar da frase pronta, o
  núcleo devolve a chave do catálogo (`desk/src/locales/*.json`) e os argumentos
  num `String` (`msg`, `msg1`…`msg4`, `isMsg`); quem traduz é o host, no idioma
  do momento.
- **`language.bend`** — decisões do idioma (#41): o que vale como escolha da
  interface e do tutor, o padrão pelo idioma do sistema (`pt*` → `pt-BR`) e o
  "acompanhar minhas mensagens". O estado e o `t()` moram em
  `desk/language-host.cjs`.
- **`fold.bend`** — dobra de acentos pt-BR + caixa, no espírito do
  `normalize("NFD").toLowerCase()` do host. **Ainda não é buildada** (o
  `nameMatches` do app continua em JS); fica pronta para quando o app quiser
  trocar o casamento de nomes. É grande quando compilada (~665 KB de tabela),
  por isso vive fora do artefato de `library.bend`. `search.bend` tem a dobra
  da busca de texto (Latin-1 + marcas combinantes).

## Por que "fatos como Bool"

Prova em Bend não faz análise de caso sobre valor computado: se o núcleo
compara Nats/F32 livres por dentro, a lei não reduz. Por isso o núcleo recebe
as decisões já resolvidas (`blocked`, `over`, `under`, …) e devolve a tabela —
o host faz as comparações. É onde os bugs moram e onde as leis pegam.

Os **tetos** seguem o caminho inverso: o número mora no núcleo
(`maxDraftChars()`), é pinado por lei e o host lê de lá — `MAX_DRAFT` em
`state-adapter.cjs`, usado no corte/save do rascunho e no `pi-prompt` do main —
em vez de repetir o literal. Onde o host não alcança o artefato (um preload com
`sandbox: true`) o literal é inevitável e precisa de um teste de paridade. Os
tetos de `attachments.bend` (4 anexos, 120/80000/16 MiB) são lidos do artefato
pelo main e pelo renderer da Mesa; o literal e o teste de paridade que
existiam por causa do preload da Conversa (`chat/tests/limits-parity.test.mjs`)
saíram com ela e estão na tag `conversa-final`.

## Pegadinhas do Bend (aprendidas aqui)

- Sem referência para frente (helper antes de quem chama) e sem recursão mútua.
- `match` inspeciona parâmetro ou variável de pattern, nunca valor computado.
- Construtor precisa de nome globalmente único na Base: `Done`/`Running` colidem
  (`Result.Done`), então o worklog usa `Status.Done{}`/`Status.Running{}`. O
  bend 2.0.6+ emite a tag SEM o prefixo do módulo (`"Status.Running"`; até o
  2.0.5 era `"worklog.Status.Running"`) — quem fabrica tags no host precisa
  acompanhar (`src/worklog-tags.mjs`).
- Recursão não-tail no lane JS custa quadro de host (bendlang/bend#798, `SOON`
  no WONTFIX.txt do Bend): `String.split`/`repeat`/`take`/`to_upper`/`to_list`
  estouram a pilha em ~10k chars. O `String.length` virou intrínseco no 2.0.7
  (verificado até 11 MB), mas os módulos daqui mantêm acumulador/tail como
  defesa e paridade (ver `framing.bend`, `toolpolicy.bend`, `sessions.bend`).
- `Kind` é palavra reservada → o tipo do worklog é `StepKind`.
- Campo de registro vira pattern posicional: `Log{startedAt, endedAt, _, text, steps}`.
- Afim por padrão: usar duas vezes exige `+x`; `List<T>` puro é `List<&1, T>`
  (Type) — para guardar em registro `Data`, use `+List<T>` e passe a quantidade
  explícita (`List.length(&2, Step, xs)`).
