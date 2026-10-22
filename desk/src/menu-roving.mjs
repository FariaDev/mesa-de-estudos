/* Setas nos menus da barra superior (#67): o padrão de menu do WAI-ARIA, sem
   estado — quem chama lê os itens visíveis e foca o índice devolvido. */

const MENU_STEP_KEYS = Object.freeze(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * Próximo item focado de um menu, dada a tecla. As setas dão a volta; Home e
 * End vão às pontas. Tecla que não navega devolve `null`.
 * @param {string} key `KeyboardEvent.key`
 * @param {number} index item focado agora (-1 quando o foco está fora do menu)
 * @param {number} count itens visíveis e habilitados
 * @returns {number|null}
 * @example menuStep('ArrowDown', 2, 3) // 0
 */
function menuStep(key, index, count) {
  if (!Number.isInteger(count) || count < 0) throw new TypeError(`menuStep: count ${count}, esperado inteiro ≥ 0`);
  if (!MENU_STEP_KEYS.includes(key) || count === 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return index < 0 ? 0 : (index + 1) % count;
  return index < 0 ? count - 1 : (index - 1 + count) % count;
}

export {menuStep};
