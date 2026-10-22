/* Lint só de erros (#43 fase 3): regras de correção, nenhuma de estilo. O
   repositório não é formatado (apagaria o `git blame`); o que entra aqui pega
   variável e import mortos, nome indefinido e comparação frouxa entre tipos.
   Roda no portão do `npm test` (`npm run lint`). */
import js from '@eslint/js';
import globals from 'globals';
import {builtinRules} from 'eslint/use-at-your-own-risk';

/* Do `recommended`, só as regras que o ESLint classifica como `problem` (erro
   provável) e as `suggestion` que pegam bug de verdade (redeclaração, global
   sobrescrito, `case` com declaração, gerador sem `yield`). Ficam de fora as de
   gosto: bloco vazio, escape e espaço em regex, `!!` redundante, `cause` no
   erro relançado. */
const BUG_SUGGESTIONS = new Set(['no-case-declarations', 'no-delete-var', 'no-global-assign', 'no-nonoctal-decimal-escape',
  'no-octal', 'no-redeclare', 'no-shadow-restricted-names', 'no-with', 'require-yield']);
const recommendedProblems = Object.fromEntries(Object.entries(js.configs.recommended.rules)
  .filter(([rule]) => builtinRules.get(rule)?.meta?.type === 'problem' || BUG_SUGGESTIONS.has(rule)));

const correctness = {
  ...recommendedProblems,
  'no-unused-vars': ['error', {args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true}],
  /* `==` só onde os dois lados são do mesmo tipo de propósito: `x == null` vale. */
  eqeqeq: ['error', 'smart'],
};

export default [
  {ignores: ['node_modules/**', 'src/generated/**', '.runtime/**', '.*/**', 'assets/**', 'vendor/**']},
  {
    files: ['**/*.cjs'],
    languageOptions: {sourceType: 'commonjs', ecmaVersion: 'latest', globals: {...globals.node}},
    rules: correctness,
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {sourceType: 'module', ecmaVersion: 'latest', globals: {...globals.node, ...globals.browser}},
    rules: correctness,
  },
  /* O preload roda no renderer (sandbox) e os fixtures `.js` são scripts de página. */
  {files: ['preload.cjs'], languageOptions: {globals: {...globals.node, ...globals.browser}}},
  {files: ['tests/fixtures/**/*.js'], languageOptions: {sourceType: 'script', globals: {...globals.browser}}},
];
