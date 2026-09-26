// Gera os artefatos JS dos módulos Bend do core para os apps.
// Rodar com bun: `bun core/build.mjs` (ou `npm run build:bend` no app).
// O app empacotado não depende do Bend — só do arquivo gerado.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

const BEND_HOME = process.env.BEND_HOME || join(homedir(), ".bend");
const pluginPath = join(BEND_HOME, "current", "bend2", "main.ts");
if (!existsSync(pluginPath)) {
  console.error(`bend não encontrado em ${pluginPath}`);
  console.error("instale com: curl -fsSL https://bend-lang.com/install.sh | sh");
  process.exit(1);
}
const {default: bendPlugin} = await import(pathToFileURL(pluginPath).href);

const BUILD = [
  {entry: "wheel.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "worklog.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "library.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "find.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "courses.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "study.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "studycontext.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* O bilhete Conversa → Mesa é o único módulo gerado para os DOIS apps: um lado
     escreve, o outro lê, e o formato precisa ser o mesmo byte a byte. */
  {entry: "handoff.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "handoff.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "config.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "framing.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "rpcstate.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "view.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "view.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "state.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "state.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "attachments.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "attachments.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "sessions.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "sessions.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "toolpolicy.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "framing.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "rpcstate.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "worklog.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "search.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "composerview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "composerview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "searchview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "statusview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "statusview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "worklogview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "worklogview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "pdfref.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfnav.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "review.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "tabsview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "toastview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "talkview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "dialogsview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "calcview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "auxview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfpageview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "chatlist.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "paletteview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "msgview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "findbar.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "popoverview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "comfortview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "notifyview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "lightboxview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "gaugeview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "keysview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "shortcutview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "welcomeview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "welcomeview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "deskflags.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "attachview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "attachview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "talkview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "slashview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "slashview.bend", out: join(import.meta.dir, "..", "chat", "src", "generated")},
  {entry: "pending.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "resume.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
];

for (const job of BUILD) {
  mkdirSync(job.out, {recursive: true});
  writeFileSync(join(job.out, "package.json"), JSON.stringify({type: "module"}, null, 2) + "\n");
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, job.entry)],
    outdir: job.out,
    target: "browser",
    format: "esm",
    minify: false,
    naming: "[name].core.js",
    plugins: [bendPlugin],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(String(log));
    process.exit(1);
  }
  for (const out of result.outputs) {
    const header = `// GERADO de core/${job.entry} por \`bun core/build.mjs\` — não editar à mão.\n`;
    // O plugin anota o caminho do entry relativo ao cwd do build; o canônico é
    // `// core/<módulo>` para o artefato ser idêntico de qualquer diretório.
    let text = readFileSync(out.path, "utf8");
    const firstBreak = text.indexOf("\n");
    const firstLine = firstBreak === -1 ? text : text.slice(0, firstBreak);
    if (firstLine.startsWith("// ") && firstLine.endsWith(job.entry)) {
      text = `// core/${job.entry}` + text.slice(firstLine.length);
    }
    if (!text.startsWith("// GERADO")) text = header + text;
    writeFileSync(out.path, text);
    console.log("gerado", out.path.replace(homedir(), "~"));
  }
}
