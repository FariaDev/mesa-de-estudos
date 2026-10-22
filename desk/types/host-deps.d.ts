/* Peças que os `*-host.cjs` recebem do main por parâmetro (#43 fase 3). Cada
   host declara as próprias dependências no JSDoc da fábrica; o que se repete
   entre eles mora aqui. */
import type {IpcMain, IpcMainInvokeEvent, BrowserWindow, Dialog} from 'electron';

export type {IpcMain, IpcMainInvokeEvent, BrowserWindow, Dialog};

/** O canal só atende a janela principal (`trustedMainSender` do main). */
export type AllowSender = (event: IpcMainInvokeEvent) => boolean;
/** Nível e campos extras de uma linha do `desk.log` (`src/log-entry.mjs`); campo só primitivo. */
export type LogExtra = {level?: 'debug' | 'info' | 'warn' | 'error', [field: string]: string | number | boolean | null | undefined};
/** Uma linha no `desk.log`: área, frase e campos, nunca conteúdo de sessão. */
export type AppendLog = (scope: string, line: string, extra?: LogExtra) => void;
/** Trava de mutação: roda `fn` com as trocas de sessão bloqueadas. */
export type Mutate = <T>(label: string, fn: () => T) => T | Promise<Awaited<T>>;
/** Texto da interface no idioma atual (`t` do i18n). */
export type Translate = (key: string, args?: Record<string, string | number>) => string;
/** Conversa onde um PDF do tutor ou a prévia nasceu; muda de conversa, o trabalho é recusado. */
export type MaterialScope = {courseId: string, session: string, freeSessionId: string};
