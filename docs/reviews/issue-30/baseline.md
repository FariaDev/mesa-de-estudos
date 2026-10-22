# Baseline do #30 (base `87a39ea`, Node v26.10.0, Electron 44, macOS)

Medido antes de qualquer mudança. Tempos de parede em segundos.

| Comando | Resultado | Tempo |
|---|---|---|
| `MESA_GATE_CACHE=0 npm test` (portão sem cache + `node --test tests/*.test.mjs`) | 1316 testes + 5 de portão, todos passam | **54,9 s** (o `node --test` sozinho: 22,9 s) |
| `npm run hunts` (2 por vez) | 22 ok, 1 falha (`hunt-handoff`: faltam as deps de `chat/` no worktree) | **352 s** |
| janelas (`*-ui.mjs`/smokes), uma por vez, 46 arquivos | 41 ok, 5 falham já na base | **736 s** (soma) |
| `npm run test:claude-ui` (9 sequenciais) | 9 ok | **30,8 s** |
| **Total (soma)** | | **≈ 1174 s (19,6 min)** |

Meta de tempo: ≥ 30 % menos ⇒ ≤ ≈ 820 s.

## Falhas já na base (relatar, não apagar)

`activity-concurrency-ui`, `improvements-ui`, `material-preview-ui`,
`material-template-dialog-ui`, `mesa-interactive-ui` (janelas) e `hunt-handoff`
(sem `chat/node_modules` no worktree). Em rodadas do par também apareceram
`layout-rules-ui` e `model-indicator-ui`; `subjects-ui` oscila sob carga.
`dialog-standard-ui` entrou com o merge de `87a39ea` e não está na soma acima.

## Cobertura (`node --test --experimental-test-coverage tests/*.test.mjs`)

Linhas 75,73 % · ramos 79,25 % · funções 65,85 %. Meta: dentro de 2 p.p.; queda
> 5 p.p. por arquivo de produção precisa de explicação.

## Linhas

`desk/tests/`: 251 arquivos `.mjs`/`.cjs` + fixtures, **52 923 linhas**.
Produção em `desk/` (cjs/mjs/html/css fora de generated e tests): ~45 mil linhas.

## Vazamentos de uma rodada completa (`git status --ignored`)

`desk/.test-runtime-*` (hunt-erro, hunt-handoff, improvements,
settings-resources, sidechat-questions), `desk/fora-da-area.png` (`hunt-chat`),
`docs/reviews/<data>/{ui,tutor-pdf-ui}` (capturas de `tutor-pdf-ui`),
`desk/tests/artifacts/`.
