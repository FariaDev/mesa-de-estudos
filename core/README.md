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
verdes sem tocar em nenhuma lei. Duas diferenças de CLI que o portão já sabe
ler: a versão fala pelo subcomando `bend version` (2.0.7 e anteriores: flag
`--version`) e o CLI tem um *daily version check* (o único request que ele faz)
que os portões daqui desligam com `BEND_NO_TELEMETRY=1`.

Trocar de toolchain fixada (exemplo: a 2.0.27, o commit pinado):

```sh
git clone https://github.com/bendlang/bend && cd bend && git checkout 63bee70b
mkdir -p ~/.bend/versions/63bee70b
cp -R bend2 guide ~/.bend/versions/63bee70b/
ln -sfn ~/.bend/versions/63bee70b ~/.bend/current
# o CLI é o próprio main.ts rodando com bun:
printf '#!/bin/sh\nexec "${BUN_BIN:-$HOME/.bun/bin/bun}" "$HOME/.bend/current/bend2/main.ts" "$@"\n' > ~/.bend/bin/bend
chmod +x ~/.bend/bin/bend
```

Confira com `bend version` (tem de dizer `bend 2.0.27`) e `node core/verify.mjs`:
o rebuild tem de sair byte a byte. Para aceitar a nova fixação, escreva
`version`/`pluginSha256`/`source` à mão em `core/toolchain.json` (o `--pin`
também aceita, mas a procedência é sempre escrita, nunca inventada). O diretório
da toolchain anterior (`~/.bend/versions/fb36663571`, a 2.0.7) fica no disco para
rollback: `ln -sfn ~/.bend/versions/fb36663571 ~/.bend/current` e
`git restore core/toolchain.json desk/src/generated chat/src/generated`.

## Fluxo

1. Edite o `.bend` do módulo e, se a regra mudou, a lei correspondente.
2. `npm test` no app (ou `npm run build:bend` + `npm run test:proof`) —
   regenera os artefatos, roda `bend PROOF.bend` e os testes do app.
3. O artefato (`desk/src/generated/*.core.js`, `chat/src/generated/*.core.js`) é
   importado pelo adaptador do app (`desk/src/worklog.mjs`, `chat/src/worklog.mjs`,
   `desk/courses.cjs`, `desk/src/pdf.mjs`, `desk/rpc.cjs`, `chat/search-text.cjs`,
   …). Sem bun/bend na máquina, o passo 2 avisa e segue usando o artefato que já
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

Hoje o portão importa 50 módulos (50 arquivos de leis, 1.959 declarações
`law`) e o build gera 64 saídas (Mesa + Conversa).

- **`wheel.bend`** — decisão da roda do trackpad (vira página ou acumula).
- **`worklog.bend`** — máquina de estados do diário do turno: rajadas de
  pensamento, status dos passos, fechos. O adaptador `desk/src/worklog.mjs`
  (espelhado em `chat/src/worklog.mjs`) mantém a API mutável antiga.
- **`library.bend`** — escolha dos PDFs de cada painel (preferido, sobra,
  nunca repetido). O adaptador `desk/config.cjs` calcula os fatos no JS e
  deixa a escolha para o núcleo.
- **`find.bend`** — contador e ciclo da busca do PDF. O adaptador vive no
  renderer (`desk/src/pdf.mjs`): o host monta as páginas com ocorrências e o
  núcleo decide o alvo do ciclo e o que o contador mostra.
- **`search.bend`** — busca no conteúdo das conversas (app Conversa): dobra
  Latin-1 sem marcas, casamento, trecho com `…`, limite, papel da linha,
  decisão por arquivo (tetos/timeout) e agrupamento. O adaptador
  `chat/search-text.cjs` roda no main e usa `require` do artefato ESM.
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
  LF, resto no buffer, overflow descarta tudo). Adaptadores `desk/rpc.cjs` e
  `chat/rpc.cjs`.
- **`fold.bend`** — dobra de acentos pt-BR + caixa, no espírito do
  `normalize("NFD").toLowerCase()` do host. **Ainda não é buildada** (o
  `nameMatches` do app continua em JS); fica pronta para quando o app quiser
  trocar o casamento de nomes. É grande quando compilada (~665 KB de tabela),
  por isso vive fora do artefato de `library.bend`. A Conversa tem a dobra
  dela em `search.bend` (Latin-1 + marcas combinantes).

## Por que "fatos como Bool"

Prova em Bend não faz análise de caso sobre valor computado: se o núcleo
compara Nats/F32 livres por dentro, a lei não reduz. Por isso o núcleo recebe
as decisões já resolvidas (`blocked`, `over`, `under`, …) e devolve a tabela —
o host faz as comparações. É onde os bugs moram e onde as leis pegam.

Os **tetos** seguem o caminho inverso: o número mora no núcleo
(`maxDraftChars()`), é pinado por lei e o host lê de lá — `MAX_DRAFT` em
`state-adapter.cjs`, usado no corte/save do rascunho e no `pi-prompt` do main —
em vez de repetir o literal. Onde o host não alcança o artefato (o preload da
Conversa roda com `sandbox: true`) o literal é inevitável, e aí ele é pinado
por `chat/tests/limits-parity.test.mjs`. Os tetos de `attachments.bend` (4
anexos, 120/80000/16 MiB) ainda estão em literais de `chat/main.cjs` e do
preload.

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
