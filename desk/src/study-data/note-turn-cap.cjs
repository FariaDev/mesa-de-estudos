// @ts-check
'use strict';

/* Teto de `salvar_nota` por turno do aluno (auditoria de segurança): no máximo
   3 notas gravadas por turno, para material não confiável não transformar uma
   ordem escondida numa enxurrada de arquivos em `Notas/`. Vale para os dois
   motores porque mora no único funil de gravação (`noteSave` em
   `services.cjs`); o host avisa o turno novo (`newStudentTurn`) a cada mensagem
   aceita do aluno (`tutor-prompt-host.cjs`), nunca no resultado de cartão. A
   nota continua sem aprovação: mudar isso é decisão do autor.

   Só conta o que foi realmente gravado (validação e sessão entram antes); a
   quarta tentativa do mesmo turno recebe `err.note.turnCap` antes de tocar no
   disco. Turno cancelado não mexe aqui: o próximo `newTurn` libera de novo. Não
   é lei do núcleo Bend (ADR 0003): o núcleo prova o invariante do arquivo (fica
   em `Notas/`, nunca sobrescreve), e esta é política de ritmo do host — o
   número 3 é ajuste, não verdade de domínio que a quebra custaria ao aluno. */

const {message} = require('../i18n.mjs');

const MAX_NOTES_PER_TURN = 3;

/**
 * O teto de notas do turno, por conversa e época.
 * @param {{max?: number}} [options]
 * @example const cap = createNoteTurnCap(); cap.allows('a#0') // true
 */
function createNoteTurnCap({max = MAX_NOTES_PER_TURN} = {}) {
  let epoch = 0;
  const saved = new Map();
  const keyOf = (scopeKey) => `${scopeKey}#${epoch}`;
  return {
    /** Turno novo do aluno: a próxima rodada volta a ter o teto cheio. */
    newTurn() {
      epoch += 1;
      /* As chaves carregam a época, então o que ficou para trás nunca mais é
         lido; limpar aqui é só não guardar lixo. */
      saved.clear();
    },
    /**
     * Diz se cabe mais uma nota neste turno e conversa, sem contar ainda.
     * @param {string} scopeKey conversa atual (curso, sessão e época do host fora)
     */
    allows(scopeKey) {
      return (saved.get(keyOf(scopeKey)) || 0) < max;
    },
    /**
     * Conta uma nota que acabou de ser gravada no turno e conversa.
     * @param {string} scopeKey conversa atual (curso, sessão e época do host fora)
     */
    record(scopeKey) {
      saved.set(keyOf(scopeKey), (saved.get(keyOf(scopeKey)) || 0) + 1);
    },
  };
}

/**
 * O erro que o modelo recebe ao passar do teto: marcado para o catálogo, na
 * língua do tutor, mandando contar ao aluno o que não foi salvo.
 * @param {number} [max]
 */
function turnCapError(max = MAX_NOTES_PER_TURN) {
  return Error(message('err.note.turnCap', {max}));
}

module.exports = {MAX_NOTES_PER_TURN, createNoteTurnCap, turnCapError};
