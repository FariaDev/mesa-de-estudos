// Wrapper tolerante do build: acha o bun (BUN_BIN, ~/.bun/bin ou PATH) e roda
// core/build.mjs. Sem bun, avisa e sai com 0 — o artefato gerado continua
// valendo, então o app e os testes seguem de pé em máquina sem Bend.
import {spawnSync} from "node:child_process";
import {homedir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.BUN_BIN,
  join(homedir(), ".bun", "bin", "bun"),
  "bun",
].filter(Boolean);

for (const candidate of candidates) {
  const r = spawnSync(candidate, [join(here, "build.mjs")], {stdio: "inherit"});
  if (!r.error) process.exit(r.status ?? 1);
  if (r.error.code !== "ENOENT") {
    console.error(String(r.error));
    process.exit(1);
  }
}
console.log("bun não encontrado; build do core ignorado (o artefato gerado continua valendo)");
