/* Fronteira tipada com os artefatos do núcleo Bend (#43 fase 3).

   `src/generated/*.core.js` é gerado e não se edita à mão; o tsc infere cada
   função dele como `(...a: any[]) => any`. Quem chama declara o núcleo com o tipo
   daqui (`/** @type {import('./types/bend-core').ConferirCore} *\/`), e o tsc
   confere que cada chave existe no artefato. As assinaturas copiam as `def` do
   `.bend`: `String` vira string, `Bool` boolean, `U32` number, e um `type X is
   Data` vira a união de objetos com o construtor em `$`.

   Só entram os núcleos que um arquivo verificado (`tsconfig.json`) usa e só as
   chaves que ele chama. */

/** Lista do Bend: `{$:'Con', head, tail}` até `{$:'Nil'}`. */
export type BendList<T> = {$: 'Nil'} | {$: 'Con', head: T, tail: BendList<T>};
/** `Maybe` do Bend. */
export type BendMaybe<T> = {$: 'None'} | {$: 'Some', value: T};

/* ---------- core/conferir.bend ---------- */
export type ConfWin = {$: 'ConfWin', id: string, app: string, key: string, title: string, usable: boolean, self: boolean};
export type ConfChoice = {app: string, key: string};
export type ConfDecision =
 | {$: 'ConfCapture', id: string, app: string, title: string}
 | {$: 'ConfAbsent', app: string, saved: boolean};
export interface ConferirCore {
 decide(xs: BendList<ConfWin>, choice: BendMaybe<ConfChoice>): ConfDecision;
 eligibleWins(xs: BendList<ConfWin>): BendList<ConfWin>;
 displayName(app: string, key: string): string;
 absentLead(app: string, saved: boolean): string;
}

/* ---------- core/language.bend ---------- */
export interface LanguageCore {
 /** Valor guardado → "pt-BR", "en" ou "". */
 storedUi(stored: string): string;
 /** Escolha guardada, ou o idioma do sistema levado a um dos dois. */
 resolveUi(stored: string, system: string): 'pt-BR' | 'en';
 /** Valor guardado do tutor → "follow", "pt-BR" ou "en". */
 tutor(stored: string): 'follow' | 'pt-BR' | 'en';
}

/* ---------- core/toolmentions.bend ---------- */
export type MentionTool = {$: 'MentionTool', id: string, icon: string};
export interface ToolMentionsCore {
 offered(geogebra: boolean): BendList<MentionTool>;
 addId(xs: BendList<string>, id: string): BendList<string>;
 instructionBlock(ids: BendList<string>, lines: BendList<string>): string;
 /** Mensagem marcada (`message(chave)`), que o i18n traduz. */
 instructionMsg(id: string): string;
}

/* ---------- core/phonedrop.bend ---------- */
export type PhoneFlow =
 | {$: 'PhoneOff'} | {$: 'PhoneWaiting'} | {$: 'PhoneNetError'}
 | {$: 'PhoneReceived' | 'PhoneStopped' | 'PhoneExpired', count: number};
export type PhoneFlowEvent = {$: 'EvStart' | 'EvPhoto' | 'EvStop' | 'EvIdle' | 'EvFail'};
export type PhoneRoute = {$: 'PageRoute' | 'UploadRoute' | 'OtherRoute'};
export type PhoneDoor = {$: 'DoorClosed' | 'DoorPage' | 'DoorUpload'};
export type PhoneImageKind = {$: 'KindJpeg' | 'KindPng' | 'KindWebp' | 'KindNotImage'};
export type PhoneVerdict = {$: 'PhotoAccept' | 'PhotoGone' | 'PhotoWrongType' | 'PhotoTooLarge' | 'PhotoFull'};
export interface PhoneDropCore {
 running(flow: PhoneFlow): boolean;
 received(flow: PhoneFlow): number;
 step(flow: PhoneFlow, event: PhoneFlowEvent): PhoneFlow;
 maxFileBytes(): number;
 idleMs(): number;
 door(up: boolean, token: boolean, route: PhoneRoute): PhoneDoor;
 photo(up: boolean, kind: PhoneImageKind, bytes: number, photos: number, total: number): PhoneVerdict;
 verdictStatus(verdict: PhoneVerdict): number;
}
