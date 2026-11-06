/* Medidor de prompts (auditoria M5): ele precisa montar as MESMAS ferramentas
   que cada motor registra de verdade. O Claude sai do servidor MCP real, o
   OpenCode do `mesaTools` real e o Pi do SDK instalado (pulado sem ele). Sem
   rede, login ou modelo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {claudeTools, measure, openCodeTools} from '../scripts/measure-prompts.mjs';

const CLAUDE_TOOLS = [
  'mcp__mesa__buscar_material', 'mcp__mesa__calcular', 'mcp__mesa__criar_atividade', 'mcp__mesa__criar_pdf', 'mcp__mesa__geogebra', 'mcp__mesa__ler_pdf',
  'mcp__mesa__listar_materiais', 'mcp__mesa__perguntar', 'mcp__mesa__previsualizar_atividade', 'mcp__mesa__propor_revisao', 'mcp__mesa__quiz', 'mcp__mesa__salvar_nota', 'mcp__mesa__ver_figura',
];
const OPENCODE_TOOLS = [
  'buscar_material', 'calcular', 'criar_atividade', 'criar_pdf', 'geogebra', 'ler_pdf', 'listar_materiais', 'perguntar', 'previsualizar_atividade', 'propor_revisao', 'quiz', 'salvar_nota', 'ver_figura',
];

test('M5: o Claude é medido com as treze ferramentas do servidor MCP real', async () => {
  assert.deepEqual((await claudeTools()).map((tool) => tool.name).sort(), CLAUDE_TOOLS);
});

test('M5: o OpenCode é medido no principal (treze) e no lateral (seis, com quiz e perguntar)', async () => {
  const tools = await openCodeTools();
  assert.deepEqual(tools.main.map((tool) => tool.name).sort(), OPENCODE_TOOLS);
  assert.deepEqual(tools.side.map((tool) => tool.name), ['calcular', 'ler_pdf', 'buscar_material', 'listar_materiais', 'quiz', 'perguntar']);
});

test('M5: o relatório mede a seção OpenCode', async () => {
  const data = await measure();
  assert.deepEqual(Object.keys(data.opencode.tools).sort(), OPENCODE_TOOLS);
  assert.deepEqual(Object.keys(data.opencode.sideTools), ['calcular', 'ler_pdf', 'buscar_material', 'listar_materiais', 'quiz', 'perguntar']);
  assert.ok(data.opencode.prefixCourse.tokens > data.opencode.toolsTotal.tokens);
  assert.ok(data.opencode.prefixSidechat.tokens > data.opencode.sideToolsTotal.tokens);
});
