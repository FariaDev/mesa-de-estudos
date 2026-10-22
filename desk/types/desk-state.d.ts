/* O `desk.json` saneado (`desk-state-sanitize.cjs` → `sanitizeState`), como o
   main o guarda em `live.state` (#43 fase 3). O saneador preserva campos que
   não conhece, então o tipo nomeia os que os arquivos verificados leem e deixa
   o resto como `unknown`. */
export type PdfSlot = {path: string, page: number, zoom: number, [field: string]: unknown};
export type StudyRef = {title?: string, xopp?: string};
export type ConferirChoice = {app: string, key: string};
export type CourseState = {session?: string, sessions?: Array<{path: string, [field: string]: unknown}>,
 sessionStudies?: Record<string, StudyRef>, sessionLayouts?: Record<string, object>, [field: string]: unknown};
export type DeskState = {
 courseId?: string,
 session?: string,
 pdfs?: PdfSlot[],
 study?: StudyRef,
 conferirApp?: ConferirChoice | null,
 uiLanguage?: string,
 tutorLanguage?: string,
 opencodeModel?: string,
 opencodePaidOk?: boolean,
 courseStates?: Record<string, CourseState>,
 modelRecents?: Record<string, Array<[string, string]>>,
 modelFavorites?: Record<string, Array<[string, string]>>,
 pdfModels?: Record<string, {model: string, options: object}>,
 free?: {activeId: string, sessions: Record<string, {nativePath?: string, engine?: string, draft?: string, study?: StudyRef, [field: string]: unknown}>},
 theme?: string,
 accent?: string,
 draft?: string,
 [field: string]: unknown,
};
