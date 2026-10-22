/* Ferramentas MCP da Mesa (handlers puros, sem dependência do SDK).
   Invariantes:
   - roots/cacheDir/helper vêm SOMENTE da configuração congelada na
     inicialização; os schemas só aceitam filePath/page/windowId/action/note e
     campos extras são descartados pelo zod;
   - mesa_page e mesa_capture escrevem no cache privado do host e atualizam o
     estado da sessão SÓ depois do sucesso; erro não devolve imagem antiga;
   - mesa_library só varre as raízes JÁ validadas (identidade congelada) e
     devolve caminhos absolutos autorizados, com `truncated` explícito;
   - mesa_open é o único render tool: inclui status + biblioteca e, com
     filePath, a MESMA página de mesa_page (cache/estado/checagens), sem
     imagem antiga em falha; sem filePath não lê PDF nenhum;
   - nenhuma ferramenta inicia inferência, chamada de modelo, captura de tela
     inteira ou navegação com efeito colateral;
   - o bloco image/png devolve o arquivo COMPLETO dentro do teto de bytes; se
     exceder, IMAGE_TOO_LARGE sem truncar. */

import {z} from 'zod';
import {HostError, errorPayload} from '../host/errors.mjs';
import {pageOperation} from '../host/page.mjs';
import {captureOperation} from '../host/capture.mjs';
import {runProcess} from '../host/proc.mjs';
import {
  MAX_PAGE,
  MAX_PATH_CHARS,
  MAX_PDF_BYTES,
  MAX_ROOTS,
  PNG_RENDER_DPI,
  POPPLER_DIRS,
  SCREENCAPTURE_PATH,
} from '../host/config.mjs';
import {isExecutableFile} from '../host/tools.mjs';
import {detectPoppler, HOST_SNAPSHOT, SERVER_NAME, SERVER_VERSION} from './config.mjs';
import {inspectCacheDir, inspectRoots, rootsForPageOperation} from './checks.mjs';
import {listXournalWindows, resolveHelperPath} from './windows.mjs';
import {readBoundedPng} from './png.mjs';
import {createContextStore, NOTE_MAX} from './state.mjs';
import {LIBRARY_LIMITS, listLibraryPdfs} from './library.mjs';
import {DESK_RESOURCE_URI} from './ui.mjs';
import {MAX_PROFILE_BYTES, PROFILE_ROLES, readProfile} from './profiles.mjs';
import {
  RESUME_PROVENANCE,
  STATE_CONCURRENCY_NOTE,
  clearCheckpoint,
  evaluateCandidate,
  loadCheckpoint,
  saveCheckpoint,
} from './persistence.mjs';

const WINDOW_ID_MAX = 0xffffffff;
const OPEN_DEFAULT_PAGE = 1;
const NO_LIBRARY = Object.freeze({files: Object.freeze([]), truncated: false});

/* O render tool declara o recurso MCP Apps nos DOIS formatos: o padrão
   `_meta.ui.resourceUri` e o alias de compatibilidade `openai/outputTemplate`.
   `visibility` explícita no default do protocolo: o modelo pode abrir o painel
   e o iframe pode chamar a ferramenta. Nenhuma outra tool declara template. */
const DESK_TOOL_META = Object.freeze({
  ui: Object.freeze({resourceUri: DESK_RESOURCE_URI, visibility: Object.freeze(['model', 'app'])}),
  'openai/outputTemplate': DESK_RESOURCE_URI,
});

const READ_ONLY = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});
const CACHE_WRITER = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
});
const DEVICE_WRITER = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
});
const STATE_WRITER = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

const CAPTURE_PROVENANCE =
  'Instrução registrada como pedido explícito de conferência da janela escolhida do Xournal++ (nunca a tela inteira): a chamada deve responder a um pedido explícito da pessoa, mas o servidor não verifica consentimento e não existe parâmetro booleano que finja essa verificação. A imagem devolvida é a captura atual desta chamada, da janela revalidada antes e depois; erro nunca devolve captura antiga.';

