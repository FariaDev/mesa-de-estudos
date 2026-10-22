import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {Type} from 'typebox';
import {BRIDGE_CLOSED, callGeogebra} from './client.mjs';
import {guideFor} from './guide.mjs';
import {typeboxObject} from '../tool-fields.mjs';

const text = (value: string) => ({content: [{type: 'text' as const, text: value}]});

/* Ferramenta `mesa_geogebra`: o mesmo guia e a mesma ponte do `geogebra` do Claude (#53).
   Só registra com a ponte da Mesa (LEARNING_DESK_GGB_BRIDGE), como as outras ferramentas da Mesa. */
export default function mesaGeogebra(pi: ExtensionAPI) {
  const bridgeFile = typeof process.env.LEARNING_DESK_GGB_BRIDGE === 'string' ? process.env.LEARNING_DESK_GGB_BRIDGE.trim() : '';
  if (!bridgeFile) return;
  /* O idioma do tutor chega pelo ambiente que a Mesa monta ao abrir o Pi. */
  const guide = guideFor(process.env.LEARNING_DESK_TUTOR_LANGUAGE);
  pi.registerTool({
    name: 'mesa_geogebra',
    label: 'GeoGebra',
    executionMode: 'sequential',
    description: guide.description,
    parameters: typeboxObject(Type, guide.fields),
    async execute(_toolCallId, params, signal) {
      try {
        if (params.action === 'run' && !params.command?.trim()) return text(guide.missingCommandText);
        const data = await callGeogebra(bridgeFile, params.action, params, signal);
        if (params.action === 'screenshot') {
          return {content: [{type: 'image' as const, data: String(data.png || ''), mimeType: 'image/png'}, {type: 'text' as const, text: guide.shotText}]};
        }
        return text(params.action === 'run' ? guide.runText(data) : guide.stateText(data));
      } catch (error) {
        const closed = (error as {code?: string})?.code === BRIDGE_CLOSED;
        return text(guide.unavailableText(closed ? guide.bridgeClosed : String((error as Error)?.message || error)));
      }
    },
  });
}
