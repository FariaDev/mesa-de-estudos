// @ts-check

/* Modelo padrão da sessão nova (#release OpenCode): estado de interface, fora do
   `config.json`, com modelo e esforço juntos. */

/**
 * Lê o modelo padrão escolhido para sessão nova (estado de interface, fora do
 * `config.json`). O esforço vai junto; sem modelo, não há padrão.
 * `normalizeModelDefault({provider: 'opencode', id: 'big-pickle', effort: 'high'})`
 * → `{provider: 'opencode', id: 'big-pickle', effort: 'high'}`
 * @param {unknown} raw
 * @returns {{provider: string, id: string, effort: string}|null}
 */
export function normalizeModelDefault(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const source = /** @type {{provider?: unknown, id?: unknown, effort?: unknown}} */ (raw);
  const provider = typeof source.provider === 'string' ? source.provider.trim() : '';
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const effort = typeof source.effort === 'string' ? source.effort.trim().slice(0, 24) : '';
  if (!provider || !id || provider.length > 100 || id.length > 200) return null;
  return {provider, id, effort};
}

/**
 * Liga ou desliga o modelo padrão de sessão nova. A mesma ação desfaz: a linha
 * que já é padrão volta a "OpenCode default".
 * `toggleModelDefault(null, 'opencode', 'big-pickle', 'high')`
 * → `{provider: 'opencode', id: 'big-pickle', effort: 'high'}`
 * @param {{provider: string, id: string, effort: string}|null} current
 * @param {string} provider @param {string} id @param {string} [effort]
 * @returns {{provider: string, id: string, effort: string}|null}
 */
export function toggleModelDefault(current, provider, id, effort = '') {
  if (current && current.provider === provider && current.id === id) return null;
  return normalizeModelDefault({provider, id, effort});
}

