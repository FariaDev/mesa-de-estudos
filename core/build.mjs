// Gera os artefatos JS dos módulos Bend do core para a Mesa.
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
  ...["mesaqolescape", "mesaqolpalette", "mesaqollayout", "undoview"].map(name => ({entry: `${name}.bend`, out: join(import.meta.dir, "..", "desk", "src", "generated")})),
  {entry: "wheel.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "worklog.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "library.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "find.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "courses.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "study.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "studytoolsview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "chatlibraryview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "studysearch.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "studyannotations.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "studystats.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "reviewschedule.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "studycontext.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "config.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "agentcaps.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "agentdelivery.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "sidechat.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "freeworkspaces.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "framing.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "rpcstate.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "view.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "state.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Cor de acento. */
  {entry: "accent.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Guia da Mesa: ordem das seções, Próximo/Anterior e busca; só a Mesa. */
  {entry: "guideview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "attachments.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "sessions.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "composerview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "statusview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "worklogview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfref.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfnav.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "review.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "tabsview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "tutorheader.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "toastview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "talkview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Avisos de atualização do Pi e do Claude Code (ticket #45): só a Mesa. */
  {entry: "updatenotice.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* View nativa do GeoGebra diante das sobreposições (ticket #52): só a Mesa. */
  {entry: "overlay.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Quadro limpo do GeoGebra por uso do tutor (ticket #53): só a Mesa. */
  {entry: "ggbboard.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Menções @ das ferramentas do tutor na caixa de mensagem (ticket #53): só a Mesa. */
  {entry: "toolmentions.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "dialogsview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "calcview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "auxview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pdfpageview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Folha "Lista 0" do leitor sem material (ticket #12): só a Mesa. */
  /* Modelos de PDF do tutor (#39): só a Mesa. */
  {entry: "materialmodel.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "readersheet.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "shortcutview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "deskflags.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Caixa de mensagem única (ticket #15): só a Mesa. */
  {entry: "composerbox.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "attachview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "slashview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "pending.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  {entry: "resume.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Estados do tutor na coluna (ticket #17): só a Mesa. */
  {entry: "tutorstate.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Configurações com seções na lateral (ticket #20): só a Mesa. */
  {entry: "settingsview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Primeira abertura dentro do app (ticket #21): só a Mesa. */
  {entry: "firstrun.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Conferir com outros programas (ticket #35): só a Mesa. */
  {entry: "conferir.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Visualizações e atividades no chat (ticket #42): só a Mesa. */
  {entry: "activityview.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Mensagem traduzível, chave + argumentos num String (#41): só a Mesa. */
  {entry: "msg.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Idioma da interface e do tutor (#41): só a Mesa. */
  {entry: "language.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Faixa de versões do Claude Code (#51): só a Mesa. */
  {entry: "claudeversion.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Modelos grátis do OpenCode Zen pelo Pi (#44): só a Mesa. */
  {entry: "freemodels.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
  /* Foto do celular: fluxo e porta do site local (#36): só a Mesa. */
  {entry: "phonedrop.bend", out: join(import.meta.dir, "..", "desk", "src", "generated")},
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
