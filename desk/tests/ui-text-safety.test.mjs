/* As garantias que o corte de texto da #90 não pode levar junto.

   O teto de 80 caracteres (`ui-text-length.test.mjs`) encurta frases fixas; uma
   frase de segurança, de consequência ou de erro acionável pode caber no teto
   sem perder o aviso. Este teste guarda o pedaço que não pode sumir em cada
   idioma: se alguém cortar de novo, o teste diz qual garantia ficou de fora. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

/** Chave → [fragmento em pt-BR, fragmento em en]. */
const GUARANTEES = new Map([
  ['freeModels.clip.note', ['nada é guardado', 'nothing is saved']],
  ['backup.gitRemoteNote', ['sem guardar credenciais', 'no stored credentials']],
  ['freeModels.card.billing', ['confira no console', 'check the console']],
  ['freeModels.card.local', ['fora do config.json', 'outside config.json']],
  ['sidechat.confirmNewUncertain', ['O atual fica guardado', 'The current one is kept']],
  ['header.sessionsHint', ['rascunho', 'draft']],
  ['freeModels.test.shape', ['sk-', 'sk-']],
  ['freeModels.test.billing', ['Confira o console', 'Check the console']],
  ['freeModels.done.none', ['Escolha um sem custo', 'Pick a no-cost']],
  ['backup.restore.lead', ['preserva uma cópia', 'keeps a copy']],
  ['link.confirm.lead', ['Confira o destino', 'Check the destination']],
  ['settings.courses.removeNote', ['não apaga', 'keeps']],
  ['settings.features.refsNote', ['não tira os PDFs', 'keeps PDFs']],
  ['goes.note.listed', ['não é enviado', 'not sent']],
]);

test('o texto curto mantém as garantias de segurança e as consequências', () => {
  for (const [key, [ptFragment, enFragment]] of GUARANTEES) {
    assert.ok(String(ptBR[key] ?? '').includes(ptFragment), `${key}: o pt-BR perdeu "${ptFragment}"`);
    assert.ok(String(en[key] ?? '').includes(enFragment), `${key}: o en perdeu "${enFragment}"`);
  }
});
