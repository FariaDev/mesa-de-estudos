/* Superfície pública estável do servidor (para testes, empacotamento e
   consumidores). O executável continua sendo server/main.mjs. */

export {
  SERVER_NAME,
  SERVER_VERSION,
  HOST_SNAPSHOT,
  DEFAULT_MAX_IMAGE_BYTES,
  MIN_MAX_IMAGE_BYTES,
  MAX_MAX_IMAGE_BYTES,
  ENV,
  usageText,
  parseStartupConfig,
  detectPoppler,
} from './config.mjs';
export {createToolHandlers, TOOL_DEFS} from './tools.mjs';
export {createMcpServer} from './server.mjs';
export {main, startStdio, isMainEntry} from './main.mjs';
export {createContextStore} from './state.mjs';
export {MAX_PROFILE_BYTES, PROFILE_ROLES, inspectProfilePathSync, readProfile} from './profiles.mjs';
export {
  MAX_STATE_BYTES,
  STATE_CONCURRENCY_NOTE,
  STATE_KIND,
  STATE_VERSION,
  clearCheckpoint,
  evaluateCandidate,
  inspectStatePathSync,
  loadCheckpoint,
  saveCheckpoint,
} from './persistence.mjs';
export {readBoundedPng} from './png.mjs';
export {listXournalWindows, resolveHelperPath, HELPER_GUIDANCE} from './windows.mjs';
