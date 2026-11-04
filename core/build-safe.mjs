// Wrapper tolerante do build: acha o bun (BUN_BIN, ~/.bun/bin ou PATH) e roda
// core/build.mjs. Sem bun, avisa e sai com 0 — o artefato gerado continua
// valendo, então o app e os testes seguem de pé em máquina sem Bend.
import {spawnSync} from "node:child_process";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {findBun} from "./toolchain.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bun = findBun();
if (!bun) {
  console.log("bun não encontrado; build do core ignorado (o artefato gerado continua valendo)");
  process.exit(0);
}

const r = spawnSync(bun.bin, [join(here, "build.mjs")], {stdio: "inherit"});
if (r.error) {
  console.error(String(r.error));
  process.exit(1);
}
process.exit(r.status ?? 1);
