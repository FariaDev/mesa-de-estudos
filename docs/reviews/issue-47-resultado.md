# Issue #47 — Toolchain do Bend (resultado)

Branch `claude/musing-knuth-56b947`, cortada de `c1c98d2`. Sem push, sem PR, sem
subagentes, sem inferência real. Não rodei `npm run setup`, `update` nem
`install-app`; o bundle `Mesa de Estudos.app` e os defaults de `desk/config.cjs`
ficaram intocados.

## Decisão: a toolchain fixada continua `bendlang/bend@63bee70b` (bend 2.0.27)

O verificador novo **aceitou todo o núcleo**: nenhuma lei ou prova caiu. O que
impede a troca é o **compilador JS**. A partir do 2.0.28, cada release muda o
contrato entre os artefatos gerados e o código dos apps, e a Conversa (`chat/`)
quebra sem mexer em `chat/src` e `chat/tests`. A issue proíbe essas mudanças.
Medi três alvos (tabela abaixo) e o usuário escolheu ficar no 2.0.27 nesta rodada.
A migração vira trabalho separado.

Por isso `core/toolchain.json`, os artefatos de `desk/src/generated/` e
`chat/src/generated/` e a documentação de versão **não mudaram**. O único commit
traz este relatório e a saída do verificador.

## Toolchains instaladas (ao lado, nada substituído)

`~/.bend/bin/bend` (2.0.27) e `~/.bun/bin/bun` (1.4.2) continuam intactos. As
versões novas ficam em pastas próprias, cada uma com `bin/bend` (o `bend2/main.ts`
rodando com o mesmo Bun 1.4.2) e um `env.sh` que exporta `BEND_HOME`, `BEND_BIN` e `PATH`:

| Pasta | Origem | `bend version` |
|---|---|---|
| `~/.bend-toolchains/d2aeefc1` | `HEAD` de 2026-10-15 | bend 2.0.37 |
| `~/.bend-toolchains/v2.0.36` | tag `v2.0.36` (`ae1101ca`) | bend 2.0.36 |
| `~/.bend-toolchains/v2.0.28` | tag `v2.0.28` (`bc178404`) | bend 2.0.28 |

Uso: `source ~/.bend-toolchains/d2aeefc1/env.sh && node core/verify.mjs`. Para
voltar, basta abrir outro shell. A CI do Bend pede Bun 1.4.0
(`.github/workflows/repo-gate.yml`); o 1.4.2 daqui compilou e provou nas três
versões, então não instalei outro Bun. Dá para apagar as três pastas sem efeito na
Mesa.

## O que o log `63bee70b..d2aeefc1` muda para a Mesa

São 253 commits (2.0.28 a 2.0.37, mais 35 depois da tag 2.0.37). Agrupei pelo que
toca a Mesa.

**Verificador**
- 2.0.28, #1033: o veredito parte de **cada lei, em qualquer arquivo que a
  preencha**. Um `@unsafe` num arquivo importado deixa de passar calado. Essa é a
  correção de solidez citada na issue (ver o teste negativo abaixo).
- 2.0.32: a saída passa a ser `ALL PROOFS CHECK` / `SOME PROOFS FAIL` (antes
  `All terms check.`). Uma prova só vale se não usa `@unsafe` nem código
  estrangeiro, imports incluídos. `--safe` virou `--verdict`. Os códigos de saída
  não mudaram, e `core/proof.mjs` olha só o código, então o portão segue valendo.
