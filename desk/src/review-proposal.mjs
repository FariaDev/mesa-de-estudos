/* Decisão do diálogo quando o tutor propõe um card. A interface mede o que o
   aluno fez; quem deixa o card entrar no caderno é `proposalEnters` no núcleo. */

/**
 * O que o fechamento do diálogo significa para o host.
 * `ok` sem campo editado é aprovação; `ok` com campo sujo é edição; o resto
 * (cancelar, Esc, Descartar) não grava.
 * @param {{returnValue?: string, dirty?: boolean}} [input]
 * @returns {'approved' | 'edited' | 'discarded'}
 * @example proposalDecision({returnValue: 'ok', dirty: true}) // 'edited'
 */
export function proposalDecision({returnValue, dirty} = {}) {
  if (returnValue !== 'ok') return 'discarded'
  return dirty ? 'edited' : 'approved'
}

/**
 * Abre o diálogo de revisão com o card do tutor. Com o diálogo já aberto (o
 * aluno no meio de outro card), responde `busy` e não troca nada. A referência
 * é a página aberta, nunca um caminho que o modelo tenha mandado.
 * @param {HTMLDialogElement|null} dialog
 * @param {{id?: string, question?: string, attempt?: string, difficulty?: string}} payload
 * @param {{fill: (options: object) => unknown, openRef: () => object, respond?: (answer: object) => Promise<unknown>, t: (key: string) => string}} deps
 * @example showProposal(dialogOf(), {id: 'p1', question: 'Por que N = P cos θ?'}, {fill, openRef, respond, t})
 */
export function showProposal(dialog, payload, {fill, openRef, respond, t}) {
  const id = String(payload?.id || '')
  if (!dialog || dialog.open) {
    respond?.({id, status: 'busy'}).catch(() => {})
    return
  }
  /* Uma falha antes do diálogo abrir ainda tem de responder ao host: sem a
     resposta ele espera o prazo e recusa as propostas seguintes como `busy`.
     O erro é relançado para não sumir. */
  try {
    const ref = openRef()
    const item = {question: String(payload?.question || ''), attempt: String(payload?.attempt || ''), difficulty: String(payload?.difficulty || ''), ref}
    fill({mode: 'add', item, ref})
    Object.assign(dialog, {_mode: 'proposal', _proposalId: id, _proposalSilent: false, returnValue: ''})
    const form = dialog.querySelector('#review-form')
    const lead = document.createElement('p')
    lead.id = 'review-proposal-lead'
    lead.className = 'help-lead'
    lead.textContent = t('review.proposal.lead')
    form?.querySelector('#review-ref')?.before(lead)
    const cancel = form?.querySelector('button[value="cancel"]')
    if (cancel) cancel.textContent = t('review.proposal.discard')
    dialog.showModal()
  } catch (error) {
    dialog._proposalId = ''
    respond?.({id, status: 'discarded'}).catch(() => {})
    throw error
  }
}

/**
 * O host desistiu da proposta (janela, sessão, saída): fecha sem responder de novo.
 * @param {HTMLDialogElement|null} dialog
 * @param {{id?: string}} payload
 * @example silenceProposal(dialogOf(), {id: 'p1'})
 */
export function silenceProposal(dialog, payload) {
  if (!dialog || dialog._proposalId !== payload?.id) return
  dialog._proposalSilent = true
  if (dialog.open) dialog.close()
}

/**
 * Fechou o diálogo de uma proposta: manda a decisão ao host, que é quem grava.
 * @param {HTMLDialogElement} dialog
 * @param {object} item o card como ficou no formulário
 * @param {{respond?: (answer: object) => Promise<any>, toast: (text: string) => void, message: (key: string) => string, onItems: (items: object[]) => void}} deps
 * @example finishProposal(dialog, formItem(dialog), {respond, toast, message, onItems})
 */
export function finishProposal(dialog, item, {respond, toast, message, onItems}) {
  const id = dialog._proposalId
  const silent = dialog._proposalSilent === true
  dialog._proposalId = ''
  dialog._proposalSilent = false
  if (silent || !id || typeof respond !== 'function') return
  const status = proposalDecision({returnValue: dialog.returnValue, dirty: (dialog._dirty?.size || 0) > 0})
  respond({id, status, item}).then((result) => {
    if (result?.ok && Array.isArray(result.items)) onItems(result.items)
    if (!result || result.stale) return
    if (result.ok && (status === 'approved' || status === 'edited')) toast(message(status === 'edited' ? 'review.updated' : 'review.saved'))
    else if (!result.ok && result.error) toast(result.error)
  }).catch((error) => toast(error.message))
}
