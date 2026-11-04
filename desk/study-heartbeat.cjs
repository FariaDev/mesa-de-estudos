// @ts-check
'use strict';

/* Batimento do cronômetro de estudo (#desempenho): escondida ou minimizada, a
   janela não conta segundos (o núcleo `studystats` zera o intervalo e o
   lifecycle de hide/show reinicia o relógio), mas o host lia e gravava o
   estatísticas a cada 15 s. O batimento só roda com a janela à vista; o
   relógio em si continua no host, que decide a visibilidade a cada tique. */

/**
 * `true` quando a janela pode contar tempo de estudo: visível e não minimizada.
 * @param {{visible: boolean, minimized: boolean}} facts
 * @returns {boolean}
 * @example heartbeatActive({visible: true, minimized: false}) // true
 */
function heartbeatActive({visible, minimized}) {
  return !!visible && !minimized;
}

/**
 * Agenda o batimento com dependências injetáveis (teste determinístico).
 * `beat` não é chamado com a janela escondida, minimizada ou durante a guarda.
 * @param {{active: () => boolean, beat: () => void, guard?: () => boolean,
 *   intervalMs?: number, setTimer?: (fn: () => void, ms: number) => any,
 *   clearTimer?: (timer: any) => void}} options
 * @returns {{tick: () => void, stop: () => void}}
 * @example
 * const timer = createStudyHeartbeat({active: () => win.isVisible(), beat: () => services.beat(true)});
 * timer.stop();
 */
function createStudyHeartbeat({
  active,
  beat,
  guard = () => false,
  intervalMs = 15000,
  setTimer = setInterval,
  clearTimer = clearInterval,
}) {
  function tick() {
    if (guard() || !active()) return;
    beat();
  }
  const timer = setTimer(tick, intervalMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
  return {tick, stop: () => clearTimer(timer)};
}

module.exports = {heartbeatActive, createStudyHeartbeat};
