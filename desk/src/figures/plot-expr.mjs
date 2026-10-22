// @ts-check
/* Expressões de uma variável da cerca `plot` (#60). Um analisador recursivo
   que devolve uma função `x → número`: nada de `eval`, `Function` nem acesso
   a objetos — só o que a gramática abaixo reconhece. Importável em Node puro.

   Gramática (a maior precedência primeiro):
     átomo     número | x | pi | e | nome(expr) | (expr)
     potência  átomo ('^' | '**') unário        (associa à direita)
     unário    ('-' | '+') unário | potência
     termo     unário (('*' | '/' | ·) unário | multiplicação implícita)*
     expr      termo (('+' | '-') termo)*
   Multiplicação implícita: `2x`, `3sin(x)`, `2(x+1)`, `(x+1)(x-1)`. */

import {PlotError} from './plot-error.mjs';

/** @typedef {(x: number) => number} Curve */

/** @type {Record<string, (value: number) => number>} */
const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
};
/** Nomes das funções que a cerca aceita, para o guia do tutor listar o que vale. */
export const FUNCTION_NAMES = Object.keys(FUNCTIONS);
const CONSTANTS = {pi: Math.PI, e: Math.E};

/** @type {Array<[RegExp, string]>} */
const SPELLINGS = [[/−/g, '-'], [/[×·⋅]/g, '*'], [/π/g, 'pi'], [/÷/g, '/'], [/\*\*/g, '^']];

/** @param {string} source */
function tokenize(source) {
  const text = SPELLINGS.reduce((acc, [pattern, to]) => acc.replace(pattern, to), source);
  /** @type {Array<{kind: string, value: string, at: number}>} */
  const tokens = [];
  const pattern = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(.))/gy;
  let match;
  while (pattern.lastIndex < text.length && (match = pattern.exec(text))) {
    if (match[1] !== undefined) tokens.push({kind: 'num', value: match[1], at: match.index});
    else if (match[2] !== undefined) tokens.push({kind: 'name', value: match[2].toLowerCase(), at: match.index});
    else if (match[3] !== undefined) tokens.push({kind: 'sym', value: match[3], at: match.index});
  }
  return tokens;
}

/**
 * Compila uma expressão em `x`.
 * @param {string} source texto escrito pelo tutor
 * @param {number} [line] linha da cerca, para o erro
 * @returns {Curve}
 * @throws {PlotError} com o trecho recebido e o formato esperado
 * @example compileCurve('2x^2 - 3')(2) // 5
 * @example compileCurve('sin(pi*x)')(0.5) // 1
 */
export function compileCurve(source, line = 0) {
  const tokens = tokenize(String(source));
  let at = 0;
  /** @param {string} reason */
  const fail = (reason) => new PlotError('expression', {line, received: String(source).trim(), expected: reason});
  const peek = () => tokens[at];
  /** @param {string} value */
  const isSym = (value) => peek()?.kind === 'sym' && peek().value === value;
  const startsAtom = () => {
    const token = peek();
    return Boolean(token) && (token.kind === 'num' || token.kind === 'name' || (token.kind === 'sym' && token.value === '('));
  };

  /** @returns {Curve} */
  function atom() {
    const token = tokens[at++];
    if (!token) throw fail('mais uma parte: a expressão acaba cedo (ex.: `x^2 - 3`)');
    if (token.kind === 'num') return constant(Number(token.value));
    if (token.kind === 'sym' && token.value === '(') {
      const inner = sum();
      if (!isSym(')')) throw fail('um `)` fechando o `(`');
      at += 1;
      return inner;
    }
    if (token.kind === 'name') return named(token.value);
    throw fail(`um número, \`x\`, uma função ou \`(\`, mas veio \`${token.value}\``);
  }

  /** @param {string} name @returns {Curve} */
  function named(name) {
    if (name === 'x') return (x) => x;
    if (Object.hasOwn(CONSTANTS, name)) return constant(CONSTANTS[/** @type {'pi'|'e'} */ (name)]);
    const apply = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : null;
    if (!apply) throw fail(`\`x\`, pi, e ou uma função (${Object.keys(FUNCTIONS).join(', ')}), mas veio \`${name}\``);
    if (!isSym('(')) throw fail(`\`${name}(...)\` com parênteses`);
    at += 1;
    const argument = sum();
    if (!isSym(')')) throw fail(`um \`)\` fechando \`${name}(\``);
    at += 1;
    return (x) => apply(argument(x));
  }

  /** @param {number} value @returns {Curve} */
  const constant = (value) => () => value;

  /** @returns {Curve} */
  function power() {
    const base = atom();
    if (!isSym('^')) return base;
    at += 1;
    const exponent = unary();
    return (x) => Math.pow(base(x), exponent(x));
  }

  /** @returns {Curve} */
  function unary() {
    if (isSym('-')) {
      at += 1;
      const inner = unary();
      return (x) => -inner(x);
    }
    if (isSym('+')) {
      at += 1;
      return unary();
    }
    return power();
  }

  /** @returns {Curve} */
  function product() {
    let left = unary();
    while (isSym('*') || isSym('/') || startsAtom()) {
      const divide = isSym('/');
      if (isSym('*') || divide) at += 1;
      const right = unary();
      const before = left;
      left = divide ? (x) => before(x) / right(x) : (x) => before(x) * right(x);
    }
    return left;
  }

  /** @returns {Curve} */
  function sum() {
    let left = product();
    while (isSym('+') || isSym('-')) {
      const minus = isSym('-');
      at += 1;
      const right = product();
      const before = left;
      left = minus ? (x) => before(x) - right(x) : (x) => before(x) + right(x);
    }
    return left;
  }

  if (tokens.length === 0) throw fail('uma expressão em `x` (ex.: `x^2 - 3`)');
  const curve = sum();
  if (at < tokens.length) throw fail(`um operador (+ - * / ^) antes de \`${tokens[at].value}\``);
  return curve;
}
