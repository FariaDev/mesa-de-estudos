import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {PDF_DESCRIPTION, PDF_FIELDS, createPdfSession, readPdfPages} from '../mesa-mcp/pdf-tool.mjs';
import {typeboxObject} from '../tool-fields.mjs';
import {toolErrorText} from '../../agents/tool-error-text.cjs';

/* `mesa_ler_pdf`: o mesmo texto e os mesmos campos do Claude e do OpenCode.
   Sem a ponte, a ferramenta não existe; o tutor não tem leitura nativa, então
   não há um caminho alternativo para ler o PDF. */

export default function mesaPdf(pi: ExtensionAPI) {
  let bridge: {url?: string, token?: string};
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE || '');
  } catch {
    return;
  }
  if (!bridge || typeof bridge.url !== 'string' || typeof bridge.token !== 'string') return;
  const grant = {url: bridge.url, token: bridge.token};
  const session = createPdfSession();
  pi.registerTool({
    name: 'mesa_ler_pdf',
    label: 'Ler PDF',
    description: PDF_DESCRIPTION,
    parameters: typeboxObject(Type, PDF_FIELDS),
    async execute(_id, params) {
      try {
        const result = await readPdfPages(grant, params);
        return {content: session.content(result)};
      } catch (error) {
        return {content: [{type: 'text' as const, text: toolErrorText(error, process.env.LEARNING_DESK_TUTOR_LANGUAGE, 'err.pdf.readFailed')}], isError: true};
      }
    },
  });
}
