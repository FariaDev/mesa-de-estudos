// Detecção da toolchain pinada do Bend (bun + bend).
//
// Fonte única para os três lugares que precisam saber se ela existe:
// `verify.mjs` (portão estrito), `build-safe.mjs` (build tolerante) e
// `desk/scripts/core-gate.mjs` (portão do `npm test`, que pula build/provas sem
// a toolchain). Os candidatos e a sonda de versão são os mesmos que o
// `verify.mjs` sempre usou; separar aqui evita que cada portão invente a sua
// própria ideia de "toolchain presente".
import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";

/** Diretório da toolchain do Bend (`BEND_HOME` ou `~/.bend`). */
export function bendHome(env = process.env) {
  return env.BEND_HOME || join(homedir(), ".bend");
}

/** Caminho do plugin TypeScript (`bend2/main.ts`), ou `''` se não existe. */
export function bendPluginPath(env = process.env) {
  const file = join(bendHome(env), "current", "bend2", "main.ts");
  return existsSync(file) ? file : "";
}

/** Candidatos do bun, na ordem em que o build tolerante sempre procurou. */
export function bunCandidates(env = process.env) {
  return [env.BUN_BIN, join(homedir(), ".bun", "bin", "bun"), "bun"].filter(Boolean);
}

/**
 * Primeiro bun que responde `--version`. Devolve `{bin, version}` ou `null`.
 * `spawn` entra por parâmetro para o teste usar um fake com nome.
 *
 * @example findBun() // {bin: '/home/ana/.bun/bin/bun', version: '1.4.2'}
 */
export function findBun({env = process.env, spawn = spawnSync} = {}) {
  for (const candidate of bunCandidates(env)) {
    const probe = spawn(candidate, ["--version"], {encoding: "utf8"});
    if (!probe.error) {
      return {bin: candidate, version: String(probe.stdout || "").trim()};
    }
  }
  return null;
}

/**
 * Binário do bend (`BEND_BIN` ou `bend`) que responde à versão. O bend 2.0.8+
 * fala pelo subcomando `version`; 2.0.7 e anteriores, por `--version`. Devolve
 * `{bin, version}` ou `null`.
 *
 * @example findBend() // {bin: 'bend', version: 'bend 2.0.37'}
 */
export function findBend({env = process.env, spawn = spawnSync} = {}) {
  const bin = env.BEND_BIN || "bend";
  const probe = (argv) => spawn(bin, argv, {
    encoding: "utf8",
    env: {...env, BEND_NO_TELEMETRY: "1"},
  });
  let out = probe(["version"]);
  if (out.error || out.status !== 0 || !String(out.stdout || "").trim()) out = probe(["--version"]);
  if (out.error || out.status !== 0) return null;
  return {bin, version: String(out.stdout || "").trim()};
}

/**
 * Estado completo: plugin, bun e binário do bend. `present` só é true quando
 * os três respondem — o mesmo critério do `verify.mjs`. `missing` diz o que
 * falta, em pt-BR, para a mensagem do portão.
 *
 * @example detectToolchain().present // false numa máquina sem ~/.bend
 */
export function detectToolchain({env = process.env, spawn = spawnSync} = {}) {
  const plugin = bendPluginPath(env);
  const bun = findBun({env, spawn});
  const bend = findBend({env, spawn});
  const missing = [];
  if (!plugin) missing.push(`plugin em ${join(bendHome(env), "current", "bend2", "main.ts")}`);
  if (!bun) missing.push("bun (BUN_BIN, ~/.bun/bin/bun ou PATH)");
  if (!bend) missing.push(`binário do bend (${env.BEND_BIN || "bend"})`);
  return {present: missing.length === 0, plugin, bun, bend, missing};
}
