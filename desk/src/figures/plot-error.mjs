// @ts-check
/* Erro da cerca `plot` (#60): leva o que veio e o que se esperava, para o
   aviso na figura e para o tutor corrigirem sem adivinhar. O texto sai em
   pt-BR ou inglês; o idioma da tela decide onde há tela (`languageOf`). */

/** @typedef {'pt-BR' | 'en'} FigureLanguage */
/** @typedef {{line: number, received: string, expected: string}} PlotErrorDetail */

export class PlotError extends Error {
  /**
   * @param {string} code identifica a regra quebrada (`unknown-key`, `domain`, `expression`…)
   * @param {PlotErrorDetail} detail linha (1-based, 0 = a cerca toda), trecho recebido e formato esperado
   */
  constructor(code, detail) {
    super(`plot ${code}: recebeu ${JSON.stringify(detail.received)}, esperava ${detail.expected}`);
    this.name = 'PlotError';
    this.code = code;
    this.detail = detail;
  }
}

const PHRASES = {
  'pt-BR': {
    title: 'Não deu para desenhar o gráfico (cerca plot).',
    line: 'Linha {line}',
    received: 'veio',
    expected: 'esperado',
    fix: 'Corrija a cerca e mande de novo.',
  },
  en: {
    title: 'The chart could not be drawn (plot fence).',
    line: 'Line {line}',
    received: 'got',
    expected: 'expected',
    fix: 'Fix the fence and send it again.',
  },
};

/**
 * @param {unknown} value
 * @returns {FigureLanguage}
 * @example languageOf('en-US') // 'en'
 */
export function languageOf(value) {
  return typeof value === 'string' && value.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
}

/**
 * Frases do aviso, na ordem em que aparecem: título, onde, o que veio, o que se esperava e o conserto.
 * @param {PlotError} error
 * @param {FigureLanguage} [language]
 * @returns {{title: string, where: string, received: string, expected: string, fix: string}}
 * @example describePlotError(new PlotError('domain', {line: 2, received: 'x: abc', expected: '`x: mín..máx`'})).where // 'Linha 2'
 */
export function describePlotError(error, language = 'pt-BR') {
  const words = PHRASES[language];
  const {line, received, expected} = error.detail;
  return {
    title: words.title,
    where: line > 0 ? words.line.replace('{line}', String(line)) : '',
    received: `${words.received}: ${received || '—'}`,
    expected: `${words.expected}: ${expected}`,
    fix: words.fix,
  };
}
