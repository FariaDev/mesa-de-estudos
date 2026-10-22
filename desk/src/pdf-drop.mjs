/* PDF solto no leitor alvo.
   O arrasto entrega um `File` do sistema; o caminho real só existe no preload
   (`webUtils.getPathForFile`), então aqui não se lê arquivo nenhum: valida-se o
   que dá para validar no renderer (nome/tipo) e o `File` vai inteiro para
   `window.desk.openDroppedPDF(file, panelIndex)`. O host do main revalida
   assinatura/caminho — esta é a primeira peneira, não a autoridade.
   O alvo visual é discreto: a área do leitor ganha `.pdf-drop-over` e a dica
   (`core/pdfpageview.bend` -> `.pdf-drop-hint`) aparece por cima do palco.
   Imagens e outros arquivos no chat não passam por aqui: o listener vive no
   painel do leitor, não no documento. */

const PDF_MIME = 'application/pdf';
const PDF_NAME = /\.pdf$/i;

// O arquivo do arrasto é PDF? Tipo vazio é aceito (o Finder nem sempre manda o
// MIME no dragover); o nome ainda decide. O backend confirma no drop.
export function isPdfFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  return type === PDF_MIME || PDF_NAME.test(String(file.name || ''));
}

// Durante o arrasto, só `items` existe; não dá para conhecer todos os tipos.
// Se algum item se declara PDF (ou não declara tipo), vale a área alvo.
export function draggedLooksPdf(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const files = items.filter((item) => item && item.kind === 'file');
  if (!files.length) return false;
  return files.some((item) => {
    const type = String(item.type || '').toLowerCase();
    return type === PDF_MIME || type === '';
  });
}

function hasFiles(dataTransfer) {
  return [...(dataTransfer?.types || [])].includes('Files');
}

// Liga o painel como alvo. `onActive(Bool)` liga/desliga a dica e o realce;
// `onDrop(File)` recebe o primeiro arquivo do drop (o host valida de novo).
// Devolve um `destroy` para o chamador soltar os listeners quando quiser.
export function bindPdfDrop(el, {onActive = () => {}, onDrop = () => {}} = {}) {
  if (!el || typeof el.addEventListener !== 'function') return {destroy() {}};
  const setActive = (on) => onActive(!!on);

  const over = (event) => {
    if (!hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setActive(draggedLooksPdf(event.dataTransfer));
  };
  const leave = (event) => {
    if (!hasFiles(event.dataTransfer)) return;
    if (el.contains?.(event.relatedTarget)) return;
    setActive(false);
  };
  const drop = (event) => {
    const files = Array.from(event.dataTransfer?.files || []);
    setActive(false);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    onDrop(files[0]);
  };

  el.addEventListener('dragenter', over);
  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', leave);
  el.addEventListener('drop', drop);
  return {
    destroy() {
      el.removeEventListener('dragenter', over);
      el.removeEventListener('dragover', over);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    },
  };
}