function buildGuidance({
  rootsConfigured,
  rootsAvailable: rootsReady,
  cacheConfigured,
  cacheAvailable,
  cacheState,
  helperConfigured,
  helperAvailable,
  platformSupported,
  captureToolPath,
  captureToolAvailable,
  popplerAvailable,
}) {
  const guidance = [];
  if (!rootsConfigured) {
    guidance.push(
      'Nenhuma raiz de PDFs configurada: use --root /caminho/absoluto (repetível) ou MESA_STUDY_ROOTS=\'["/caminho"]\' na inicialização. A leitura de PDF fica recusada até lá.',
    );
  } else if (!rootsReady) {
    guidance.push(
      'As raízes configuradas não estão disponíveis agora (ausentes, substituídas depois do startup ou sem ser diretório): confira os caminhos e reinicie o servidor com --root /caminho/absoluto. Raiz trocada não autoriza o alvo novo.',
    );
  }
  if (!cacheConfigured) {
    guidance.push(
      'cacheDir não configurado: use --cache-dir /caminho/absoluto ou MESA_STUDY_CACHE_DIR (diretório privado; o host cria 0700 no primeiro uso).',
    );
  } else if (!cacheAvailable) {
    guidance.push(
      `cacheDir configurado não está utilizável agora (${cacheState}): use um diretório real e privado (0700) do próprio usuário com --cache-dir /caminho/absoluto ou MESA_STUDY_CACHE_DIR.`,
    );
  }
  if (!helperConfigured) {
    guidance.push(
      'Captura opcional desligada: sem --xournal-helper /caminho/absoluto ou MESA_XOURNAL_HELPER, mesa_windows/mesa_capture recusam; a leitura de PDF continua funcionando.',
    );
  } else if (!helperAvailable) {
    guidance.push(
      'O helper declarado não é um arquivo executável agora: aponte --xournal-helper para o binário do helper de janelas ou remova a configuração; a leitura de PDF continua funcionando.',
    );
  } else if (!platformSupported) {
    guidance.push(
      'Captura de janela indisponível nesta plataforma: o helper/screencapture são do macOS; a leitura de PDF continua funcionando.',
    );
  } else if (!captureToolAvailable) {
    guidance.push(
      `screencapture não foi encontrado/executável em ${captureToolPath}: a captura de janela exige a ferramenta do sistema no macOS.`,
    );
  }
  if (!popplerAvailable) {
    guidance.push(`Poppler não encontrado em ${POPPLER_DIRS.join(', ')}: mesa_page precisa de pdfinfo/pdftocairo.`);
  }
  guidance.push('Raízes, cache e executáveis são fixados na inicialização e não podem ser alterados por chamadas MCP.');
  return guidance;
}

function normalizeWindowId(value) {
  const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > WINDOW_ID_MAX) {
    throw new HostError('CAPTURE_WINDOW_INVALID', `windowId precisa ser um inteiro entre 1 e ${WINDOW_ID_MAX}.`);
  }
  return numeric;
}

