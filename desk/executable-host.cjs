/* Executáveis das Configurações (#83): o caminho do Pi, do Claude Code e do
   Xournal++ muda só por um diálogo aberto pelo main (`pick-executable`) ou
   pela detecção do main (`detect-pi`). O `save-config` chega do renderer, então
   nesses três campos ele aceita só: o valor salvo, vazio (volta ao automático)
   ou um caminho que o main entregou nesta sessão. O resto é ignorado e o salvo
   continua. O `config.json` segue editável à mão: é lido na partida, e quem
   grava é o `save-config` com o que ele já aceitou. */

const KINDS = Object.freeze({pi: 'piPath', claude: 'claudePath', xournal: 'xournalPath'});
const FIELDS = Object.freeze(Object.values(KINDS));
const TITLE_KEYS = Object.freeze({
  pi: 'settings.pickExecutable.pi',
  claude: 'settings.pickExecutable.claude',
  xournal: 'settings.pickExecutable.xournal',
});

/**
 * Registra `pick-executable` e devolve o que o `save-config` e o `detect-pi` usam.
 * `win` é acessor (o main reatribui a janela); `message` é o do `i18n.mjs`
 * (vira frase no renderer) e `t` devolve o texto pronto para o título do diálogo
 * nativo, que não passa pelo renderer.
 * @param {{ipcMain: {handle: Function}, dialog: {showOpenDialog: Function}, win: () => any,
 *   message: (key: string, args?: object) => string, t: (key: string) => string,
 *   log?: (area: string, line: string) => void}} deps
 * @returns {{remember: (field: string, value: string) => string,
 *   keepSaved: <T extends object>(incoming: T, saved: Record<string, any>) => T}}
 * @example const executables = registerExecutableHost({ipcMain, dialog, win: () => win, message, t});
 */
function registerExecutableHost({ipcMain, dialog, win, message, t, log = () => {}}) {
  /* Caminhos que o main entregou, por campo: só eles (e o vazio) passam no salvar. */
  const handed = new Map(FIELDS.map((field) => [field, new Set()]));

  /** Guarda o que o main entregou (diálogo ou detecção) e devolve o mesmo valor. */
  function remember(field, value) {
    if (typeof value === 'string' && value) handed.get(field).add(value);
    return value;
  }

  /** Valor de um campo que o renderer mandou: vazio, o salvo, ou entregue pelo main. */
  function keepValue(field, value, saved) {
    if (typeof value === 'string' && (value === '' || value === saved || handed.get(field).has(value))) return value;
    log('config', `${field} ignorado: o caminho muda só pelo botão Escolher ou Detectar`);
    return saved;
  }

  ipcMain.handle('pick-executable', async (_event, kind) => {
    if (!Object.hasOwn(KINDS, kind)) throw Error(message('err.executable.kind', {kind: String(kind)}));
    const result = await dialog.showOpenDialog(win(), {title: t(TITLE_KEYS[kind]), properties: ['openFile']});
    return result.canceled ? null : remember(KINDS[kind], result.filePaths[0]);
  });

  /**
   * Troca os três campos de executável do que chegou pelo que vale; os outros campos seguem como vieram.
   * @template {object} T
   * @param {T} incoming configuração normalizada que o renderer mandou
   * @param {Record<string, any>} saved configuração salva em memória
   * @returns {T} `incoming` com os três caminhos aceitos
   * @example keepSaved({xournalPath: '/tmp/x'}, {xournalPath: '/Apps/Xournal++'}).xournalPath // '/Apps/Xournal++'
   */
  function keepSaved(incoming, saved) {
    const next = {...incoming};
    for (const field of FIELDS) next[field] = keepValue(field, incoming[field], saved[field]);
    return next;
  }

  return {remember, keepSaved};
}

module.exports = {registerExecutableHost};
