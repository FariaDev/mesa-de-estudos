import test from 'node:test';
import assert from 'node:assert/strict';
import {needsApproval, matches, DISK_TOOLS} from '../src/extensions/mcp-policy/lib.mjs';

test('approveTools preserva confirmações por servidor, inclusive chamadas aninhadas', () => {
 const servers = {'apple-mail': {approveTools: ['send-*', 'delete-*', 'batch-delete-*']}};
 assert.equal(needsApproval('mcp__apple-mail__send-email', servers), true);
 assert.equal(needsApproval('mcp__apple-mail__batch-delete-emails', servers), true);
 assert.equal(needsApproval('mcp__apple-mail__search-emails', servers), false);
 assert.equal(needsApproval('mcp__other__send-email', servers), false);
 assert.equal(needsApproval('codemode', servers), false);
});
test('patterns usam glob, não expressões regulares nem prefixos soltos', () => {
 assert.equal(matches('send-*', 'send-email'), true);
 assert.equal(matches('send-*', 'resend-email'), false);
 assert.equal(matches('a.b*', 'axb'), false);
 assert.equal(matches('a.b*', 'a.bcd'), true);
 assert.equal(matches(42, 'send-email'), false);
});
test('o recorte de disco/shell inclui todos os nomes excluídos pela Conversa', () => {
 for (const name of ['bash', 'powershell', 'read', 'write', 'edit', 'grep', 'find', 'ls']) assert.ok(DISK_TOOLS.has(name));
 assert.equal(DISK_TOOLS.has('mcp__obsidian__read-note'), false);
});
