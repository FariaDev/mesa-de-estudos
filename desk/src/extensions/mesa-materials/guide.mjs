/* `listar_materiais` — UM texto e um formato de resultado para os três
   motores (Pi `mesa_listar_materiais`, Claude e OpenCode `listar_materiais`).
   A lista é a biblioteca da matéria (ou o manifesto da sessão Livre), sempre
   recortada pelo host; o modelo não manda caminho. Descrição e campos são
   SEMPRE em inglês; o resultado (`materialsText`) segue em português. */

export const MATERIALS_DESCRIPTION =
  'Lists the PDFs of the current course (or free session) with their canonical absolute paths, ready to open with ler_pdf. ' +
  'Use it when the student mentions a file you do not know or asks what material is available. ' +
  'Only PDFs, up to 200; nothing outside this session\'s library.';

export const MATERIALS_FIELDS = {};

/**
 * O texto que volta ao tutor: uma linha por PDF, com nome e caminho canônico.
 * @param {{materials?: Array<{name?: string, path?: string}>}} result
 * @returns {string}
 * @example materialsText({materials: [{name: 'A.pdf', path: '/c/A.pdf'}]}) // 'Materiais (1):\n- A.pdf — /c/A.pdf'
 */
export function materialsText(result) {
  const materials = Array.isArray(result?.materials) ? result.materials : [];
  if (!materials.length) return 'Nenhum PDF na biblioteca desta matéria.';
  const lines = [`Materiais (${materials.length}):`];
  for (const material of materials) lines.push(`- ${material.name || 'PDF'} — ${material.path || ''}`);
  if (result?.truncated) lines.push('(há mais PDFs; a lista mostra os primeiros 200)');
  return lines.join('\n');
}
