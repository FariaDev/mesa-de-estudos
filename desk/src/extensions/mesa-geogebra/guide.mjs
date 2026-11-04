/* Instrução da ferramenta GeoGebra do tutor — UM texto para as duas ferramentas
   (extensão do Pi `mesa_geogebra` e `geogebra` do Claude): mudam juntas, e
   `tests/native-tool-parity.mjs` confere (#53). Campos, descrição e frases do
   resultado moram aqui; cada motor só leva o pedido à Mesa.
   Descrição e campos são SEMPRE em inglês, em todo idioma; o resultado segue o
   idioma do tutor (#41), então `guideFor('pt-BR' | 'en')` só escolhe as frases
   que voltam ao modelo. O nome do campo `continuar` fica igual nos dois
   idiomas, porque é contrato da ponte. */

export const ACTIONS = ['run', 'state', 'screenshot'];
export const COMMAND_MAX = 2000;
export const GUIDE_LANGUAGES = ['pt-BR', 'en'];

/* Tudo o que o modelo vê antes de chamar: inglês único, sem par espelhado. */
const DESCRIPTION = [
  'Control the GeoGebra applet embedded in the study desk (same as the web app).',
  'The desk opens the tab when closed and waits for the applet: do not ask the student to open it.',
  'actions: "run" executes a GeoGebra command (e.g. f(x)=x^2-2, Solve(f), Derivative(f), Root(f,0,5), Circumference((0,0),2), Intersect(f,g)); "state" lists current objects with command/definition and value; "screenshot" captures the applet as an image for you.',
  'Each reply starts with an empty board: the first "run" saves the construction that was there (the student\'s too) and clears the board; the student can restore it with a button. "state" and "screenshot" never clear, so use them to read what the student built.',
  'If the student asked to work on what is already on the board, send "continuar": true on the first "run" to keep it.',
  '"run" already returns the state with the objects created: use "state" only to reread without changing and "screenshot" when you need the visual (curves, figures, intersections).',
].join(' ');
const COMMAND_PARAM = 'Command in GeoGebra syntax; required for "run".';
const CONTINUAR_PARAM = 'On "run": keeps the construction already on the board instead of starting empty.';

/* O que volta ao tutor, no idioma escolhido para o tutor (não é descrição). */
const RESULT_TEXTS = {
  'pt-BR': {
    emptyBoard: '(a construção está vazia)',
    boardStudent: 'a construção do aluno',
    boardTutor: 'a sua construção anterior',
    boardNote: (whose) => `O quadro começou vazio para esta resposta: ${whose} ficou guardada e o aluno pode voltar a ela.`,
    refused: (error) => `O GeoGebra recusou o comando: ${error || 'erro desconhecido'}.`,
    accepted: 'Comando aceito pelo GeoGebra.',
    objects: 'Objetos atuais:',
    stateLead: 'Objetos atuais no GeoGebra:',
    moreObjects: (count) => `(mostrando 80 de ${count} objetos)`,
    shot: 'Captura do applet GeoGebra.',
    missingCommand: 'Informe o command (sintaxe GeoGebra).',
    bridgeClosed: 'a Mesa não está com a ponte do GeoGebra aberta',
    unavailable: (reason) => `GeoGebra indisponível (${reason}). Diga ao aluno o que impediu e não reinvente o resultado.`,
  },
  en: {
    emptyBoard: '(the construction is empty)',
    boardStudent: "the student's construction",
    boardTutor: 'your previous construction',
    boardNote: (whose) => `The board started empty for this reply: ${whose} was saved and the student can go back to it.`,
    refused: (error) => `GeoGebra rejected the command: ${error || 'unknown error'}.`,
    accepted: 'Command accepted by GeoGebra.',
    objects: 'Current objects:',
    stateLead: 'Current objects in GeoGebra:',
    moreObjects: (count) => `(showing 80 of ${count} objects)`,
    shot: 'Capture of the GeoGebra applet.',
    missingCommand: 'Provide the command (GeoGebra syntax).',
    bridgeClosed: 'the desk has no GeoGebra bridge open',
    unavailable: (reason) => `GeoGebra unavailable (${reason}). Tell the student what got in the way and do not invent the result.`,
  },
};

/** Idioma das frases de resultado; qualquer outro valor cai no português. @param {unknown} language */
export function guideLanguage(language) {
  return language === 'en' ? 'en' : 'pt-BR';
}

/**
 * Guia da ferramenta: descrição e campos em inglês, resultado no idioma do tutor.
 * @param {'pt-BR'|'en'|string} [language]
 * @example guideFor('en').description.startsWith('Control the GeoGebra')
 */
export function guideFor(language = 'pt-BR') {
  const text = RESULT_TEXTS[guideLanguage(language)];
  /* M4: o host corta o resumo em 80 objetos; sem o aviso o modelo acha que viu
     todos. `count` é o total que o applet devolveu. */
  const objectsText = (state) => {
    const objects = typeof state?.objects === 'string' ? state.objects.trim() : '';
    const count = Number(state?.count) || 0;
    const capped = count > 80 ? text.moreObjects(count) : '';
    return [objects || text.emptyBoard, capped].filter(Boolean).join('\n');
  };
  /* O que a Mesa fez com o quadro antes do comando, dito ao tutor para ele não
     estranhar a construção sumida. */
  const boardNote = (board) => {
    if (!board || board.cleared !== true) return '';
    return text.boardNote(board.origin === 'student' ? text.boardStudent : text.boardTutor);
  };
  return {
    description: DESCRIPTION,
    /* Campos da ferramenta (`tool-fields.mjs` monta o zod do Claude e o TypeBox do Pi). */
    fields: {
      action: {type: 'enum', values: ACTIONS},
      command: {type: 'string', max: COMMAND_MAX, optional: true, description: COMMAND_PARAM},
      continuar: {type: 'boolean', optional: true, description: CONTINUAR_PARAM},
    },
    boardNote,
    /** Texto devolvido ao tutor depois de "run". @param {{ok?: boolean, error?: string, state?: object, board?: object}} data */
    runText(data) {
      const note = boardNote(data?.board);
      const lead = data?.ok === false ? text.refused(data.error) : text.accepted;
      return `${note ? `${note}\n\n` : ''}${lead}\n\n${text.objects}\n${objectsText(data?.state)}`;
    },
    /** Texto devolvido ao tutor depois de "state". @param {{state?: object}} data */
    stateText(data) {
      return `${text.stateLead}\n${objectsText(data?.state)}`;
    },
    bridgeClosed: text.bridgeClosed,
    shotText: text.shot,
    missingCommandText: text.missingCommand,
    /** O GeoGebra não respondeu: o motivo vem da Mesa em uma frase. @param {string} reason */
    unavailableText(reason) {
      return text.unavailable(reason);
    },
  };
}
