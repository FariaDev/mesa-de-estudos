// Portão de provas do core: roda `bend PROOF.bend`. Sem bend instalado,
// avisa e sai com 0 — mesmo espírito do test:pi sem o Pi.
import {spawnSync} from "node:child_process";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.env.BEND_BIN || "bend", [join(here, "PROOF.bend")], {
  // BEND_NO_TELEMETRY=1 desliga a checagem diária do CLI do bend (o único
  // request que ele faz) — o portão não fala com a rede.
  env: {...process.env, BEND_NO_TELEMETRY: "1"},
  encoding: "utf8",
});
if (r.error?.code === "ENOENT") {
  console.log("bend não encontrado; provas ignoradas (instale: https://bend-lang.com)");
  process.exit(0);
}
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) {
  console.error("PROOF.bend falhou: alguma lei caiu.");
  process.exit(r.status ?? 1);
}
