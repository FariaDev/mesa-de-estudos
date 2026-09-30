// Compatibilidade com a política approveTools do adapter. O transporte é nativo.
export function matches(pattern, name) {
  if (typeof pattern !== 'string') return false;
  const escaped = pattern.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}$`).test(name);
}

export function needsApproval(toolName, servers) {
  for (const [server, config] of Object.entries(servers || {})) {
    const prefix = `mcp__${server}__`;
    if (!toolName.startsWith(prefix)) continue;
    const name = toolName.slice(prefix.length);
    return Array.isArray(config?.approveTools) && config.approveTools.some(p => matches(p, name));
  }
  return false;
}

export const DISK_TOOLS = new Set(['bash', 'powershell', 'read', 'write', 'edit', 'grep', 'find', 'ls']);