- 2.0.30 em diante: `--verdict` rechecha tudo com o kernel BendTT, provado em Lean
  v4.34.0. Os commits seguintes até `HEAD` (#1225, #1200, #1531, #1558, #1536,
  #1556) refinam esse kernel. **Não rodei `--verdict`**: a máquina não tem Lean/elan,
  e instalá-lo sai do escopo.
- 2.0.29 e 2.0.33: checagens que antes eram exponenciais agora são lineares
  (descida em literal `Nat`, conversão por compartilhamento). Afetam só o tempo.

**Nomes e namespaces** (2.0.28, #1042, que fecha #989/#994/#1002/#1005)
- Um nome é formado por palavras ligadas por ponto, e o namespace é o caminho real
  do arquivo. Nome declarado duas vezes, Base redeclarada, alias em conflito e
  efeito registrado duas vezes são recusados. **Nada no `core/` foi recusado**:
  build e provas passaram nas três versões.
- 2.0.28 a 2.0.36 prefixam a tag JS dos construtores de módulos importados
  (`"ViewEl"` vira `"view.ViewEl"`). O `HEAD` desfaz isso (#1488, "stabilize JS
  constructor tags across modules"): comparando os artefatos, os conjuntos de tags
  de `HEAD` são os mesmos de hoje.

**Compilador JS**: aqui está a quebra.
- 2.0.29: o `Nat` passa a ser `number` dentro do artefato (lane JS cerca de 2,3x
  mais rápida). Vira `BigInt` só na fronteira, e a conversão da entrada é ansiosa.
- 2.0.37, #1506 (`381dc877`): **o `Nat` cruza a fronteira como `number`**. Cada
  export embrulha os argumentos em `nat_in`, que recusa um `BigInt`
  (`Number.isInteger(5n)` é falso) e lança `bend: a Nat past the largest immediate
  2^48-1`. Os resultados `Nat` voltam como `number`. Não há flag para manter o
  formato antigo.
- `HEAD`, `2bb4ba55`: argumentos `F32` passam por `Math.fround` na entrada
  (`wheel`, `state` nos dois apps).
- `HEAD`, `7ba0ce7a` (#1411): um `Char` guarda qualquer u32, e só nas bordas de
  texto (`str_in`/`str_out`) um surrogate solto vira U+FFFD.
- Formato: as chamadas viram diretas (sem `run_jump`), as continuações viram
  funções globais (#1383), os nomes internos mudam de `$f$g$` para `$f_g`, as
  chaves `["x"]` viram `x` e os helpers somem (`WCon`/`WNil`). As chaves
  exportadas (`"pageTurn.under"` etc.) não mudam.

**Bibliotecas do `guide/`**: o `core/` importa só `Base`, e `guide/` traz só
documentação (`GUIDE.md`, `EFFECTS.md`, `SHADERS.md`). As mudanças em `Base`
(`String.order`, `List` com parada antecipada, `F32.round`, `U32.log2`) passaram
pelas provas. A mudança em efeitos JS (`io_eff(CID(Name), …)`, 2.0.28) não afeta
nada: o `core/` não tem efeitos nem código estrangeiro.

## Saída do verificador novo antes de refixar

Saída inteira em [`issue-47-verify-d2aeefc1.txt`](issue-47-verify-d2aeefc1.txt)
(o caminho local aparece como `<repo>`). Resumo:

```
plugin bend: 0984154bb5f8 → 3abb47af6fc7
bend: bend 2.0.27 → bend 2.0.37
verify: toolchain diferente da fixada — …                       (exit 1, esperado antes do --pin)
=== bun core/build.mjs           → 88 artefatos gerados, exit 0
=== node core/proof.mjs          → ALL PROOFS CHECK, exit 0
```

Como o `verify.mjs` para na checagem da fixação, rodei em seguida os dois passos
que ele faria (build e provas) com a mesma toolchain. O v2.0.36 deu
`ALL PROOFS CHECK`; o v2.0.28, `All terms check.`; os dois com exit 0.

## O que o verificador novo recusou, e o destino de cada item

| Item | Recusado? | Destino |
|---|---|---|
| Leis e provas de `core/laws/` e `core/proofs/` (todas, via `PROOF.bend`) | **Não**, `ALL PROOFS CHECK` | Nada a corrigir. Nenhuma prova da Mesa dependia de `@unsafe` ou código estrangeiro (`rg '@unsafe\|def x?('` e `import "` no `core/`: zero). |
| Nomes, namespaces e aliases do `core/` (regras do #1042) | **Não** | Nada a corrigir. |
| Módulos do build (`core/build.mjs`, 88 saídas) | **Não**, compilaram | Os artefatos mudam de contrato (ver acima). Não foram commitados. |

Ou seja: **o verificador novo não recusou nada**. A promessa "a lógica que nunca
pode quebrar mora no núcleo" se manteve com o verificador mais estrito.

### Testes negativos: o portão ainda reprova?

Rodei numa cópia de `core/` no scratchpad, nunca no repositório, mexendo só em
`wheel`:

| Caso | 2.0.27 (fixado) | 2.0.37 (`HEAD`) |
|---|---|---|
| Lei falsa (`Spin{1.0,…}`) provada com `{==}` | exit 1, mostra a divergência | exit 1, mostra a divergência |
| Lei sem prova (`def Laws.zero_keeps` apagada) | exit 1, `1 TODO found` | exit 1, `SOME PROOFS FAIL`, `1 TODO found` |
| Lei **falsa** preenchida por `@unsafe def cheat` em `proofs/wheel.bend` (arquivo importado) | **exit 0, `All terms check.`** | exit 1, `SOME PROOFS FAIL`, `defs that depend on @unsafe: laws/wheel.blocked_stays, proofs/wheel.cheat` |

A terceira linha é o furo de solidez que a issue cita: o 2.0.27 aceita uma prova
falsa vinda de um import com `@unsafe`. Na Mesa isso **não acontece hoje**, porque
não há `@unsafe` no `core/`. Porém **nada impede que aconteça**, porque o portão
fixado não recusaria. Ver "Proteção enquanto fica no 2.0.27".

## Por que não refixar: os testes com cada toolchain

Os artefatos foram gerados por cada versão e os testes rodaram **sem** mudar código
de app. Nada foi commitado.

| Alvo | Provas | `chat`: `node --test tests/*.test.mjs` | `chat`: paridade | Causa |
|---|---|---|---|---|
| 2.0.27 (fixado) | verdes | 340/340 | 4/4 | — |
| 2.0.28 | `All terms check.` | 321/340 (19 falham) | 4/4 | tags `view.ViewEl` etc. (#1042) |
| 2.0.36 | `ALL PROOFS CHECK` | 307/340 (33 falham) | 3/4 | tags prefixadas, mais `BigInt(NaN)` ansioso em `search.clampLimit` |
| 2.0.37 `HEAD` | `ALL PROOFS CHECK` | 307/340 (33 falham) | 1/4 | `Nat` como `number` (#1506): `a Nat past the largest immediate` |

Na Mesa com os artefatos de `HEAD`, a rodada `node --test tests/*.test.mjs` foi
interrompida depois de cerca de 25 min (os testes que abrem Electron esperam o
prazo quando o núcleo lança erro). Até ali: 1006 ok, **415 falhas** e 199 ocorrências
de `a Nat past the largest immediate`. Já caíam `bookmarks`, `free-host-ipc`,
favoritos, fila e "Encerrar por hoje". Não rodei `ui` nem `hunts` com essa toolchain.

## Custo da migração para o `HEAD` (para a issue nova)

Com o `HEAD`, as tags não mudam: o trabalho é **só a fronteira `Nat`**, mais conferir
os dois pontos de `F32`.

- **Mesa (`desk/`)**: cerca de 190 usos de `BigInt(...)`, literais `0n` e `bigint`
  em 42 arquivos, entre hosts (`bookmarks.cjs`, `deletion-undo.cjs`,
  `free-workspaces.cjs`, `layout-presets.cjs`, `lib.cjs`, `main.cjs`,
  `material-pdf.cjs`, `pending.cjs`, `resume.cjs`, `review.cjs`, `rpc.cjs`), o
  renderer (`src/pdf.mjs`, `src/review.mjs`, `src/study-*.mjs`, `src/state.mjs`,
  `src/undo-deletion.mjs` …) e testes (`pdfnav`, `pdfview`, `pdfpageview`,
  `activityview`, `slashview`, `*-parity.mjs`).
- **Conversa (`chat/`)**: `src/chat.mjs`, `src/worklog.mjs`,
  `src/features/{find,search-content,model-picker,effort-menu,context-gauge,prompt-history}.mjs`
  e `rpc.cjs`, mais os testes `findbar`, `popoverview`, `gaugeview`,
  `lightboxview`, `searchview`, `search-content`, `worklog`, `rpc` e as paridades.
  **Isso exige liberar a regra "`chat/` muda só nos gerados".**
- A conversão já está espalhada em helpers locais repetidos (`nat = (n) =>
  BigInt(...)` em pelo menos seis arquivos). A migração é a chance de pôr uma
  casca única da fronteira Bend, `number` na entrada e na saída, conforme o
  `AGENTS.md` pede ("biblioteca de terceiros fica atrás de uma casca").
- Comparações com resultado `Nat` (`=== 0n`, `assert.equal(x, 2n)`) passam a
  falhar em silêncio, sem lançar erro, então a migração precisa de busca por
  `\b[0-9]+n\b` além de `BigInt`.
- `F32` agora passa por `Math.fround`: os testes de `wheel` e `state` que comparam
  valores exatos podem precisar de `Math.fround` no esperado.

## Proteção enquanto fica no 2.0.27

O furo do `@unsafe` importado vale para o portão fixado. Enquanto não houver
migração, uma checagem barata fecha o caso sem trocar a toolchain: o `proof.mjs`
pode reprovar quando `rg '@unsafe|def [A-Za-z_.]+\?\(|import "'` achar algo em
`core/**/*.bend`. Não implementei, porque fica fora do escopo da issue. Fica como
sugestão.

## Portões

Os artefatos voltaram ao estado da branch (`git status` limpo) e nenhum processo
Electron de teste ficou rodando.

- `npm run verify:bend` (toolchain 2.0.27): **verde**, com `88 artefatos
  reproduzíveis (nenhum byte mudou)` e `All terms check.`.
- Testes do `chat/` (`node --test tests/*.test.mjs` e paridade): **verdes**, 340/340 e 4/4.
- `MESA_GATE_CACHE=0 npm test`, `npm run ui` e `npm run hunts`: **não rodados** nesta entrega. O único commit é documentação
  (`docs/reviews/`), e nenhum código, artefato ou fixação mudou em relação a
  `c1c98d2`.
