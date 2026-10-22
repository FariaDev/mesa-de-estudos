/* Constantes do host do mod Mesa de Estudos.
   Nenhum valor aqui vem do pedido JSON: o pedido só escolhe arquivo, página,
   roots e cacheDir. Ferramentas e limites são fixos no código (ou injetados
   por testes via `deps`), nunca por executável arbitrário. */

export const SVG_CHAR_LIMIT = 131072; // limite do host de mods para o campo Svg
export const MAX_REQUEST_CHARS = 65536; // teto do JSON recebido em argv[2]
export const MAX_PATH_CHARS = 4096;
export const MAX_ROOTS = 64;
export const MAX_PAGE = 1000000;

export const MAX_PDF_BYTES = 256 * 1024 * 1024; // 256 MiB
export const MIN_PDF_BYTES = 8; // cabeçalho %PDF- + conteúdo mínimo
export const MAX_SVG_READ_BYTES = 512 * 1024; // acima disso já excede 131072 chars
export const PDF_MAGIC = '%PDF-';

/* Os timeouts internos cabem dentro do timeout externo do consumidor
   (lib/helper.mjs): página ≈ 10+20+20 = 50 s < 60 s; captura ≈ 3×5+10 = 25 s < 30 s. */
export const PDFINFO_TIMEOUT_MS = 10000;
export const PDFTOCAIRO_TIMEOUT_MS = 20000;
export const PROCESS_MAX_BUFFER = 16 * 1024 * 1024;
export const PNG_RENDER_DPI = 150;

export const CAPTURE_HELPER_TIMEOUT_MS = 5000;
export const CAPTURE_SCREENSHOT_TIMEOUT_MS = 10000;
export const CAPTURE_MAX_BUFFER = 1024 * 1024;
/* CGWindowID é UInt32: 0 e valores fora desse intervalo nunca são janelas
   capturáveis (o helper real lista só inteiros positivos). */
export const CAPTURE_WINDOW_ID_MAX = 0xffffffff;

/* Poppler: o host procura os executáveis NESTA ordem (a mesma lista do
   doctor), nunca aceita caminho vindo do pedido. POPPLER_TOOLS é só o
   fallback do primeiro diretório, usado para relatar TOOL_MISSING quando
   nenhum candidato existe; a resolução real fica em host/tools.mjs. */
export const POPPLER_DIRS = Object.freeze(['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']);
export const POPPLER_TOOLS = Object.freeze({
  pdfinfo: `${POPPLER_DIRS[0]}/pdfinfo`,
  pdftocairo: `${POPPLER_DIRS[0]}/pdftocairo`,
});
export const SCREENCAPTURE_PATH = '/usr/sbin/screencapture';

export const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* Saída privada: subdiretório mkdtemp 0700 por operação, arquivos 0600.
   Cada diretório leva um marcador com token; a poda de retenção só remove
   diretórios com esse marcador (nunca caminho alheio). */
export const OUTPUT_PREFIX = 'mesa-study-';
export const OUTPUT_MARKER = '.mesa-study.json';
export const OUTPUT_HOST_ID = 'mesa-study-host';
export const OUTPUT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export const CAPTURE_HELPER_RELATIVE = Object.freeze(['..', '..', '..', 'visual-check', 'windows']);
