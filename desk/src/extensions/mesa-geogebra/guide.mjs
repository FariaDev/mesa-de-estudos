/* Instrução da ferramenta GeoGebra do tutor — UM texto para as duas ferramentas
   (extensão do Pi `mesa_geogebra` e `geogebra` do Claude): mudam juntas, e
   `tests/native-tool-parity.mjs` confere (#53). Campos, descrição e frases do
   resultado moram aqui; cada motor só leva o pedido à Mesa.
   O texto segue o idioma do tutor (#41): `guideFor('pt-BR' | 'en')`. O nome do
   campo `continuar` fica igual nos dois idiomas, porque é contrato da ponte. */

export const ACTIONS = ['run', 'state', 'screenshot'];
export const COMMAND_MAX = 2000;
export const GUIDE_LANGUAGES = ['pt-BR', 'en'];

const TEXTS = {
  'pt-BR': {
    description: [
      'Controle o applet GeoGebra embutido na Mesa de Estudos (mesmo app da web).',
      'A Mesa abre a aba sozinha quando está fechada e espera o applet ficar pronto: não peça ao aluno para abri-la.',
      'actions: "run" executa um comando na sintaxe do GeoGebra (em inglês, ex.: f(x)=x^2-2, Solve(f), Derivative(f), Root(f,0,5), Circumference((0,0),2), Intersect(f,g)); "state" lista os objetos atuais com comando/definição e valor; "screenshot" captura o applet como imagem para você ver.',
      'Cada resposta sua começa com o quadro vazio: o primeiro "run" da resposta guarda a construção que estava lá (a do aluno também) e limpa o quadro; o aluno pode voltar a ela com um botão. "state" e "screenshot" nunca limpam, então servem para ler o que o aluno montou.',
      'Se o aluno pediu para mexer no que já está no quadro, envie "continuar": true no primeiro "run" e o quadro fica como está.',
      'Prefira "run" + "state" para construir (rode o comando e leia os objetos criados) e use "screenshot" quando precisar ver o visual (curvas, figuras, interseções).',
    ].join(' '),
    command: 'Comando na sintaxe do GeoGebra; obrigatório em "run".',
    continuar: 'Em "run": mantém a construção que já está no quadro em vez de começar vazio.',
    emptyBoard: '(a construção está vazia)',
    boardStudent: 'a construção do aluno',
    boardTutor: 'a sua construção anterior',
    boardNote: (whose) => `O quadro começou vazio para esta resposta: ${whose} ficou guardada e o aluno pode voltar a ela.`,
    refused: (error) => `O GeoGebra recusou o comando: ${error || 'erro desconhecido'}.`,
    accepted: 'Comando aceito pelo GeoGebra.',
    objects: 'Objetos atuais:',
    stateLead: 'Objetos atuais no GeoGebra:',
    shot: 'Captura do applet GeoGebra.',
    missingCommand: 'Informe o command (sintaxe GeoGebra).',
    bridgeClosed: 'a Mesa não está com a ponte do GeoGebra aberta',
    unavailable: (reason) => `GeoGebra indisponível (${reason}). Diga ao aluno o que impediu e não reinvente o resultado.`,
  },
  en: {
    description: [
      "Control the GeoGebra applet embedded in the study desk (same app as the web version).",
      "The desk opens the tab by itself when it is closed and waits for the applet to be ready: do not ask the student to open it.",
      'actions: "run" executes a command in GeoGebra syntax (e.g. f(x)=x^2-2, Solve(f), Derivative(f), Root(f,0,5), Circumference((0,0),2), Intersect(f,g)); "state" lists the current objects with command/definition and value; "screenshot" captures the applet as an image for you to see.',
      'Each of your replies starts with an empty board: the first "run" of the reply saves the construction that was there (the student\'s too) and clears the board; the student can go back to it with a button. "state" and "screenshot" never clear, so they are the way to read what the student built.',
      'If the student asked you to work on what is already on the board, send "continuar": true on the first "run" and the board stays as it is.',
      'Prefer "run" + "state" to build (run the command and read the objects created) and use "screenshot" when you need to see the visual (curves, figures, intersections).',
    ].join(' '),
    command: 'Command in GeoGebra syntax; required for "run".',
    continuar: 'On "run": keeps the construction already on the board instead of starting empty.',
    emptyBoard: '(the construction is empty)',
    boardStudent: "the student's construction",
    boardTutor: 'your previous construction',
    boardNote: (whose) => `The board started empty for this reply: ${whose} was saved and the student can go back to it.`,
    refused: (error) => `GeoGebra rejected the command: ${error || 'unknown error'}.`,
    accepted: 'Command accepted by GeoGebra.',
    objects: 'Current objects:',
    stateLead: 'Current objects in GeoGebra:',
    shot: 'Capture of the GeoGebra applet.',
    missingCommand: 'Provide the command (GeoGebra syntax).',
    bridgeClosed: 'the desk has no GeoGebra bridge open',
    unavailable: (reason) => `GeoGebra unavailable (${reason}). Tell the student what got in the way and do not invent the result.`,
  },
};

/** Idioma que o guia sabe falar; qualquer outro valor cai no português. @param {unknown} language */
export function guideLanguage(language) {
  return language === 'en' ? 'en' : 'pt-BR';
}

/**
 * Guia da ferramenta no idioma do tutor.
 * @param {'pt-BR'|'en'|string} [language]
 * @example guideFor('en').description.startsWith('Control the GeoGebra')
 */
export function guideFor(language = 'pt-BR') {
  const text = TEXTS[guideLanguage(language)];
  const objectsText = (state) => {
    const objects = typeof state?.objects === 'string' ? state.objects.trim() : '';
    return objects || text.emptyBoard;
  };
  /* O que a Mesa fez com o quadro antes do comando, dito ao tutor para ele não
     estranhar a construção sumida. */
  const boardNote = (board) => {
    if (!board || board.cleared !== true) return '';
    return text.boardNote(board.origin === 'student' ? text.boardStudent : text.boardTutor);
  };
  return {
    description: text.description,
    /* Campos da ferramenta (`tool-fields.mjs` monta o zod do Claude e o TypeBox do Pi). */
    fields: {
      action: {type: 'enum', values: ACTIONS},
      command: {type: 'string', max: COMMAND_MAX, optional: true, description: text.command},
      continuar: {type: 'boolean', optional: true, description: text.continuar},
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
