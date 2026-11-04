/* Propor um card de revisão — UM texto para os três motores (Pi
   `mesa_propor_revisao`, Claude e OpenCode `propor_revisao`). O quando usar
   mora no prompt do tutor (`desk-prompts.cjs`); aqui fica o como. Descrição e
   campos são SEMPRE em inglês; o resultado (`proposalText`) segue como estava.
   Os tetos são os de `core/review.bend` (`maxQuestion`, `maxAttempt`,
   `maxDifficulty`). */

export const REVIEW_DESCRIPTION = [
  'Proposes a card in the review notebook with the question, what the student tried and where they got stuck.',
  'The reference is the page open in the desk: do not send a path or page.',
  'The call opens the dialog prefilled and waits for the student.',
  'Approved or edited returns the final version and saves the card.',
  'Discarded, busy or pending saves nothing.',
  'Wait for this result and do not repeat the proposal in the same turn.',
].join(' ')

/* Campos (`tool-fields.mjs` monta o zod do Claude, o TypeBox do Pi e o JSON Schema do OpenCode). */
export const REVIEW_FIELDS = {
  question: {type: 'string', min: 1, max: 400, trim: true, description: 'The question, in the wording the student should be able to redo.'},
  attempt: {type: 'string', max: 400, optional: true, trim: true, description: 'What the student tried, if they showed it.'},
  difficulty: {type: 'string', max: 240, optional: true, trim: true, description: 'Where they got stuck, or the concept that was missing.'},
}

/**
 * O texto que volta ao tutor. Aprovado e editado trazem a versão final, com a
 * referência só como nome e página — o caminho do arquivo fica no caderno.
 * @param {{status?: string, reason?: string, item?: {question?: string, attempt?: string, difficulty?: string, ref?: {name?: string, page?: number, path?: string}}}} result
 * @returns {string}
 * @example proposalText({status: 'busy'}).includes('diálogo') // true
 */
export function proposalText(result) {
  const status = result?.status || 'pending'
  if (status === 'approved' || status === 'edited') return savedText(status, result.item || {})
  if (status === 'busy') return 'A Mesa já tem um diálogo de revisão aberto. Esta proposta foi recusada e nada foi gravado. Não proponha outro card neste turno.'
  if (status === 'discarded') return discardedText(result?.reason)
  return pendingText(result?.reason)
}

function savedText(status, item) {
  const verb = status === 'edited' ? 'O aluno editou e guardou este card:' : 'O aluno aprovou e guardou este card:'
  const lines = [verb, `Questão: ${item.question || ''}`]
  if (item.attempt) lines.push(`Tentativa: ${item.attempt}`)
  if (item.difficulty) lines.push(`Dificuldade: ${item.difficulty}`)
  const ref = item.ref || {}
  if (ref.name) lines.push(`Referência: ${ref.name}, p. ${ref.page || 1}`)
  return lines.join('\n')
}

function discardedText(reason) {
  if (reason === 'invalid') return 'O card ficou sem questão. Nada foi gravado. Não repita neste turno.'
  return 'O aluno descartou o card. Nada foi gravado. Não repita neste turno.'
}

function pendingText(reason) {
  if (reason === 'session') return 'A sessão mudou antes da resposta. Nada foi gravado. Não repita neste turno.'
  if (reason === 'window') return 'A janela da Mesa fechou. Nada foi gravado. Não repita neste turno.'
  if (reason === 'cancelled') return 'O turno foi interrompido. O diálogo continua aberto para o aluno: o card só entra se ele aprovar. Não proponha de novo neste turno.'
  return 'O aluno ainda não respondeu. O diálogo continua aberto: o card só entra se ele aprovar. Não proponha de novo neste turno.'
}
