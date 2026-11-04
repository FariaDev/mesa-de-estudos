'use strict';

/* A lista única das extensões da Mesa carregadas pelo Pi, para o app não
   divergir do medidor nem do teste de paridade (auditoria das ferramentas,
   M5). `mesa-pdf` e `mesa-search` estão em toda sessão (`ler_pdf` e
   `buscar_material`); as demais só na principal.
   A ordem é a de carregamento no Pi. */

const path = require('node:path');

const MESA_READER_EXTENSIONS = ['mesa-pdf', 'mesa-search', 'mesa-calc', 'mesa-materials'];
const MESA_CARD_EXTENSIONS = ['mesa-quiz', 'mesa-perguntar'];
const MESA_MATERIAL_EXTENSIONS = ['tutor-pdf', 'mesa-activity', 'mesa-figure', 'mesa-review', 'mesa-geogebra', 'mesa-notes', ...MESA_CARD_EXTENSIONS];
const MESA_EXTENSIONS = [...MESA_READER_EXTENSIONS, ...MESA_MATERIAL_EXTENSIONS];
/* Nomes de ferramenta do Pi (`--tools`) na mesma ordem do carregamento. O
   allowlist da sessão principal é este; o chat lateral usa só os de leitura,
   cálculo e lista. */
const MESA_READER_TOOL_NAMES = ['mesa_ler_pdf', 'mesa_buscar_material', 'mesa_calcular', 'mesa_listar_materiais'];
const MESA_CARD_TOOL_NAMES = ['mesa_quiz', 'mesa_perguntar'];
const MESA_MATERIAL_TOOL_NAMES = ['mesa_criar_pdf', 'mesa_criar_atividade', 'mesa_previsualizar_atividade', 'mesa_ver_figura', 'mesa_propor_revisao', 'mesa_geogebra', 'mesa_salvar_nota', ...MESA_CARD_TOOL_NAMES];

/**
 * Caminhos das extensões da Mesa para a linha de comando do Pi.
 * @param {string} deskDir pasta `desk` do app
 * @param {{material?: boolean, cards?: boolean}} [options] `material: false` deixa só leitura e busca (chat lateral); `cards` acrescenta quiz/perguntar ao lateral
 * @returns {string[]}
 * @example mesaExtensionPaths('/app/desk', {material: false}) // ['/app/desk/src/extensions/mesa-pdf', '/app/desk/src/extensions/mesa-search']
 */
function mesaExtensionPaths(deskDir, {material = true, cards = false} = {}) {
  const names = material ? MESA_EXTENSIONS : [...MESA_READER_EXTENSIONS, ...(cards ? MESA_CARD_EXTENSIONS : [])];
  return names.map((name) => path.join(deskDir, 'src', 'extensions', name));
}

/**
 * Nomes das ferramentas da Mesa para o `--tools` do Pi.
 * @param {{material?: boolean, cards?: boolean}} [options] `material: false` deixa só a sessão lateral; `cards` acrescenta quiz/perguntar
 * @returns {string[]}
 * @example mesaToolNames({material: false}) // ['mesa_ler_pdf', 'mesa_buscar_material', 'mesa_calcular', 'mesa_listar_materiais']
 */
function mesaToolNames({material = true, cards = false} = {}) {
  return material ? [...MESA_READER_TOOL_NAMES, ...MESA_MATERIAL_TOOL_NAMES] : [...MESA_READER_TOOL_NAMES, ...(cards ? MESA_CARD_TOOL_NAMES : [])];
}

module.exports = {MESA_READER_EXTENSIONS, MESA_CARD_EXTENSIONS, MESA_MATERIAL_EXTENSIONS, MESA_EXTENSIONS, MESA_READER_TOOL_NAMES, MESA_CARD_TOOL_NAMES, MESA_MATERIAL_TOOL_NAMES, mesaExtensionPaths, mesaToolNames};