export function createToolHandlers({config, deps = {}, log = () => {}} = {}) {
  const store = createContextStore({now: typeof deps.nowDate === 'function' ? deps.nowDate : undefined});
  const poppler = deps.poppler || detectPoppler({isExecutable: deps.isExecutable});
  const maxImageBytes = config.maxImageBytes;
  const isExecutable = typeof deps.isExecutable === 'function' ? deps.isExecutable : isExecutableFile;
  const platform = typeof deps.platform === 'string' ? deps.platform : process.platform;
  const captureToolPath = typeof deps.screencapturePath === 'string' ? deps.screencapturePath : SCREENCAPTURE_PATH;

  const helperConfigured = () => typeof config.xournalHelper === 'string' && config.xournalHelper !== '';

  function assertRootsConfigured() {
    if (config.roots.length === 0) {
      throw new HostError(
        'ROOTS_NOT_CONFIGURED',
        'Nenhuma raiz autorizada foi configurada na inicialização; a leitura de PDF está desativada. Use --root /caminho/absoluto (repetível) ou MESA_STUDY_ROOTS e reinicie o servidor.',
      );
    }
  }

  function assertPdfReady() {
    assertRootsConfigured();
    if (!config.cacheDir) {
      throw new HostError(
        'CACHE_DIR_NOT_CONFIGURED',
        'cacheDir não configurado na inicialização; use --cache-dir /caminho/absoluto ou MESA_STUDY_CACHE_DIR.',
      );
    }
  }

  function assertCacheReady() {
    if (!config.cacheDir) {
      throw new HostError(
        'CACHE_DIR_NOT_CONFIGURED',
        'cacheDir não configurado na inicialização; use --cache-dir /caminho/absoluto ou MESA_STUDY_CACHE_DIR.',
      );
    }
  }

  const stateFilePath = () => (config.stateFile && config.stateFile.configured ? config.stateFile.path : null);
  const stateFileConfigured = () => stateFilePath() !== null;

  function buildProfileGuidance(files) {
    const guidance = [];
    const configuredRoles = PROFILE_ROLES.filter((role) => files[role].configured);
    if (configuredRoles.length === 0) {
      guidance.push(
        'Perfis de estudo opcionais: nenhum --tutor-file/--learner-file (ou MESA_STUDY_TUTOR_FILE/MESA_STUDY_LEARNER_FILE) configurado; mesa_context não expõe texto de perfil.',
      );
      return guidance;
    }
    for (const role of configuredRoles) {
      if (!files[role].available) {
        guidance.push(
          `O perfil ${role} está configurado mas indisponível agora (${files[role].state}): mesa_context mostra o erro e NÃO devolve corpo; confira o arquivo regular e reinicie se ele foi movido/trocado.`,
        );
      }
    }
    return guidance;
  }

  /* Perfis autorizados: status sem corpo (só configurado/disponível/estado/
     erro) e contexto com texto + metadados de origem, sempre relendo e
     revalidando a identidade congelada. */
  async function studyProfileStatus() {
    const files = {};
    for (const role of PROFILE_ROLES) {
      const configured = config.studyProfile[role];
      if (!configured.configured) {
        files[role] = {configured: false, available: false, role, source: 'none', path: null, state: null, error: null};
        continue;
      }
      const profile = await readProfile({
        role,
        filePath: configured.path,
        canonical: configured.path,
        source: configured.source,
      });
      files[role] = {
        configured: true,
        available: profile.available,
        role,
        source: profile.source,
        path: profile.path,
        state: profile.state,
        error: profile.error ?? null,
      };
    }
    return {frozenAtStartup: true, maxBytes: MAX_PROFILE_BYTES, files, guidance: buildProfileGuidance(files)};
  }

  async function studyProfileContext() {
    const files = {};
    for (const role of PROFILE_ROLES) {
      const configured = config.studyProfile[role];
      if (!configured.configured) {
        files[role] = {
          configured: false, available: false, role, source: 'none', path: null, state: null,
          error: null, bytes: null, sha256: null, updatedAt: null, text: null,
        };
        continue;
      }
      const profile = await readProfile({
        role,
        filePath: configured.path,
        canonical: configured.path,
        source: configured.source,
      });
      files[role] = {
        configured: true,
        available: profile.available,
        role,
        source: profile.source,
        path: profile.path ?? configured.path,
        state: profile.state,
        error: profile.error ?? null,
        bytes: profile.bytes ?? null,
        sha256: profile.sha256 ?? null,
        updatedAt: profile.updatedAt ?? null,
        text: profile.text ?? null,
      };
    }
    return files;
  }

  async function loadState() {
    if (!stateFileConfigured()) return {state: 'not-configured', checkpoint: null, error: null};
    /* Mesmo portão privado do descriptor: com cacheDir inseguro (symlink,
       dono/modo errados) o checkpoint NÃO é lido nem vira candidato; o
       descritor explica o motivo sem corpo. */
    const cacheChecks = inspectCacheDir(config.cacheDir);
    if (!cacheChecks.available) {
      return {
        state: 'cache-unavailable',
        checkpoint: null,
        error: {
          code: 'STATE_CACHE_UNAVAILABLE',
          message: `O cacheDir do checkpoint não está utilizável agora (${cacheChecks.state ?? 'não configurado'}).`,
        },
      };
    }
    return loadCheckpoint({stateFile: stateFilePath(), cacheDir: config.cacheDir});
  }

  /* Diagnóstico honesto do checkpoint: configurado × disponível, estado do
     arquivo e resumo SEM corpo (página/nome/tamanho da nota), com a nota de
     concorrência explícita. Nunca cria o cache nem devolve imagem. */
  async function persistenceDescriptor(loaded, operation = null) {
    if (!stateFileConfigured()) {
      return {
        configured: false,
        source: 'none',
        path: null,
        available: false,
        state: null,
        checkpoint: {present: false},
        error: null,
        operation,
        concurrency: STATE_CONCURRENCY_NOTE,
      };
    }
    const base = {
      configured: true,
      source: config.stateFile.source,
      path: stateFilePath(),
      concurrency: STATE_CONCURRENCY_NOTE,
      operation,
    };
    const cacheChecks = inspectCacheDir(config.cacheDir);
    if (!cacheChecks.available) {
      const error =
        loaded.state === 'cache-unavailable' && loaded.error
          ? loaded.error
          : {
              code: 'STATE_CACHE_UNAVAILABLE',
              message: `O cacheDir do checkpoint não está utilizável agora (${cacheChecks.state ?? 'não configurado'}).`,
            };
      return {
        ...base,
        available: false,
        state: 'cache-unavailable',
        checkpoint: {present: false},
        error,
      };
    }
    if (loaded.state === 'ready') {
      const candidate = await evaluateCandidate({checkpoint: loaded.checkpoint, roots: config.roots});
      return {
        ...base,
        available: true,
        state: 'ready',
        checkpoint: {
          present: true,
          savedAt: loaded.checkpoint.updatedAt,
          page: loaded.checkpoint.page ? loaded.checkpoint.page.page : null,
          document: candidate ? candidate.document : null,
          noteBytes: loaded.checkpoint.note ? loaded.checkpoint.note.length : 0,
          resumable: !!(candidate && candidate.available),
          reason: candidate ? candidate.reason : 'no-page',
        },
        error: null,
      };
    }
    if (loaded.state === 'missing') {
      return {...base, available: true, state: 'missing', checkpoint: {present: false}, error: null};
    }
    return {...base, available: false, state: loaded.state, checkpoint: {present: false}, error: loaded.error ?? null};
  }

  /* Candidato de retomada: SÓ referência validada contra as raízes congeladas
     atuais. Nunca entra em context.page, nunca devolve imagem/captura; erro
     é explícito (available:false + reason/error) em vez de fallback. */
  async function currentResumeCandidate(loaded) {
    if (!stateFileConfigured()) return null;
    if (loaded.state === 'missing') return null;
    if (loaded.state !== 'ready') {
      return {state: loaded.state, available: false, reason: loaded.state, error: loaded.error ?? null, provenance: RESUME_PROVENANCE};
    }
    const candidate = await evaluateCandidate({checkpoint: loaded.checkpoint, roots: config.roots});
    if (!candidate) return null;
    return {state: 'ready', ...candidate};
  }

  /* Persistência NUNCA derruba uma operação que deu certo: falha vira
     saved:false + erro (nunca "salvo" mentiroso); sem state-file configurado
     nada é gravado (saved:null). A leitura do checkpoint existente passa pelo
     mesmo portão de cache do diagnóstico (cache inseguro não é lido). */
  async function persistActiveCheckpoint() {
    if (!stateFileConfigured()) return {configured: false, saved: null, error: null};
    try {
      const current = store.snapshot();
      let page = null;
      if (current.page && current.page.document && typeof current.page.document.path === 'string') {
        page = {path: current.page.document.path, page: current.page.page};
      }
      let note = current.note;
      /* Após reiniciar, uma anotação nova não apaga a página do candidato e um
         render explícito do MESMO documento+página não apaga a nota guardada:
         o checkpoint existente (ainda válido) preserva a referência até um
         novo mesa_page acontecer. Outro documento/página NÃO herda a nota.
         Só precisa ler o checkpoint existente quando falta a página ativa ou
         quando a nota do processo é nula (para essa fusão). */
      if (!page || note === null) {
        const existing = await loadState();
        const stored = existing.state === 'ready' ? existing.checkpoint : null;
        if (stored) {
          if (!page && stored.page) page = stored.page;
          if (
            note === null &&
            stored.note !== null &&
            page &&
            stored.page &&
            stored.page.path === page.path &&
            stored.page.page === page.page
          ) {
            note = stored.note;
          }
        }
      }
      const saved = await saveCheckpoint({
        stateFile: stateFilePath(),
        cacheDir: config.cacheDir,
        page,
        note,
      });
      return {configured: true, saved: true, path: saved.path, savedAt: saved.savedAt, error: null};
    } catch (error) {
      const payload = errorPayload(error);
      log(`checkpoint não gravado (${payload.error.code})`);
      return {configured: true, saved: false, path: stateFilePath(), savedAt: null, error: payload.error};
    }
  }

  async function clearStoredCheckpoint() {
    if (!stateFileConfigured()) return {configured: false, cleared: null, error: null};
    try {
      const result = await clearCheckpoint({stateFile: stateFilePath(), cacheDir: config.cacheDir});
      return {configured: true, cleared: true, removed: result.removed, path: stateFilePath(), error: null};
    } catch (error) {
      const payload = errorPayload(error);
      log(`checkpoint não removido (${payload.error.code})`);
      return {configured: true, cleared: false, removed: false, path: stateFilePath(), error: payload.error};
    }
  }

  /* Status: CONFIGURADO (o que o startup aceitou) é diferente de DISPONÍVEL
     (o que verifica de verdade agora, somente leitura). ready.* só é true
     quando a operação correspondente pode funcionar neste momento; a captura
     também exige macOS e o screencapture do sistema. Nada aqui muta o cache.
     Perfis/checkpoint entram como diagnósticos SEM corpo. */
  async function status() {
    const rootsConfigured = config.roots.length > 0;
    const rootChecks = inspectRoots(config.roots);
    const rootsReady = rootsConfigured && rootChecks.valid.length > 0;
    const cacheConfigured = typeof config.cacheDir === 'string' && config.cacheDir !== '';
    const cacheChecks = inspectCacheDir(config.cacheDir);
    const cacheReady = cacheConfigured && cacheChecks.available;
    const helperIsConfigured = helperConfigured();
    const helperAvailable = helperIsConfigured && isExecutable(config.xournalHelper);
    const platformSupported = platform === 'darwin';
    const captureToolAvailable = platformSupported && isExecutable(captureToolPath);
    const studyProfile = await studyProfileStatus();
    const persistence = await persistenceDescriptor(await loadState());
    const meta = {
      ok: true,
      kind: 'status',
      server: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: 'stdio',
        snapshot: HOST_SNAPSHOT,
      },
      setup: {
        frozenAtStartup: true,
        roots: {
          configured: rootsConfigured,
          source: config.rootsSource,
          count: config.roots.length,
          paths: [...config.roots],
          available: rootsReady,
          checks: {
            valid: rootChecks.valid.length,
            missing: rootChecks.missing.length,
            changed: rootChecks.changed.length,
            notDirectory: rootChecks.notDirectory.length,
          },
        },
        cacheDir: {
          configured: cacheConfigured,
          source: config.cacheSource,
          path: config.cacheDir,
          available: cacheReady,
          state: cacheChecks.state,
        },
        xournalHelper: {
          configured: helperIsConfigured,
          source: config.xournalHelperSource,
          path: config.xournalHelper,
          available: helperAvailable,
        },
        capture: {
          platform,
          platformSupported,
          tool: {path: captureToolPath, available: captureToolAvailable},
        },
        poppler: {
          available: poppler.available,
          dirs: poppler.dirs,
          tools: poppler.tools,
        },
      },
      ready: {
        pdf: rootsReady && cacheReady && poppler.available,
        windows: helperAvailable,
        capture: helperAvailable && cacheReady && platformSupported && captureToolAvailable,
      },
      studyProfile,
      persistence,
      limits: {
        maxImageBytes,
        maxPdfBytes: MAX_PDF_BYTES,
        maxPage: MAX_PAGE,
        maxRoots: MAX_ROOTS,
      },
      guidance: buildGuidance({
        rootsConfigured,
        rootsAvailable: rootsReady,
        cacheConfigured,
        cacheAvailable: cacheReady,
        cacheState: cacheChecks.state,
        helperConfigured: helperIsConfigured,
        helperAvailable,
        platformSupported,
        captureToolPath,
        captureToolAvailable,
        popplerAvailable: poppler.available,
      }),
    };
    return {meta};
  }

  async function page(args) {
    assertPdfReady();
    /* Identidade congelada: só raízes que ainda resolvem para o canônico do
       startup são repassadas ao host; a que virou symlink para outro alvo
       falha ROOT_CHANGED (e arquivo vira ROOT_NOT_DIRECTORY). */
    const roots = rootsForPageOperation(config.roots);
    const result = await pageOperation(
      {
        op: 'page',
        path: args.filePath,
        page: args.page,
        roots,
        cacheDir: config.cacheDir,
      },
      {
        run: deps.run,
        isExecutable: deps.isExecutable,
        now: typeof deps.nowMs === 'function' ? deps.nowMs : undefined,
        tools: deps.pageTools,
      },
    );
    const png = await readBoundedPng(result.snapshotPath, {maxBytes: maxImageBytes, cacheDir: config.cacheDir});
    const meta = {
      ok: true,
      kind: 'page',
      source: {
        type: 'pdf',
        document: {name: result.document.name, path: result.document.path},
        page: result.page,
        numPages: result.numPages,
      },
      image: {
        mimeType: 'image/png',
        bytes: png.bytes,
        width: png.width,
        height: png.height,
        sha256: png.sha256,
        renderDpi: PNG_RENDER_DPI,
        snapshotPath: png.path,
      },
      preview: {
        vectorSvgInResponse: false,
        warning: result.previewWarning || null,
      },
      context: {updated: true, scope: 'process', persistence: null},
      provenance:
        'Página renderizada localmente por pdftocairo (Poppler) a partir do PDF somente-leitura autorizado. O bloco image/png desta resposta é o arquivo privado do cache; esta chamada não captura a tela nem inicia inferência.',
    };
    store.setPage({
      document: {name: result.document.name, path: result.document.path},
      page: result.page,
      numPages: result.numPages,
      snapshotPath: png.path,
      vectorPreviewOmitted: result.previewWarning !== undefined,
    });
    /* Persistência opt-in do checkpoint: só referência (path/página/nota).
       Falha aqui NÃO vira falha do render; o meta diz saved:false + erro. */
    meta.context.persistence = await persistActiveCheckpoint();
    log('page ok');
    return {image: {data: png.base64, mimeType: 'image/png'}, meta};
  }

  /* Conta as raízes congeladas que uma varredura NÃO conseguiu cobrir
     (ausentes, trocadas ou que viraram arquivo). Elas não autorizam nada, mas
     deixam a listagem incompleta: a honestidade do `truncated` exige contá-las
     quando há ao menos uma raiz válida. */
  function skippedRootCount(state) {
    return state.missing.length + state.changed.length + state.notDirectory.length;
  }

  /* Biblioteca: varredura limitada em FLUXO das raízes JÁ validadas (mesma
     identidade congelada que a página autoriza). Somente leitura: não escreve
     cache, estado ou qualquer arquivo; `truncated` diz que a lista pode estar
     incompleta — inclusive quando uma raiz configurada foi pulada (ausente,
     trocada ou arquivo) e outra continua válida. Sem raiz válida, mantém a
     recusa específica (ROOT_CHANGED/ROOT_NOT_DIRECTORY/ROOT_NOT_FOUND). */
  async function library() {
    assertRootsConfigured();
    const state = inspectRoots(config.roots);
    if (state.valid.length === 0) {
      rootsForPageOperation(config.roots); // lança o erro específico da recusa
    }
    const skipped = skippedRootCount(state);
    const found = await listLibraryPdfs({roots: state.valid, limits: LIBRARY_LIMITS});
    return {
      meta: {ok: true, kind: 'library', files: found.files, truncated: found.truncated || skipped > 0},
    };
  }

  /* Snapshot tolerante para o painel: raízes ausentes/trocadas não derrubam o
     mesa_open — a biblioteca volta vazia e o status incluído explica o motivo
     (checks.missing/changed/notDirectory). Com raiz válida E raiz pulada, a
     biblioteca continua sendo o subconjunto alcançável, com truncated:true.
     Como aqui não veio filePath, nenhum PDF é lido. */
  async function librarySnapshot() {
    if (config.roots.length === 0) return NO_LIBRARY;
    const state = inspectRoots(config.roots);
    if (state.valid.length === 0) return NO_LIBRARY;
    const skipped = skippedRootCount(state);
    const found = await listLibraryPdfs({roots: state.valid, limits: LIBRARY_LIMITS});
    return {files: found.files, truncated: found.truncated || skipped > 0};
  }

  /* Render tool do painel MCP Apps (único com template). Inclui o status
     completo e a biblioteca; com filePath, renderiza a MESMA página de
     mesa_page (mesmas checagens, mesmo cache/estado) e devolve a imagem
     completa. Sem filePath, não lê PDF algum e page fica null. Falha nunca
     devolve imagem antiga (o resultado é erro, sem structuredContent). */
  async function open(args) {
    const libraryData = await librarySnapshot();
    let pageMeta = null;
    let image = null;
    if (args.filePath !== undefined) {
      const pageArg = args.page === undefined ? OPEN_DEFAULT_PAGE : args.page;
      const rendered = await page({filePath: args.filePath, page: pageArg});
      image = rendered.image;
      pageMeta = rendered.meta;
    } else if (args.page !== undefined) {
      throw new HostError(
        'OPEN_INVALID',
        'page só pode ser informado junto com filePath; sem documento não há página para renderizar. Chame mesa_library para escolher um PDF.',
      );
    }
    return {
      image,
      meta: {ok: true, kind: 'desk', status: (await status()).meta, library: libraryData, page: pageMeta},
    };
  }

  async function windows() {
    const helperPath = resolveHelperPath(config);
    const list = await listXournalWindows({run: deps.run || runProcess, helperPath});
    return {
      meta: {
        ok: true,
        kind: 'windows',
        helper: {configured: true, source: config.xournalHelperSource, path: helperPath},
        windows: list,
        count: list.length,
        provenance:
          'Listagem somente leitura das janelas visíveis do Xournal++ via helper declarado. Nenhuma captura foi feita por esta chamada.',
      },
    };
  }

  async function capture(args) {
    const windowId = normalizeWindowId(args.windowId);
    assertCacheReady();
    const helperPath = resolveHelperPath(config);
    const result = await captureOperation(
      {op: 'capture', cacheDir: config.cacheDir, windowId},
      {
        run: deps.run,
        helperPath,
        screencapturePath: deps.screencapturePath,
        now: typeof deps.nowDate === 'function' ? deps.nowDate : undefined,
      },
    );
    const png = await readBoundedPng(result.snapshotPath, {maxBytes: maxImageBytes, cacheDir: config.cacheDir});
    const meta = {
      ok: true,
      kind: 'capture',
      source: {
        type: 'xournal-window',
        window: result.window,
        capturedAt: result.capturedAt,
      },
      image: {
        mimeType: 'image/png',
        bytes: png.bytes,
        width: png.width,
        height: png.height,
        sha256: png.sha256,
        snapshotPath: png.path,
      },
      context: {updated: true, scope: 'process'},
      provenance: CAPTURE_PROVENANCE,
    };
    store.setCapture({
      window: result.window,
      capturedAt: result.capturedAt,
      snapshotPath: png.path,
    });
    log('capture ok');
    return {image: {data: png.base64, mimeType: 'image/png'}, meta};
  }

  /* Contexto da sessão + perfis de estudo + candidato de retomada. O
     checkpoint (quando configurado) só guarda referência pequena; nada é
     restaurado automaticamente e nenhuma imagem/captura permanece. */
  async function context(args) {
    const action = args.action || 'get';
    let operation = null;
    if (action === 'set') {
      if (typeof args.note !== 'string' || args.note.trim() === '') {
        throw new HostError('CONTEXT_INVALID', 'Para action=set, envie note com o texto curto da questão/anotação ativa.');
      }
      store.setNote(args.note);
      operation = {action: 'set', ...(await persistActiveCheckpoint())};
    } else if (action === 'clear') {
      store.clear();
      /* clear apaga SÓ o checkpoint explicitamente; o resto do cache não é tocado. */
      operation = {action: 'clear', ...(await clearStoredCheckpoint())};
    }
    const loaded = await loadState();
    return {
      meta: {
        ok: true,
        kind: 'context',
        action,
        context: store.snapshot(),
        studyProfile: await studyProfileContext(),
        resumeCandidate: await currentResumeCandidate(loaded),
        persistence: await persistenceDescriptor(loaded, operation),
      },
    };
  }

  return {status, open, library, page, windows, capture, context, store, poppler};
}

