/* `calcular` — UM texto e um formato de resultado para os três motores
   (Pi `mesa_calcular`, Claude e OpenCode `calcular`). O cálculo é o MESMO
   avaliador da calculadora da janela (`desk/calculator.mjs`): parser próprio,
   sem `eval`, sem laço e sem I/O. Descrição e campos são SEMPRE em inglês; o
   resultado (`calcText`) segue em português.

   Ângulo: `graus` é explícito e o padrão é RAD (`false`). Não segue o último
   modo da calculadora da janela — a decisão do Lucas (#91) foi o tutor ter o
   próprio padrão, previsível. */

const MAX_EXPRESSION = 500;
export const CALC_DEFAULT_DEGREES = false;

export const CALC_DESCRIPTION =
  'Evaluates one numeric expression with the desk calculator, locally and without spending model tokens. ' +
  'Use it for arithmetic and unit checks before writing a result. ' +
  `Operators: + - * / % ^ and parentheses; functions: sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log, exp; constants: pi, e. ` +
  `Up to ${MAX_EXPRESSION} characters. No variables, assignments or algebra. ` +
  'Angle mode: graus:false (default) means radians; graus:true means degrees.';

export const CALC_FIELDS = {
  expressao: {type: 'string', min: 1, max: MAX_EXPRESSION, trim: true, description: `Expression to evaluate (1 to ${MAX_EXPRESSION} characters).`},
  graus: {type: 'boolean', default: CALC_DEFAULT_DEGREES, description: 'true treats angles as degrees; false (default) as radians.'},
};

/**
 * O texto que volta ao tutor com o resultado do avaliador.
 * @param {string} value resultado já formatado por `calculate`
 * @returns {string}
 * @example calcText('0.5') // 'Resultado: 0.5'
 */
export function calcText(value) {
  return `Resultado: ${value}`;
}
