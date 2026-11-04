/* O guia descreve a tela de hoje (#90, rodada final). Rótulos que saíram da
   interface não podem voltar ao texto do guia: quem procura "Navegar" no menu
   do leitor não acha nada. Lista curta e explícita; nada de bloquear palavra
   solta que ainda exista noutro lugar (como "Modo compacto", ação da busca). */
import test from 'node:test';
import assert from 'node:assert/strict';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const OLD_LABELS = {
  'pt-BR': [
    'Vai junto',
    'Inverter cores',
    'Inverter as cores da página',
    'Navegar',
    'Tentar de novo com o tutor',
    'Resumir agora',
    'indicador do cabeçalho do tutor',
    'minimizar o PDF',
    'primeiros passos',
  ],
  en: [
    'Goes along',
    'Invert colors',
    'Browse',
    'Try again with the tutor',
    'Summarize now',
    'indicator in the tutor header',
    'minimize the PDF',
    'first steps',
  ],
};

test('o guia não cita rótulos que saíram da tela', () => {
  for (const [language, labels] of Object.entries(OLD_LABELS)) {
    const catalog = language === 'pt-BR' ? ptBR : en;
    for (const [key, phrase] of Object.entries(catalog)) {
      if (!key.startsWith('guide.') || typeof phrase !== 'string') continue;
      for (const label of labels) {
        assert.equal(phrase.includes(label), false, `${language} ${key} ainda cita "${label}": ${phrase}`);
      }
    }
  }
});
