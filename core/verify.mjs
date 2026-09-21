// Portão estrito de dev/commit: exige a toolchain completa (bun + bend),
// confere a identidade fixada em `toolchain.json`, regenera os artefatos e
// falha se o rebuild mudar qualquer byte, e roda as provas com o MESMO bend.
// O `build-safe.mjs`/`proof.mjs` continuam tolerantes para o uso local sem
// Bend; este aqui é o que deve rodar antes de commitar.
// Uso: `node core/verify.mjs` (ou `npm run verify:bend` na pasta de um app).
//      `node core/verify.mjs --pin` aceita a toolchain atual como nova fixação
//      (faça isso só depois de validar o diff dos artefatos e as provas).
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const GEN_DIRS = ["desk/src/generated", "chat/src/generated"];
const TOOLCHAIN = join(here, "toolchain.json");
const pin = process.argv.includes("--pin");
const fail = (message) => {
  console.error(`verify: ${message}`);
  process.exit(1);
};

// 1. Toolchain: mesma distribuição para compilar e provar.
const bendHome = process.env.BEND_HOME || join(homedir(), ".bend");
const plugin = join(bendHome, "current", "bend2", "main.ts");
if (!existsSync(plugin)) fail(`bend não encontrado em ${plugin} — instale com https://bend-lang.com/install.sh`);
const pluginSha = createHash("sha256").update(readFileSync(plugin)).digest("hex");

const bendBin = process.env.BEND_BIN || "bend";
const bendProbe = spawnSync(bendBin, ["--version"], {encoding: "utf8"});
if (bendProbe.error || bendProbe.status !== 0) fail(`binário do bend não respondeu (${bendBin}) — o portão exige a toolchain completa`);
const bendVersion = String(bendProbe.stdout || "").trim();

let bun = null;
let bunVersion = "";
for (const candidate of [process.env.BUN_BIN, join(homedir(), ".bun", "bin", "bun"), "bun"].filter(Boolean)) {
  const probe = spawnSync(candidate, ["--version"], {encoding: "utf8"});
  if (!probe.error) {
    bun = candidate;
    bunVersion = String(probe.stdout || "").trim();
    break;
  }
}
if (!bun) fail("bun não encontrado — o portão estrito exige a toolchain completa (o `build-safe` segue tolerante no dia a dia)");

const current = {bend: {pluginSha256: pluginSha, binary: bendBin, version: bendVersion}, bun: bunVersion};
if (pin) {
  // `source` é procedência escrita à mão (repo@commit): o --pin não a inventa, só preserva.
  const previous = existsSync(TOOLCHAIN) ? JSON.parse(readFileSync(TOOLCHAIN, "utf8")) : null;
  if (previous?.bend?.source) current.bend.source = previous.bend.source;
  writeFileSync(TOOLCHAIN, JSON.stringify(current, null, 2) + "\n");
  console.log(`verify: toolchain fixada em ${TOOLCHAIN}`);
} else if (!existsSync(TOOLCHAIN)) {
  fail("toolchain não fixada — rode `node core/verify.mjs --pin` e commite core/toolchain.json");
} else {
  const pinned = JSON.parse(readFileSync(TOOLCHAIN, "utf8"));
  const diffs = [];
  if (pinned.bend?.pluginSha256 !== pluginSha) diffs.push(`plugin bend: ${String(pinned.bend?.pluginSha256).slice(0, 12)} → ${pluginSha.slice(0, 12)}`);
  if (pinned.bend?.version !== bendVersion) diffs.push(`bend: ${pinned.bend?.version} → ${bendVersion}`);
  if (pinned.bun !== bunVersion) diffs.push(`bun: ${pinned.bun} → ${bunVersion}`);
  if (diffs.length) {
    console.error(diffs.join("\n"));
    if (pinned.bend?.source) console.error(`verify: a toolchain fixada veio de ${pinned.bend.source}`);
    fail("toolchain diferente da fixada — valide o diff dos artefatos/provas e rode `node core/verify.mjs --pin` para aceitar");
  }
  if (pinned.bend?.source) console.log(`verify: fixada de ${pinned.bend.source}`);
}
console.log(`verify: bend ${bendVersion} (${bendBin}), plugin ${pluginSha.slice(0, 12)}, bun ${bunVersion} (${bun})`);

// 2. Impressão digital dos artefatos antes do rebuild.
const hashArtifacts = () => {
  const hashes = new Map();
  for (const dir of GEN_DIRS) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).sort()) {
      if (!name.endsWith(".core.js")) continue;
      hashes.set(`${dir}/${name}`, createHash("sha256").update(readFileSync(join(abs, name))).digest("hex"));
    }
  }
  return hashes;
};
const before = hashArtifacts();

// 3. Regenera (o build roda com bun).
const build = spawnSync(bun, [join(here, "build.mjs")], {stdio: "inherit"});
if (build.status !== 0) fail("o build falhou");

// 4. Nada pode ter mudado: o versionado tem que ser reproduzível.
const after = hashArtifacts();
const drift = [];
for (const [rel, hash] of after) if (before.get(rel) !== hash) drift.push(rel);
for (const rel of before.keys()) if (!after.has(rel)) drift.push(`${rel} (sumiu)`);
if (drift.length) {
  console.error(drift.join("\n"));
  fail("os artefatos mudaram ao regenerar — commite o build (`npm run build:bend`)");
}
console.log(`verify: ${after.size} artefatos reproduzíveis (nenhum byte mudou)`);

// 5. Provas com o mesmo binário do bend.
const proof = spawnSync(process.execPath, [join(here, "proof.mjs")], {
  stdio: "inherit",
  env: {...process.env, BEND_BIN: bendBin},
});
if (proof.status !== 0) fail("PROOF.bend falhou");

console.log("verify: ok — toolchain fixada e presente, artefatos em dia, provas verdes");
