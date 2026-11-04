/* Decisão do portão do núcleo quando a toolchain do Bend falta.

   `npm test` tem de funcionar em máquina de quem só vai usar o app: o build e
   as provas exigem a toolchain pinada (bun + bend), mas `check`, `typecheck`,
   `lint` e `test:parity` são Node puro e continuam valendo. Pular nunca é
   silencioso — o aviso diz o que ficou de fora e qual portão confere depois.
   `MESA_REQUIRE_BEND=1` (o CI do núcleo) troca o pulo por falha. */

export const BEND_SKIP_NOTICE = 'toolchain do Bend ausente: pulei build/provas; o pre-push roda `npm run verify:bend`';

export const BEND_REQUIRED_FAILURE = 'toolchain do Bend ausente e MESA_REQUIRE_BEND=1: o portão exige build e provas (instale o bun e o bend fixados em core/toolchain.json)';

/**
 * Decide se o portão roda build/provas. `toolchain` é o resultado de
 * `detectToolchain()`; `requireBend` vem de `MESA_REQUIRE_BEND=1`.
 *
 * @example
 * bendGatePlan({toolchain: {present: false}, requireBend: false})
 * // {runBend: false, fail: '', notice: 'toolchain do Bend ausente: ...'}
 */
export function bendGatePlan({toolchain, requireBend = false}) {
  if (toolchain?.present) return {runBend: true, fail: '', notice: ''};
  if (requireBend) return {runBend: false, fail: BEND_REQUIRED_FAILURE, notice: ''};
  return {runBend: false, fail: '', notice: BEND_SKIP_NOTICE};
}

/**
 * O cache guarda o hash do conteúdo aprovado pela última rodada com toolchain.
 * Sem ela, esse hash ainda prova que os artefatos do checkout são exatamente os
 * que passaram pelo build; se o conteúdo mudou, não há como conferir sem bun —
 * e o portão diz isso em vez de fingir que conferiu.
 *
 * @example
 * artifactFreshness({cached: {hash: 'abc'}, hash: 'abc', count: 68}).known // true
 */
export function artifactFreshness({cached, hash, count}) {
  if (cached?.hash === hash) {
    return {
      known: true,
      line: `artefatos gerados conferem com a última rodada aprovada (${count} arquivos; hash guardado).`,
    };
  }
  return {
    known: false,
    line: 'sem toolchain não dá para conferir se os artefatos gerados estão em dia; o pre-push (`npm run verify:bend`) confere.',
  };
}
