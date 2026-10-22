/* O que cada host do main devolve (#43 fase 3), para outro host declarar a
   função que recebe dele sem copiar a assinatura: `engine:
   import('./types/main-hosts').TutorEngineHost['engine']`. A fonte continua
   sendo a fábrica; o tipo é o `ReturnType` dela. */
export type TutorEngineHost = ReturnType<typeof import('../tutor-engine-host.cjs').createTutorEngineHost>;
export type TutorBridgeHost = ReturnType<typeof import('../tutor-bridge-host.cjs').createTutorBridgeHost>;
export type CourseStateHost = ReturnType<typeof import('../course-state-host.cjs').createCourseStateHost>;
export type FreeSessionHost = ReturnType<typeof import('../free-session-host.cjs').createFreeSessionHost>;
export type DeskGuards = ReturnType<typeof import('../desk-guards-host.cjs').createDeskGuards>;
export type PromptImages = ReturnType<typeof import('../prompt-images.cjs').createPromptImages>;
export type GgbCache = ReturnType<typeof import('../ggb-cache.cjs').createGgbCache>;
export type GeogebraHost = ReturnType<typeof import('../geogebra-host.cjs').createGeogebraHost>;
