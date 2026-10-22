# Ajustes pós-#41 — resultado

Quatro itens, um commit cada (mais dois de acerto de teste). Tudo local na branch da worktree; sem push nem PR.

1. **Indicador do modelo na coluna padrão.** No degrau `compact`, o `#check` (Conferir) vira só ícone, como o `#include-refs`, antes de o indicador perder o texto (`desk/style.css`, 2 linhas). O nome acessível completo vem de um `aria-label` posto em `updateCheckButton` (`desk/src/state.mjs`). `rowFit` e `fitIndicator` não mudaram. Em `model-indicator-ui` a asserção "o ponto vem antes do texto" ficou e ganhou outra: em 1440×900 o `.mi-text` aparece com o nome do modelo, e nos degraus apertados o Conferir é só ícone com nome acessível. `composer-box-ui` e `conferir-ui` liam o nome pelo `innerText`; agora leem o `aria-label`.
2. **`fake-pi` e a palavra "quiz".** `studentText()` corta o bloco de menções e o `[Contexto da Mesa]` / `[Desk context]`, e tira o envelope do chat lateral, que vem antes da fala. Quiz, "pensar profundo" e "teorema" olham só a fala do aluno. Teste novo: `desk/tests/fake-pi-student-text.test.mjs`, com caminho `quizzical-…` no contexto, nas menções e no envelope lateral.
3. **Toast × popover da Foto do celular.** Escolhi o mais simples: com o `#phone-pop` aberto não há toast, porque o `#phone-state` já confirma ("2 fotos recebidas"). Fechado, o toast segue (`phone-photo.mjs`, uma condição). `phone-photo-ui` agora afirma que não há toast sobre o popover aberto. Não há teste do toast com o popover fechado: a foto só chega pelo servidor quando o popover está aberto, então só o caminho de fotos retidas o alcança.
4. **Bundle sem arquivo fora dele.** `desk/tests/bundle-self-contained.test.mjs` monta o payload real com `stageBundlePayload` e falha se algum `.cjs/.mjs/.js/.ts/.json` (fora de `node_modules`) referir caminho relativo que saia da raiz do payload ou o caminho absoluto do repositório. Comentários são ignorados antes da busca. Um segundo teste prova que o detector pega o caso do shim `geogebra.ts`.

## Verificação

- `npm run verify:bend`: ok. `MESA_GATE_CACHE=0 npm test`: 1530 passam.
- `npm run ui` com model-indicator, composer, layout, responsive e os arquivos de `rg -l "data-fit|#check|FAKE_PI"`, mais `phone-photo` e `toast-position`: todos ok. Na primeira rodada `free-study-integration-ui` falhou sob carga em paralelo (`#free-bar` oculto) e passou sozinho: parece flaky, não é desta mudança.
- `npm run hunts` (24), `npm run test:packaged` e os smokes que usam `FAKE_PI`: ok.
