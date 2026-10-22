/* `window.desk` no renderer: a API que o `preload.cjs` expõe (#43 fase 3). As
   chamadas devolvem o `Promise` do `ipcRenderer.invoke`; o formato da resposta
   é do handler `ipcMain` do canal. */
import type {DeskApi} from '../preload.cjs';

declare global {
 interface Window {desk: DeskApi}
}
export {};
