/* Estado pequeno da SESSÃO DO PROCESSO do servidor MCP.
   - guarda apenas referências curtas: último PDF/página renderizados com
     sucesso, a última captura BEM-SUCEDIDA e a anotação/questão ativa;
   - NUNCA guarda bytes de imagem nem conteúdo de PDF;
   - memória do processo (some quando o servidor encerra); checkpoint
     opcional fica em persistence.mjs e só fornece candidato de retomada;
   - `setPage`/`setCapture` só são chamados DEPOIS do sucesso da ferramenta;
     falha de página/captura nunca reaproveita imagem antiga no resultado nem
     substitui a última captura bem-sucedida (o contexto mantém a referência
     anterior, sem usá-la como imagem da tentativa falha). */

const DOCUMENT_NAME_MAX = 300;
const DOCUMENT_PATH_MAX = 4096;
const SNAPSHOT_PATH_MAX = 4096;
const TITLE_MAX = 300;
export const NOTE_MAX = 2000;
const WINDOW_ID_MAX_TEXT = 10;

function boundedText(value, max) {
  if (typeof value !== 'string' || value === '') return null;
  return value.slice(0, max);
}

export function createContextStore({now = () => new Date()} = {}) {
  let page = null;
  let capture = null;
  let note = null;
  let updatedAt = null;

  const touch = () => {
    updatedAt = now().toISOString();
  };

  return {
    setPage(entry) {
      if (!entry || typeof entry !== 'object') return;
      const document = entry.document && typeof entry.document === 'object' ? entry.document : {};
      page = {
        document: {
          name: boundedText(document.name, DOCUMENT_NAME_MAX),
          path: boundedText(document.path, DOCUMENT_PATH_MAX),
        },
        page: Number.isInteger(entry.page) ? entry.page : null,
        numPages: Number.isInteger(entry.numPages) ? entry.numPages : null,
        snapshotPath: boundedText(entry.snapshotPath, SNAPSHOT_PATH_MAX),
        vectorPreviewOmitted: entry.vectorPreviewOmitted === true,
      };
      touch();
    },

    setCapture(entry) {
      if (!entry || typeof entry !== 'object') return;
      const window = entry.window && typeof entry.window === 'object' ? entry.window : {};
      const id = typeof window.id === 'string' ? window.id : String(window.id ?? '');
      capture = {
        window: {
          id: /^\d{1,10}$/.test(id) ? id.slice(0, WINDOW_ID_MAX_TEXT) : null,
          app: boundedText(window.app, TITLE_MAX),
          title: boundedText(window.title, TITLE_MAX),
        },
        capturedAt: boundedText(entry.capturedAt, 40),
        snapshotPath: boundedText(entry.snapshotPath, SNAPSHOT_PATH_MAX),
      };
      touch();
    },

    setNote(text) {
      note = boundedText(text, NOTE_MAX);
      touch();
    },

    clear() {
      page = null;
      capture = null;
      note = null;
      touch();
    },

    snapshot() {
      return {
        page: page ? JSON.parse(JSON.stringify(page)) : null,
        capture: capture ? JSON.parse(JSON.stringify(capture)) : null,
        note,
        updatedAt,
      };
    },
  };
}
