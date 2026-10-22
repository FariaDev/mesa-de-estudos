'use strict';

/* Aba Livre (Mesa): o workspace de sessão avulsa. Cada conversa livre tem o seu
   próprio diretório isolado, o seu metadata e os seus materiais — PDFs de uma
   sessão nunca aparecem na outra.

   Layout em disco (tudo dentro do runtime da mesa, nada em pasta de curso):

     <runtime>/free/<sessionId>/workspace.json   metadata (título, rascunho,
                                                 materiais, recibo de promoção)
     <runtime>/free/<sessionId>/materials/*.pdf  cópias gerenciadas, nomes únicos

   O núcleo Bend (`core/freeworkspaces.bend`) decide os tetos, o recorte de
   título/rascunho e a SEQUÊNCIA de nomes (`x.pdf`, `x-2.pdf`, …). Aqui ficam o
   I/O, a validação de forma, a gravação atômica e as cópias verificadas.

   Regras que o host garante:
     - id de sessão é opaco mas restrito a [A-Za-z0-9][A-Za-z0-9._-]{0,127} —
       nunca vira caminho fora de `<runtime>/free`;
     - `workspace.json` só é trocado por rename atômico: falha preserva o antigo;
     - JSON ilegível NÃO é sobrescrito (find devolve null; mutação recusa CORRUPT);
     - importação copia bytes verificados e NUNCA toca o original;
     - material importado/gerado já existe no disco antes de entrar no metadata;
       se o metadata falhar, a cópia criada pela operação é removida;
     - promoção só cria pasta NOVA, com staging no mesmo diretório-pai, cópias
       verificadas por sha256 e rollback que nunca apaga conteúdo estranho.

   Exportações (host → main.cjs; o renderer nunca escolhe caminho por conta):

     freeCourseId()/freeCourseName()/defaultTitle()      rótulos reservados
     freeRoot(runtime)                                   <runtime>/free
     workspaceDir(runtime, sessionId)                    diretório da sessão
     createWorkspace(runtime, {sessionId, title})        cria; erro se já existe
     ensureWorkspace(runtime, {sessionId, title})        cria se faltar (idempotente)
     findWorkspace(runtime, sessionId)                   registro ou null
     updateWorkspace(runtime, sessionId, {title, draft, nativePath}, {expectRev})
                                                         grava título/rascunho/caminho nativo
     renameWorkspace(runtime, sessionId, title)          atalho do update
     setNativePath(runtime, sessionId, nativePath, {expectRev})
     listWorkspaces(runtime)                             registros válidos, recentes primeiro
     listSessions(runtime)                               índice host: id, título, nativePath
                                                         (inclusive vazio), promoção, rev
     importPdf(runtime, sessionId, {sourcePath, name})   {material, workspace}
     saveMaterial(runtime, sessionId, {title, markdown, signal, timeoutMs})
                                                         renderiza PDF e registra
     workspacePayload(record)                            forma para o initialData
     folderSlug(name)                                    nome de pasta seguro (prévia)
     captureScope(runtime, sessionId)                    fatia p/ rechecar depois do await
     scopeIsCurrent(runtime, scope) / assertScope(runtime, scope)
     preparePromotion(runtime, sessionId, {parentDir, name})  staging verificado
     commitPromotion(runtime, sessionId, {token, courseId, courseName})
                                                         journal + rename + recibo
     recoverPromotion(runtime, sessionId)                conserta transação interrompida
     recoverAllPromotions(runtime)                       varredura de boot
     rollbackPromotion(runtime, sessionId)               desfaz só o que criou
     promotionPlan(runtime, sessionId)                   recibo/plano atual
     findByCourseId(runtime, courseId)                   dono de uma matéria promovida

   Erros: `FreeWorkspaceError` com `.code` estável (BAD_ID, BAD_RUNTIME, NOT_FOUND,
   EXISTS, CORRUPT, TOO_MANY, BAD_PDF, TOO_BIG, BAD_SOURCE, BAD_PATH, COLLISION,
   PENDING, ALREADY_PROMOTED, NOT_PREPARED, BAD_TOKEN, VERIFY, CONFLICT, STALE,
   OWNED, ROLLBACK) e `.details` opcional. */

const core = require('./src/generated/freeworkspaces.core.js').default;
const {FILENAME, FREE_DIR, FreeWorkspaceError, MATERIALS_DIR, MAX_MATERIAL_BYTES, STAGING_PREFIX, cutDraft, folderSlug, freeRoot, maxDraftChars, maxMaterials, maxName, maxSlug, maxTitle, sanitizeStem, workspaceDir} = require('./free-workspace-record.cjs');
const {assertScope, captureScope, createWorkspace, ensureWorkspace, findByCourseId, findWorkspace, listSessions, listWorkspaces, renameWorkspace, scopeIsCurrent, setNativePath, updateWorkspace} = require('./free-workspace-store.cjs');
const {commitPromotion, preparePromotion, promotionPlan, recoverAllPromotions, recoverPromotion, rollbackPromotion} = require('./free-workspace-promotion.cjs');
const {importPdf, registerMaterial, saveMaterial} = require('./free-workspace-materials.cjs');

/* ---------- formas para o renderer ---------- */

function workspacePayload(record) {
  return {
    kind: 'free',
    id: core.freeCourseId(),
    sessionId: record.id,
    title: record.title,
    ...(record.pdfDraft?{pdfDraft:record.pdfDraft}:{}),
    materials: record.materials.map((material) => ({
      id: material.id,
      name: material.name,
      path: material.path,
      kind: material.kind,
    })),
    promotedCourseId: record.promotion && record.promotion.status === 'promoted' ? record.promotion.courseId : '',
  };
}

module.exports = {
  FreeWorkspaceError,
  FILENAME,
  MATERIALS_DIR,
  FREE_DIR,
  STAGING_PREFIX,
  MAX_MATERIAL_BYTES,
  freeCourseId: () => core.freeCourseId(),
  freeCourseName: () => core.freeCourseName(),
  defaultTitle: () => core.defaultTitle(),
  maxTitle,
  maxName,
  maxDraftChars,
  maxMaterials,
  maxSlug,
  freeRoot,
  workspaceDir,
  createWorkspace,
  ensureWorkspace,
  findWorkspace,
  updateWorkspace,
  renameWorkspace,
  setNativePath,
  listWorkspaces,
  listSessions,
  captureScope,
  scopeIsCurrent,
  assertScope,
  findByCourseId,
  importPdf,
  registerMaterial,
  saveMaterial,
  cutDraft,
  sanitizeStem,
  folderSlug,
  preparePromotion,
  commitPromotion,
  recoverPromotion,
  recoverAllPromotions,
  rollbackPromotion,
  promotionPlan,
  workspacePayload,
};