export const TOOL_DEFS = Object.freeze([
  Object.freeze({
    name: 'mesa_status',
    handler: 'status',
    title: 'Estado e setup da Mesa',
    description:
      'Estado do servidor Mesa: o que foi configurado na inicialização (raízes, cache, helper do Xournal++, Poppler, perfis de estudo e checkpoint) e o que está disponível agora segundo verificações somente leitura; distingue configurado de disponível e traz o guia de setup. Perfis e checkpoint aparecem como diagnóstico SEM corpo (nunca texto de perfil, imagem ou captura). Somente leitura; chamadas MCP não alteram a configuração e o status não cria o cache.',
    inputSchema: {},
    annotations: READ_ONLY,
  }),
  Object.freeze({
    name: 'mesa_open',
    handler: 'open',
    title: 'Abrir a Mesa visual (painel MCP Apps)',
    description:
      'Abre o painel visual da Mesa (recurso MCP Apps ui://mesa-study/desk-v1.html) com o status do servidor e a biblioteca de PDFs autorizados. Com filePath, renderiza também a página pedida (padrão 1 quando omitida) e devolve o PNG completo como bloco image/png, com as mesmas checagens de mesa_page; erro nunca devolve imagem antiga. É o ÚNICO render tool: mesa_page continua uma operação de dados e não abre painel. Não captura a tela nem inicia inferência.',
    inputSchema: {
      filePath: z.string().min(1).max(MAX_PATH_CHARS).optional().describe('Caminho absoluto do PDF dentro de uma raiz autorizada; omitido abre só o painel com a biblioteca.'),
      page: z.number().int().min(1).max(MAX_PAGE).optional().describe('Número da página (padrão 1) quando filePath for informado.'),
    },
    annotations: CACHE_WRITER,
    _meta: DESK_TOOL_META,
  }),
  Object.freeze({
    name: 'mesa_library',
    handler: 'library',
    title: 'Biblioteca de PDFs autorizados',
    description:
      'Lista somente os PDFs dentro das raízes congeladas na inicialização, com varredura em fluxo limitada de verdade (até 200 arquivos, teto de entradas examinadas e profundidade finita) e saída ordenada. Entradas ocultas/internas (prefixo . ou _) e symlinks são puladas; truncated=true quando um limite, falha de leitura ou raiz configurada pulada (ausente/trocada/arquivo) deixa a listagem incompleta — nesse caso o subconjunto depende da ordem do sistema de arquivos, não prometendo os N primeiros nomes. Somente leitura: não abre PDF, não escreve cache nem estado e nenhuma chamada amplia as raízes.',
    inputSchema: {},
    annotations: READ_ONLY,
  }),
  Object.freeze({
    name: 'mesa_page',
    handler: 'page',
    title: 'Página de PDF (Poppler)',
    description:
      'Lê UMA página de um PDF dentro das raízes autorizadas e devolve o PNG renderizado por Poppler como bloco image/png + metadados de origem. Escreve o PNG no cache privado e atualiza o estado da sessão apenas no sucesso. Não captura a tela nem inicia inferência.',
    inputSchema: {
      filePath: z.string().min(1).max(MAX_PATH_CHARS).describe('Caminho absoluto do PDF dentro de uma raiz autorizada.'),
      page: z.number().int().min(1).max(MAX_PAGE).describe('Número da página (1..n).'),
    },
    annotations: CACHE_WRITER,
  }),
  Object.freeze({
    name: 'mesa_windows',
    handler: 'windows',
    title: 'Janelas do Xournal++ (sem capturar)',
    description:
      'Lista as janelas visíveis do Xournal++ pelo helper declarado na inicialização. Não captura nada; use mesa_capture com o windowId escolhido para conferir uma janela específica.',
    inputSchema: {},
    annotations: READ_ONLY,
  }),
  Object.freeze({
    name: 'mesa_capture',
    handler: 'capture',
    title: 'Capturar janela escolhida do Xournal++',
    description:
      'Captura SOMENTE a janela escolhida do Xournal++ (nunca a tela inteira) e devolve um bloco image/png. Use diante de um pedido explícito de conferência daquela janela: a chamada registra a proveniência da instrução, mas o servidor não verifica consentimento e não existe parâmetro booleano de confirmação. O windowId é obrigatório e a janela é revalidada antes e depois da captura; erro nunca devolve captura antiga.',
    inputSchema: {
      windowId: z
        .union([z.number().int(), z.string().regex(/^\d{1,10}$/)])
        .describe('ID da janela do Xournal++ obtido com mesa_windows.'),
    },
    annotations: DEVICE_WRITER,
  }),
  Object.freeze({
    name: 'mesa_context',
    handler: 'context',
    title: 'Contexto da sessão (memória do processo)',
    description:
      'Guarda/retorna o estado pequeno desta sessão: último PDF/página renderizados com sucesso, a última captura bem-sucedida (uma falha não substitui nem reaproveita a anterior) e a anotação/questão ativa. action=get lê, action=set exige note, action=clear apaga. Com --tutor-file/--learner-file congelados, get expõe studyProfile com texto e metadados SÓ desses arquivos autorizados. Com --state-file, set grava e clear apaga um checkpoint pequeno (PDF/página/nota; nunca imagem/captura) e get devolve resumeCandidate: nenhuma página/captura é restaurada automaticamente e a retomada exige um novo mesa_page.',
    inputSchema: {
      action: z.enum(['get', 'set', 'clear']).optional().describe('get (padrão), set (com note) ou clear.'),
      note: z.string().min(1).max(NOTE_MAX).optional().describe('Questão/anotação ativa quando action=set.'),
    },
    annotations: STATE_WRITER,
  }),
]);
