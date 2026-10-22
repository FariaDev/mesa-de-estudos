import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {viewFigure} from './client.mjs';
import {FIGURE_DESCRIPTION, FIGURE_FIELDS, figureText} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

/* "Ver o que desenhei" no Pi (#60): o print da figura (SVG ou cerca `plot`).
   Texto, campos e resultado são os do Claude e do OpenCode (`guide.mjs`);
   `tests/native-tool-parity.mjs` confere. */

export default function mesaFigure(pi: ExtensionAPI) {
  let bridge;
  try {
    bridge = JSON.parse(process.env.LEARNING_DESK_ACTIVITY_BRIDGE || '');
  } catch {
    return;
  }
  pi.registerTool({
    name: 'mesa_ver_figura',
    label: 'Ver a figura',
    description: FIGURE_DESCRIPTION,
    parameters: typeboxObject(Type, FIGURE_FIELDS),
    async execute(_id, params, signal) {
      const result = await viewFigure(bridge, params, {signal});
      return {
        content: [
          {type: 'image', data: result.screenshot.data, mimeType: result.screenshot.mimeType},
          {type: 'text', text: figureText(result)},
        ],
        details: {figure: {width: result.width, contentHeight: result.contentHeight, warnings: result.warnings, removed: result.removed}},
      };
    },
  });
}
