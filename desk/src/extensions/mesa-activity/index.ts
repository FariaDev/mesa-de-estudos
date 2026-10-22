import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {createActivity, previewActivity} from './client.mjs';
import {CREATE_DESCRIPTION, CREATE_FIELDS, PREVIEW_DESCRIPTION, PREVIEW_FIELDS, previewText, publishedText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* Ferramentas de quadro do tutor no Pi (#42): mostrar (visualização ou
   atividade) e a prévia. Texto, campos e resultado são os do Claude
   (`guide.mjs`); `tests/native-tool-parity.mjs` confere. */

export default function mesaActivity(pi: ExtensionAPI) {
  let bridge;
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE || '');
  } catch {
    return;
  }
  pi.registerTool({
    name: 'mesa_previsualizar_atividade',
    label: 'Prévia do quadro',
    description: PREVIEW_DESCRIPTION,
    parameters: typeboxObject(Type, PREVIEW_FIELDS),
    async execute(_id, params, signal) {
      const result = await previewActivity(bridge, params, {signal});
      return {
        content: [
          {type: 'image', data: result.screenshot.data, mimeType: result.screenshot.mimeType},
          {type: 'text', text: previewText(result)},
        ],
        details: {preview: {width: result.width, contentHeight: result.contentHeight, capturedHeight: result.capturedHeight, consoleMessages: result.consoleMessages}},
      };
    },
  });
  pi.registerTool({
    name: 'mesa_criar_atividade',
    label: 'Mostrar visualização ou atividade',
    description: CREATE_DESCRIPTION,
    parameters: typeboxObject(Type, CREATE_FIELDS),
    async execute(id, params, signal) {
      const result = await createActivity(bridge, params, {toolCallId: id, signal});
      return {
        content: [{type: 'text', text: publishedText(result, params.kind)}],
        details: {activity: {id: result.id, version: result.version, hash: result.hash, kind: 'activity', toolCallId: id, status: 'published'}},
      };
    },
  });
}
