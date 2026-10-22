// Varredura de escape do verificador (#47). O bend 2.0.27 aceitava uma lei
// falsa preenchida por `@unsafe` num arquivo importado ("All terms check.",
// saída 0). Desde a #49 a toolchain fixada é a 2.0.37 (d2aeefc1), que recusa
// (`SOME PROOFS FAIL`), e a varredura fica como segunda camada barata: ela não
// depende da toolchain, então ainda pega o escape numa máquina com o `~/.bend`
// antigo, antes de o `verify` reclamar da versão. Recusa no texto `@unsafe`,
// def estrangeira (`def nome?(`) e import por string (`import "…"`). Hoje o
// core/ não tem nenhum dos três (docs/reviews/issue-49-resultado.md).
import {readdirSync, readFileSync} from "node:fs";
import {join, relative} from "node:path";

/** @typedef {{file: string, line: number, rule: string, text: string}} UnsafeHit */

/** @type {ReadonlyArray<{rule: string, pattern: RegExp}>} */
export const UNSAFE_RULES = [
  {rule: "@unsafe", pattern: /@unsafe\b/},
  {rule: "def estrangeira", pattern: /\bdef\s+[A-Za-z_][\w.]*\?\s*\(/},
  {rule: "import por string", pattern: /\bimport\s+"/},
];

/**
 * Lista os `.bend` de `dir`, recursivo, em ordem estável.
 * @param {string} dir
 * @returns {string[]}
 */
function bendFiles(dir) {
  return readdirSync(dir, {withFileTypes: true, recursive: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith(".bend"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/**
 * Acha os escapes do verificador nos `.bend` de `root`.
 * @param {string} root pasta do núcleo (ex.: `core/`)
 * @returns {UnsafeHit[]} vazio quando o núcleo está limpo
 * @example findUnsafe("core") // → [] hoje
 */
export function findUnsafe(root) {
  const hits = [];
  for (const file of bendFiles(root)) {
    readFileSync(file, "utf8").split("\n").forEach((text, index) => {
      for (const {rule, pattern} of UNSAFE_RULES) {
        if (pattern.test(text)) hits.push({file: relative(root, file), line: index + 1, rule, text: text.trim()});
      }
    });
  }
  return hits;
}

/**
 * Mensagem de recusa do portão, uma linha por achado.
 * @param {UnsafeHit[]} hits
 * @returns {string}
 */
export function describeUnsafe(hits) {
  const lines = hits.map((hit) => `  core/${hit.file}:${hit.line} [${hit.rule}] ${hit.text}`);
  return [
    `escape do verificador no núcleo (${hits.length}); um bend 2.0.27 aceitaria prova falsa por aqui (#47):`,
    ...lines,
    "Prove a lei sem escape: o @unsafe não vira prova (o bend fixado, 2.0.37, também recusa).",
  ].join("\n");
}
