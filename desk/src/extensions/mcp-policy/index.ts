import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getAgentDir, type ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {needsApproval} from './lib.mjs';

export default function mcpPolicy(pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    if (!event.toolName.startsWith('mcp__')) return;
    // Relê a cada chamada: /mcp pode alterar a configuração durante a sessão.
    let servers = {};
    const files = [join(getAgentDir(), 'mcp.json')];
    if (ctx.isProjectTrusted()) files.push(join(ctx.cwd, '.pi', 'mcp.json'));
    for (const file of files) {
      try {
        servers = {...servers, ...JSON.parse(readFileSync(file, 'utf8')).mcpServers};
      } catch (error: any) {
        if (error.code !== 'ENOENT') return {block: true, reason: 'Não consegui ler a política MCP; confira mcp.json antes de tentar novamente.'};
      }
    }
    if (!needsApproval(event.toolName, servers)) return;
    const confirmed = ctx.hasUI && await ctx.ui.confirm(
      'Confirmar ação MCP',
      `${event.toolName}\n\n${JSON.stringify(event.input, null, 2)}`,
    );
    if (!confirmed) return {block: true, reason: 'Ação MCP não confirmada pelo usuário; nada foi executado.'};
  });
}
