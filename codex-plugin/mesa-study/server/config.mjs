/* Configuração de INICIALIZAÇÃO do servidor MCP da Mesa (Codex).
   Regras do desenho:
   - raízes autorizadas, cacheDir, helper, perfis de estudo e checkpoint são
     fixados AQUI e congelados; chamadas de ferramenta nunca os recebem nem
     podem ampliá-los;
   - `--root /abs` é repetível; `--cache-dir /abs`, `--xournal-helper /abs`,
     `--max-image-bytes N`, `--tutor-file /abs.md`, `--learner-file /abs.md`
     e `--state-file /abs/cache.json` são opcionais;
   - alternativas por ambiente: MESA_STUDY_ROOTS (JSON de caminhos),
     MESA_STUDY_CACHE_DIR, MESA_XOURNAL_HELPER, MESA_STUDY_MAX_IMAGE_BYTES,
     MESA_STUDY_TUTOR_FILE, MESA_STUDY_LEARNER_FILE e MESA_STUDY_STATE_FILE;
   - flag de linha de comando vence o ambiente; sem nenhuma das duas, o valor
     fica ausente (o servidor inicia mesmo assim e mesa_status mostra o setup);
   - perfis recusam symlink/não-arquivo/acima do teto/não-UTF8 no startup
     (STARTUP_INVALID) e o checkpoint precisa ser filho direto do cacheDir.
 */

import path from 'node:path';
import {HostError} from '../host/errors.mjs';
import {MAX_PAGE, MAX_PDF_BYTES, MAX_PATH_CHARS, MAX_ROOTS} from '../host/config.mjs';
import {isExecutableFile, resolvePopplerTool} from '../host/tools.mjs';
import {POPPLER_DIRS} from '../host/config.mjs';
import {canonicalizeFrozenPath} from './checks.mjs';
import {MAX_PROFILE_BYTES, inspectProfilePathSync, profileReason} from './profiles.mjs';
import {MAX_STATE_BYTES, inspectStatePathSync, stateReason} from './persistence.mjs';

export const SERVER_NAME = 'mesa-study';
export const SERVER_VERSION = '0.2.2-experimental';
export const HOST_SNAPSHOT = Object.freeze({
  origin: 'claude-mod/mesa-study/host',
  takenAt: '2026-10-05',
  adjusted: Object.freeze(['capture.mjs']),
});

export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_MAX_IMAGE_BYTES = 4 * 1024;
export const MAX_MAX_IMAGE_BYTES = 32 * 1024 * 1024;

export const ENV = Object.freeze({
  roots: 'MESA_STUDY_ROOTS',
  cacheDir: 'MESA_STUDY_CACHE_DIR',
  xournalHelper: 'MESA_XOURNAL_HELPER',
  maxImageBytes: 'MESA_STUDY_MAX_IMAGE_BYTES',
  tutorFile: 'MESA_STUDY_TUTOR_FILE',
  learnerFile: 'MESA_STUDY_LEARNER_FILE',
  stateFile: 'MESA_STUDY_STATE_FILE',
});

export function usageText() {
  return [
    'Uso: node server/main.mjs [opções]',
    '',
    '  --root /caminho/absoluto      raiz autorizada de PDFs (repetível; até ' + MAX_ROOTS + ')',
    '  --cache-dir /caminho/absoluto cache privado das páginas/capturas',
    '  --xournal-helper /caminho     binário do helper de janelas do Xournal++ (opcional)',
    '  --max-image-bytes N           teto do PNG devolvido (padrão ' + DEFAULT_MAX_IMAGE_BYTES + ')',
    '  --tutor-file /caminho.md      perfil TUTOR.md congelado (arquivo regular UTF-8, até ' + MAX_PROFILE_BYTES + ' bytes; opcional)',
    '  --learner-file /caminho.md    perfil LEARNER.md congelado (arquivo regular UTF-8, até ' + MAX_PROFILE_BYTES + ' bytes; opcional)',
    '  --state-file /cache/estado.json  checkpoint de retomada DENTRO do cacheDir (opcional; exige cache)',
    '  --help                        mostra esta ajuda (stderr; stdout é o protocolo)',
    '',
    'Ambiente equivalente: ' + ENV.roots + ' (JSON), ' + ENV.cacheDir + ',',
    '  ' + ENV.xournalHelper + ', ' + ENV.maxImageBytes + ', ' + ENV.tutorFile + ',',
    '  ' + ENV.learnerFile + ' e ' + ENV.stateFile + '.',
  ].join('\n');
}

function startupError(code, message) {
  return new HostError(code, message);
}

function requireAbsolute(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw startupError('STARTUP_INVALID', `Valor ausente para ${field}.`);
  }
  const text = value.trim();
  if (text.length > MAX_PATH_CHARS) {
    throw startupError('STARTUP_INVALID', `${field} excede ${MAX_PATH_CHARS} caracteres.`);
  }
  if (!path.isAbsolute(text)) {
    throw startupError('STARTUP_INVALID', `${field} precisa ser um caminho absoluto: ${text}`);
  }
  return path.resolve(text);
}

