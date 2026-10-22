// @ts-check
/* Formato do `desk.log` (#43 fase 3): uma linha JSON por entrada,
   `{ts, level, area, msg, ...campos}`, para máquina ler, e um leitor que vira
   texto para gente ler no "Ver o log" do Sobre. Uma fonte só para o main
   (`desk-log.cjs`) e para o worker do updater (`updater-core.cjs`), que
   escrevem no mesmo arquivo. Sem fs: quem grava e quem abre ficam com o I/O.

   O log não leva conteúdo de sessão, material nem credencial: quem chama passa
   área e frase curta; campo só aceita valor primitivo e curto, e o que parece
   chave de API ou token sai mascarado mesmo que escape de quem chama. */

/** @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel */
/** @typedef {string | number | boolean | null} LogFieldValue */
/** @typedef {{ts: string, level: LogLevel, area: string, msg: string, [field: string]: LogFieldValue}} LogEntry */

/** @type {readonly LogLevel[]} */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const MAX_MSG = 4000;
const MAX_FIELD_TEXT = 400;
const MAX_FIELDS = 12;
const RESERVED = new Set(['ts', 'level', 'area', 'msg']);
/* `sk-…` (Anthropic/OpenAI), `Bearer …` e `chave=valor` de nomes de segredo. */
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(api[_-]?key|token|password|senha|secret)(["']?\s*[:=]\s*["']?)[^\s"',;&]{4,}/gi,
];

/**
 * Troca o que parece segredo por `[oculto]`.
 * @param {string} text
 * @returns {string}
 * @example redactSecrets('falhou com sk-ant-abcdefghijklmnop123') // 'falhou com [oculto]'
 */
export function redactSecrets(text) {
  return SECRET_PATTERNS.reduce(
    /* Sem grupo, o 2º argumento do replace é o offset (número): só o padrão `nome=valor` mantém o nome. */
    (out, pattern) => out.replace(pattern, (_whole, name, sep) => (typeof name === 'string' ? `${name}${sep}[oculto]` : '[oculto]')),
    text,
  );
}

/** @param {unknown} value @returns {LogFieldValue | undefined} */
function fieldValue(value) {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string') return redactSecrets(value.slice(0, MAX_FIELD_TEXT));
  return undefined;
}

/** @param {Record<string, unknown>} fields @returns {Record<string, LogFieldValue>} */
function cleanFields(fields) {
  /** @type {Record<string, LogFieldValue>} */
  const out = {};
  for (const [name, raw] of Object.entries(fields).slice(0, MAX_FIELDS)) {
    const value = fieldValue(raw);
    if (!RESERVED.has(name) && value !== undefined) out[name] = value;
  }
  return out;
}

/**
 * Uma linha do `desk.log`, já com o `\n`; texto vazio vira `''` (nada a gravar).
 * Nível desconhecido vira `info`: o log nunca lança em quem o chama.
 * @param {{area: string, msg: unknown, level?: string, fields?: Record<string, unknown>, now?: Date}} entry
 * @returns {string}
 * @example logEntryLine({area: 'update', msg: 'concluído', fields: {version: '0.5.1'}})
 */
export function logEntryLine({area, msg, level = 'info', fields = {}, now = new Date()}) {
  const text = redactSecrets(String(msg ?? '').replace(/\s+$/, '').slice(0, MAX_MSG));
  if (!text) return '';
  const known = /** @type {readonly string[]} */ (LOG_LEVELS).includes(level) ? level : 'info';
  return `${JSON.stringify({ts: now.toISOString(), level: known, area: String(area || '-'), msg: text, ...cleanFields(fields)})}\n`;
}

/**
 * Lê uma linha do `desk.log`. Aceita o formato antigo `{t, src, line}` (#41) e
 * texto solto, para o leitor não perder o que já estava no arquivo.
 * @param {string} line
 * @returns {LogEntry | null} `null` para linha vazia
 * @example parseLogLine('{"t":"2026-01-01T00:00:00.000Z","src":"update","line":"ok"}').area // 'update'
 */
export function parseLogLine(line) {
  const raw = line.trim();
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return {ts: '', level: 'info', area: '-', msg: raw}; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {ts: '', level: 'info', area: '-', msg: raw};
  if ('msg' in parsed) return parsed;
  const {t = '', src = '-', line: legacy = '', ...rest} = parsed;
  return {...rest, ts: String(t), level: 'info', area: String(src), msg: String(legacy)};
}

/**
 * A entrada em texto para gente: data, nível, área, frase e os campos.
 * @param {LogEntry} entry
 * @returns {string}
 * @example readableLogLine({ts: '2026-10-19T14:03:22.120Z', level: 'error', area: 'renderer', msg: 'quebrou', code: 7})
 * // '2026-10-19 14:03:22Z ERROR [renderer] quebrou (code=7)'
 */
export function readableLogLine(entry) {
  const {ts, level, area, msg, ...fields} = entry;
  const when = ts ? ts.replace('T', ' ').replace(/\.\d+Z$/, 'Z') : '—';
  const extra = Object.entries(fields).map(([name, value]) => `${name}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
  const tail = extra.length ? ` (${extra.join(', ')})` : '';
  return `${when} ${String(level).toUpperCase()} [${area}] ${msg}${tail}`;
}

/**
 * O conteúdo inteiro do `desk.log` em texto legível, na ordem do arquivo.
 * @param {string} text conteúdo do log (pode juntar `desk.log.1` + `desk.log`)
 * @returns {string}
 * @example readableLog(fs.readFileSync(logFile, 'utf8'))
 */
export function readableLog(text) {
  const lines = text.split('\n').map(parseLogLine).filter((entry) => entry !== null);
  return lines.map(readableLogLine).join('\n') + (lines.length ? '\n' : '');
}
