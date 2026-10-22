/* Instrução da ferramenta de PDF do tutor — UM texto para as duas ferramentas
   (extensão do Pi `mesa_criar_pdf` e `criar_pdf` do Claude): mudam juntas.
   Os ids dos modelos e as chaves de opção são os de `core/materialmodel.bend`
   (o teste `tutor-materials.test.mjs` confere que não divergem). */

import {PDF_FIGURE_GUIDE} from '../mesa-figure/guide.mjs';

export const MODEL_IDS = ['lista', 'apostila', 'resumo', 'simulado', 'formulario', 'livre'];
export const SPACE_CHOICES = ['pequeno', 'medio', 'grande'];

const BASE = 'Prepare o conteúdo do PDF quando o usuário pedir um material em PDF. Envie o título e o conteúdo completo em Markdown/LaTeX (sem cercas externas). A Mesa preenche o diálogo editável com prévia. O usuário revisa, pode trocar o modelo e clica em Salvar PDF e abrir para gerar o arquivo. Não peça ao usuário para copiar o texto ou montar o PDF manualmente. O resultado confirma apenas que o conteúdo está preparado para revisão; o PDF ainda não está salvo: depois, diga que o material está pronto para revisar no diálogo, nunca que o PDF já foi salvo.';

const MODELS = [
  'Escolha o aspecto do PDF com `modelo` (opcional):',
  '- lista — lista de exercícios (use para "faz uma lista de exercícios"). Cada enunciado é um item da lista numerada de primeiro nível ("1. Enunciado"); os itens de um enunciado são uma lista numerada aninhada, recuada, ("   1. $x+1$"), que sai em colunas. Termine com um título "## Gabarito" seguido das respostas numeradas.',
  '- apostila — texto corrido de livro, justificado. Seções em "## 2. Título"; definições e teoremas como parágrafo começando em negrito ("**Definição 2.1.** *enunciado em itálico*"; também Teorema, Proposição, Lema, Corolário); exemplos como "**Exemplo 03:** …"; equações de display em $$…$$ (a Mesa numera por seção); tabelas em Markdown.',
  '- resumo — revisão de uma página. "**A ideia.** …" abre; "**Regra.** …" vai num quadro; "## Exemplo resolvido" com passos numerados; "## Erros comuns" e "## Para revisar" com marcadores (saem lado a lado).',
  '- simulado — prova. Cada questão é um título "## Questão N (valor)" seguido do enunciado; a Mesa desenha o quadro Nome/Data/Nota (não escreva) e a caixa de resposta. Múltipla escolha: itens "- ( ) alternativa" (sem caixa de resposta). Questão de resposta longa: "## Questão N (valor) {longa}" (caixa maior). Termine com "## Gabarito" e as respostas comentadas.',
  '- formulario — folha de fórmulas. Primeira linha: a convenção ("Em toda a folha, $u=f(x)$ e $u\'=f\'(x)$."); seções em "## Título"; fórmulas em listas numeradas (a numeração continua entre as seções, para citar "a 13").',
  '- livre — sem modelo: o Markdown sai como foi escrito.',
  'Escolha o modelo pelo pedido; sem um pedido claro, deixe `modelo` de fora: a Mesa usa o último modelo que o usuário escolheu nesta matéria (ou livre, se não houver).',
];

const OPTIONS = [
  'Ajustes do modelo em `opcoes` (envie só o que importa; o resto fica no padrão):',
  '- colunas: "auto", 1, 2 ou 3 — itens da lista (lista) ou fórmulas (formulario; auto/2/3). Auto mede o item mais largo.',
  '- gabarito (lista, simulado): true põe o gabarito em página separada; rodape (lista): texto do rodapé.',
  '- equacoes (apostila): numerar equações; recuo (apostila): recuo de parágrafo; capitulo (apostila): texto do cabeçalho corrente.',
  '- regra, revisao (resumo): quadro da regra e blocos Erros comuns/Para revisar.',
  '- valor (simulado): mostrar o valor das questões; espaco: "pequeno", "medio" ou "grande" (espaço para responder).',
  '- umafolha (formulario): caber numa folha.',
];

export const TOOL_DESCRIPTION = `${BASE}\n\n${MODELS.join('\n')}\n\n${OPTIONS.join('\n')}\n\n${PDF_FIGURE_GUIDE}`;

/* Os nomes dos modelos e das opções já estão no esquema e na descrição. */
export const MODEL_PARAM = 'Modelo do PDF (veja a lista na descrição). Opcional.';
export const OPTIONS_PARAM = 'Ajustes do modelo; envie só o que importa. Opcional.';

/* Campos da ferramenta (`tool-fields.mjs` monta o zod do Claude e o TypeBox do Pi). */
const flag = {type: 'boolean', optional: true};
export const OPTION_FIELDS = {
  colunas: {type: 'anyOf', of: [{type: 'literal', value: 'auto'}, {type: 'integer', min: 1, max: 3}], optional: true},
  gabarito: flag,
  rodape: {type: 'string', max: 80, optional: true},
  equacoes: flag,
  recuo: flag,
  capitulo: {type: 'string', max: 80, optional: true},
  regra: flag,
  revisao: flag,
  valor: flag,
  espaco: {type: 'enum', values: SPACE_CHOICES, optional: true},
  umafolha: flag,
};
export const OPTION_KEYS = Object.keys(OPTION_FIELDS);
export const FIELDS = {
  title: {type: 'string', min: 1, max: 120, trim: true},
  markdown: {type: 'string', min: 1, max: 262144},
  modelo: {type: 'enum', values: MODEL_IDS, optional: true, description: MODEL_PARAM},
  opcoes: {type: 'object', fields: OPTION_FIELDS, optional: true, description: OPTIONS_PARAM},
};

/* Resultado devolvido ao tutor: o que a Mesa escolheu e por quê. */
export function resultText(result) {
  const errors = Array.isArray(result && result.diagnostics) ? result.diagnostics.filter((entry) => entry && entry.severity === 'error') : [];
  if (errors.length) {
    return `O material “${result.title}” ficou no diálogo, mas há ${errors.length} equação(ões) com erro de sintaxe. Corrija e reenvie: ${errors[0].message}`;
  }
  const model = result && result.model && result.model !== 'livre' ? ` no modelo ${result.model}` : '';
  return `Material “${result.title}” preparado${model} no diálogo de PDF. O usuário pode revisar, trocar o modelo e clicar em Salvar PDF e abrir; o arquivo ainda não foi salvo.`;
}