function parseRootsFromEnv(env) {
  const raw = env && env[ENV.roots];
  if (raw === undefined || raw === null || raw === '') return {roots: [], source: 'none'};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw startupError('STARTUP_INVALID', `${ENV.roots} precisa ser um JSON de array de caminhos absolutos.`);
  }
  if (!Array.isArray(parsed)) {
    throw startupError('STARTUP_INVALID', `${ENV.roots} precisa ser um JSON de array de caminhos absolutos.`);
  }
  return {roots: parsed, source: 'env'};
}

function parseMaxImageBytes(value, field) {
  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(numeric) || numeric < MIN_MAX_IMAGE_BYTES || numeric > MAX_MAX_IMAGE_BYTES) {
    throw startupError(
      'STARTUP_INVALID',
      `${field} precisa ser um inteiro entre ${MIN_MAX_IMAGE_BYTES} e ${MAX_MAX_IMAGE_BYTES} bytes.`,
    );
  }
  return numeric;
}

function pickInput(flagValue, envValue) {
  if (flagValue !== null) return {input: flagValue, source: 'flag'};
  if (typeof envValue === 'string' && envValue.trim() !== '') return {input: envValue, source: 'env'};
  return {input: null, source: 'none'};
}

/* Perfil de estudo: caminho absoluto e arquivo regular UTF-8 até o teto.
   symlink/não-arquivo/acima do teto/não-UTF8 recusam o startup; inexistente
   é aceito e aparece como indisponível no status/contexto (sem corpo). */
function parseProfileInput({flagValue, envValue, field, envName}) {
  const {input, source} = pickInput(flagValue, envValue);
  if (input === null) return Object.freeze({configured: false, path: null, source: 'none', state: null});
  const absolute = requireAbsolute(input, field);
  const inspection = inspectProfilePathSync(absolute);
  if (inspection.state !== 'ready' && inspection.state !== 'missing') {
    throw startupError(
      'STARTUP_INVALID',
      `${field} (${envName}) precisa apontar para um arquivo markdown UTF-8 regular de até ${MAX_PROFILE_BYTES} bytes; ${profileReason(inspection.state)}`,
    );
  }
  return Object.freeze({configured: true, path: inspection.canonical, source, state: inspection.state});
}

/* Checkpoint: exige cacheDir e um filho DIRETO do cache (canônico), .json.
   Fora do cache/symlink/não-arquivo recusam o startup; inexistente é aceito
   (o primeiro render grava). */
function parseStateFileInput({flagValue, envValue, cacheDir}) {
  const {input, source} = pickInput(flagValue, envValue);
  if (input === null) return null;
  if (!cacheDir) {
    throw startupError(
      'STARTUP_INVALID',
      `${ENV.stateFile}/--state-file exige --cache-dir/MESA_STUDY_CACHE_DIR configurado: o checkpoint mora dentro do cache privado.`,
    );
  }
  const absolute = requireAbsolute(input, 'stateFile');
  const inspection = inspectStatePathSync(absolute, cacheDir);
  if (inspection.state !== 'ready' && inspection.state !== 'missing') {
    throw startupError(
      'STARTUP_INVALID',
      `--state-file (${ENV.stateFile}) inválido: ${stateReason(inspection.state)}`,
    );
  }
  return Object.freeze({configured: true, path: inspection.canonicalState, source});
}

function takeFlagValue(argv, index, flag) {
  const current = argv[index];
  const eq = current.indexOf('=');
  if (eq !== -1) return {value: current.slice(eq + 1), consumed: 0};
  const next = argv[index + 1];
  if (next === undefined) throw startupError('STARTUP_INVALID', `${flag} exige um valor.`);
  return {value: next, consumed: 1};
}

/**
 * Lê argv + ambiente e devolve {help, config}. Lança HostError('STARTUP_INVALID')
 * para qualquer entrada inválida (o processo encerra antes de abrir o stdio).
 */
