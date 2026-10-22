/* Ponto de importação única para os testes do root (e para quem consumir o
   host como biblioteca). O CLI continua sendo `host/cli.mjs`. */

export {dispatch, OPS} from './operations.mjs';
export {pageOperation, parsePdfInfo, pdfInfoError, previewWarningFor, PAGE_LIMITS} from './page.mjs';
export {
  captureOperation,
  defaultHelperPath,
  isXournalWindow,
  isValidWindowId,
  sameWindowIdentity,
  selectXournalWindow,
  svgPreviewForPng,
  pngSize,
} from './capture.mjs';
export {resolvePopplerTool, resolvePopplerTools, isExecutableFile} from './tools.mjs';
export {resolveAuthorizedFile, isInsideRoot, readHeader} from './paths.mjs';
export {
  ensureCacheDir,
  createOutputDir,
  removeOwnOutputDir,
  pruneOwnOutputs,
  isValidOutputMarker,
} from './output.mjs';
export {runProcess, fakeResult} from './proc.mjs';
export {runCli, parseRequest} from './cli.mjs';
export {HostError, hostError, errorPayload} from './errors.mjs';
export * as config from './config.mjs';
