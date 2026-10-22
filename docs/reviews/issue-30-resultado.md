# #30 — Resultado

Base `87a39ea`, branch `claude/goofy-booth-3464f9`, 14 commits (sem push/PR/merge). Produção (`core/`, `desk/*.cjs`, `desk/src`) **inalterada** (`git diff 87a39ea HEAD` vazio fora de tests/scripts/docs/AGENTS/README/package.json).

## Tempos (parede, s)

| Comando | Base | Final (rodada de fechamento, máquina carregada: load 8–12) | Melhor rodada (mesmo código) |
|---|---:|---:|---:|
| `MESA_GATE_CACHE=0 npm test` | 54,9 | 67 (54 sem competição; `node --test` 22,4 vs 22,9) | 54 |
| `npm run ui` (49 janelas, 2 por vez) | 736 (soma, uma por vez) | 576 | 383 |
| `npm run hunts` (2 por vez) | 352 | 360 | 331 |
| `npm run test:claude-ui` | 30,8 | 33 | 33 |
| `npm run verify:bend` | — (não medido na base) | 18 | |
| **Total** | **1174** | **1036 (−11,8 %)** | **801 (−31,8 %)** |

A meta de −30 % só aparece na melhor rodada; na de fechamento, com Music/Helium
consumindo CPU, ficou em −12 %. O ganho real vem do corredor de janelas em paralelo e das
capturas que só rodam sob pedido; os hunts não ganharam nada (o peso está em esperas
fixas e no `hunt-activity-isolation`, 152–163 s, 2,6 s por vetor — segurança, mantido).

## Linhas

`desk/tests/` (.mjs/.cjs de topo): 52 923 → 52 151 (**−1,5 %**; meta −20 % **não atingida**). Arquivos: 295 → 287.
Não há mais 10 mil linhas removíveis sem perder contrato: 1 358 R, 2 F, 8 C, 61 D no livro-razão
(1 429 asserções/blocos). Candidatos que exigiriam decisão do dono: camadas `claude-*`
(adapter 1 835, native-controls 809, environment 560, turn-policy 533…), fusão de janelas da
mesma tela (tutor-header+model-indicator, responsive×3, reader-bar+reader-empty,
settings-sections+resources, sidechat-*), ~278 `waitForTimeout` fixos (~243 s).

## Cobertura (`node --test --experimental-test-coverage tests/*.test.mjs`)

| | linhas | ramos | funções | testes |
|---|---:|---:|---:|---:|
| base | 75,74 | 79,21 | 65,86 | 1 316 |
| final | 75,21 | 79,03 | 65,05 | 1 251 |

Dentro de 2 p.p. (−0,53 / −0,18 / −0,81). Quedas > 5 p.p. por arquivo, todas em artefatos
**gerados** do Bend: `agentcaps`, `pending`, `sidechat`, `statusview`, `tabsview`,
`tutorheader`, `tutorstate`, `deskflags` (`*.core.js`) e `attachview.core.js` (sumiu do
relatório). Eram exercitados por testes de visão que só repetiam valores já provados pelas leis/provas
do Bend (que rodam no portão, fora da medição do node). A mutação manual
(`issue-30-mutacoes.md`) confirma que as leis ainda pegam as alterações dessas áreas.
`helpers.mjs` é o próprio auxiliar de teste.

## Lanes, camadas aposentadas, guardiões

Corredor comum (`run-suite/run-hunts/run-ui`, `npm run ui`, saída 77 = pulado); limpeza dos
runtimes e artefatos que passam (`helpers`: `artifactDir`, `reviewShot`); aposentados:
`live-pi`, `reference-live`, `reference-fixture`, `design-check`, `installed-smoke`,
`capture-new-ui`, `attachview.test`, `sidechat-scope.test`, `agent-core.test`,
`send-offline.test` (guardiões: leis Bend + `send-offline-ui`, `sidechat-ui`, `pending.test`),
blocos D em 9 testes de visão, 3 testes git do `updateflow` (cobertos por `gitreal`),
varreduras de fonte do `send`/`main`. Guardiões novos: `--ff-only` (updateflow) e "sem matéria
ativa" (resume).

## Mutação manual

Ver `docs/reviews/issue-30-mutacoes.md`: 22 mutações em 22 áreas; 17 pegas de saída, 3 não
pegas viraram teste/reversão (`--ff-only`, matéria vazia, token "no prazo" — testes devolvidos),
2 mutantes equivalentes documentados (`__proto__` em `pending`, poda em `deletion-undo`).

## Falhas que já existiam na base (não corrigidas: defeitos do app, não do teste)

Janelas: `improvements-ui`, `layout-rules-ui` (zoom 616,8 de 525), `material-preview-ui`,
`material-template-dialog-ui`, `mesa-interactive-ui`, `model-indicator-ui`
("nome do modelo inteiro na coluna mínima (Pi com visão)"). `activity-concurrency-ui`, que
falhava na base, passou. `hunt-activity-ui` falhou uma vez sob carga ("Page crashed"
no teste de flood) e passou isolado em 24 s — flaky sob 2 por vez.

## Não verificado

- `hunt-handoff` **pulado** (sem `chat/node_modules` no worktree): protocolo coberto só
  pelos testes unitários (`handoff.test`, `send.test`).
- Restauração de página/zoom no bundle instalado (`installed-smoke` aposentado).
- `docs/UI-PORT.md` ainda cita scripts removidos.

## Recomendações

1. `npm ci` em `chat/` na CI para o `hunt-handoff` voltar.
2. Trocar `waitForTimeout` por condições (≈ 240 s) — o maior ganho de tempo restante.
3. Paralelizar os vetores de `hunt-activity-isolation` (152 s) mantendo o isolamento.
4. Decidir sobre a família `claude-*` (≈ 5 mil linhas) e a fusão de janelas por tela.
5. Consertar os 6 testes de janela vermelhos antes de usá-los como portão.

## Atualização após o rebase em `main` (`ead45bb`)

- `git rebase main` limpo (16 commits). Produção continua sem diff do #30.
- As três janelas pedidas foram corrigidas em commit separado (ver o fim do livro-razão); as outras três falhas da base
  (`layout-rules-ui`, `mesa-interactive-ui`, `model-indicator-ui`) foram corrigidas na `main`.
- **`npm run ui`: 49 ok, 0 falhas, 0 pulados, 318 s** (2 por vez; base: 736 s uma por vez, 5–6 falhas).
  Tempo total do conjunto com esta rodada: 54 + 318 + ~331 + 33 ≈ 736 s (**−37 %** sobre 1174 s), com a ressalva de ruído de carga já descrita.
- Falhas restantes: nenhuma em janelas; `hunt-activity-ui` é flaky sob carga e `hunt-handoff` segue pulado.