export function parseStartupConfig({argv = [], env = {}} = {}) {
  const flags = {roots: [], cacheDir: null, xournalHelper: null, maxImageBytes: null, tutorFile: null, learnerFile: null, stateFile: null};
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--root' || arg.startsWith('--root=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--root');
      flags.roots.push(value);
      index += consumed;
      continue;
    }
    if (arg === '--cache-dir' || arg.startsWith('--cache-dir=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--cache-dir');
      flags.cacheDir = value;
      index += consumed;
      continue;
    }
    if (arg === '--xournal-helper' || arg.startsWith('--xournal-helper=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--xournal-helper');
      flags.xournalHelper = value;
      index += consumed;
      continue;
    }
    if (arg === '--max-image-bytes' || arg.startsWith('--max-image-bytes=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--max-image-bytes');
      flags.maxImageBytes = value;
      index += consumed;
      continue;
    }
    if (arg === '--tutor-file' || arg.startsWith('--tutor-file=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--tutor-file');
      flags.tutorFile = value;
      index += consumed;
      continue;
    }
    if (arg === '--learner-file' || arg.startsWith('--learner-file=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--learner-file');
      flags.learnerFile = value;
      index += consumed;
      continue;
    }
    if (arg === '--state-file' || arg.startsWith('--state-file=')) {
      const {value, consumed} = takeFlagValue(argv, index, '--state-file');
      flags.stateFile = value;
      index += consumed;
      continue;
    }
    throw startupError('STARTUP_INVALID', `Argumento desconhecido: ${arg}`);
  }

  if (help) return {help: true, config: null};

  /* Flag vence o ambiente DE VERDADE: com --root explícito o env nem é lido,
     então um MESA_STUDY_ROOTS malformado não derruba o startup por flag. */
  let rootsInput;
  let rootsSource;
  if (flags.roots.length > 0) {
    rootsInput = flags.roots;
    rootsSource = 'flag';
  } else {
    const envRoots = parseRootsFromEnv(env);
    rootsInput = envRoots.roots;
    rootsSource = envRoots.source;
  }
  if (rootsInput.length > MAX_ROOTS) {
    throw startupError('STARTUP_INVALID', `Mais de ${MAX_ROOTS} raízes configuradas.`);
  }
  const seen = new Set();
  const roots = [];
  for (const root of rootsInput) {
    const absolute = requireAbsolute(root, 'root');
    const canonical = canonicalizeFrozenPath(absolute);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    roots.push(canonical);
  }

  const cacheInput = flags.cacheDir !== null
    ? flags.cacheDir
    : env && env[ENV.cacheDir];
  const cacheSource = flags.cacheDir !== null ? 'flag' : (env && env[ENV.cacheDir] ? 'env' : 'none');
  const cacheDir = typeof cacheInput === 'string' && cacheInput.trim() !== ''
    ? requireAbsolute(cacheInput, 'cacheDir')
    : null;

  const helperInput = flags.xournalHelper !== null
    ? flags.xournalHelper
    : env && env[ENV.xournalHelper];
  const helperSource = flags.xournalHelper !== null ? 'flag' : (env && env[ENV.xournalHelper] ? 'env' : 'none');
  const xournalHelper = typeof helperInput === 'string' && helperInput.trim() !== ''
    ? requireAbsolute(helperInput, 'xournalHelper')
    : null;

  const maxInput = flags.maxImageBytes !== null
    ? flags.maxImageBytes
    : env && env[ENV.maxImageBytes];
  const maxImageBytes = maxInput === null || maxInput === undefined || maxInput === ''
    ? DEFAULT_MAX_IMAGE_BYTES
    : parseMaxImageBytes(maxInput, flags.maxImageBytes !== null ? '--max-image-bytes' : ENV.maxImageBytes);

  const config = Object.freeze({
    roots: Object.freeze(roots),
    rootsSource,
    cacheDir,
    cacheSource,
    xournalHelper,
    xournalHelperSource: helperSource,
    maxImageBytes,
    studyProfile: Object.freeze({
      tutor: parseProfileInput({
        flagValue: flags.tutorFile,
        envValue: env && env[ENV.tutorFile],
        field: '--tutor-file',
        envName: ENV.tutorFile,
      }),
      learner: parseProfileInput({
        flagValue: flags.learnerFile,
        envValue: env && env[ENV.learnerFile],
        field: '--learner-file',
        envName: ENV.learnerFile,
      }),
    }),
    stateFile: parseStateFileInput({
      flagValue: flags.stateFile,
      envValue: env && env[ENV.stateFile],
      cacheDir,
    }),
    limits: Object.freeze({
      maxImageBytes,
      maxPdfBytes: MAX_PDF_BYTES,
      maxPage: MAX_PAGE,
      maxRoots: MAX_ROOTS,
      maxProfileBytes: MAX_PROFILE_BYTES,
      maxStateBytes: MAX_STATE_BYTES,
    }),
  });
  return {help: false, config};
}

/* Detecção SOMENTE leitura do Poppler (status). Nunca recebe caminho de
   chamada: resolve os diretórios fixos do host. */
export function detectPoppler({isExecutable = isExecutableFile} = {}) {
  const toolFor = (name) => {
    const candidate = resolvePopplerTool(name, {isExecutable});
    return {path: candidate, executable: !!isExecutable(candidate)};
  };
  const pdfinfo = toolFor('pdfinfo');
  const pdftocairo = toolFor('pdftocairo');
  return {
    available: pdfinfo.executable && pdftocairo.executable,
    dirs: [...POPPLER_DIRS],
    tools: {pdfinfo, pdftocairo},
  };
}
