/* Instrução da ferramenta de PDF do tutor — UM texto para as duas ferramentas
   (extensão do Pi `mesa_criar_pdf` e `criar_pdf` do Claude): mudam juntas.
   Descrição e campos são SEMPRE em inglês; o resultado (`resultText`) segue
   como estava, em português. Os ids dos modelos e as chaves de opção são os de
   `core/materialmodel.bend` (o teste `tutor-materials.test.mjs` confere que não
   divergem). */

import {PDF_FIGURE_GUIDE} from '../mesa-figure/guide.mjs';

export const MODEL_IDS = ['lista', 'apostila', 'resumo', 'simulado', 'formulario', 'livre'];
export const SPACE_CHOICES = ['pequeno', 'medio', 'grande'];

const BASE = 'Prepare the PDF content when the user asks for a PDF material. Send the title and the complete content in Markdown/LaTeX (without outer fences). The desk fills the editable dialog with a preview. The user reviews it, can change the model and clicks Save PDF and open to generate the file. Do not ask the user to copy the text or build the PDF by hand. The result only confirms the content is ready for review; the PDF is not saved yet: afterwards, say the material is ready to review in the dialog, never that the PDF has already been saved.';

const MODELS = [
  'Choose the PDF look with `modelo` (optional):',
  '- lista — exercise list (use for "make an exercise list"). Each statement is a top-level numbered item ("1. Statement"); its sub-items are a nested indented numbered list ("   1. $x+1$"), rendered in columns. End with "## Gabarito" and the numbered answers.',
  '- apostila — running book text, justified. Sections in "## 2. Title"; definitions and theorems as a paragraph starting bold ("**Definição 2.1.** *statement*"; also Teorema, Proposição, Lema, Corolário); examples as "**Exemplo 03:** …"; display equations in $$…$$ (the desk numbers them by section); Markdown tables.',
  '- resumo — one-page review. "**A ideia.** …" opens; "**Regra.** …" goes in a box; "## Exemplo resolvido" with numbered steps; "## Erros comuns" and "## Para revisar" with bullets, side by side.',
  '- simulado — exam. Each question is a "## Questão N (valor)" heading followed by the statement; the desk draws the Nome/Data/Nota box (do not write it) and the answer box. Multiple choice: "- ( ) alternative" items (no answer box). Long answer: "## Questão N (valor) {longa}" (larger box). End with "## Gabarito" and the commented answers.',
  '- formulario — formula sheet. First line: the convention ("Em toda a folha, $u=f(x)$ e $u\'=f\'(x)$."); sections in "## Title"; formulas in numbered lists (numbering continues across sections, so you can cite "a 13").',
  '- livre — no model: the Markdown comes out as written.',
  'Choose the model from the request; without a clear request, leave `modelo` out: the desk uses the last model the user chose in this course (or livre, if none).',
];

const OPTIONS = [
  'Model adjustments in `opcoes` (send only what matters; the rest stays at the default):',
  '- colunas: "auto", 1, 2 or 3 — list items (lista) or formulas (formulario; auto/2/3). Auto measures the widest item.',
  '- gabarito (lista, simulado): true puts the answer key on its own page; rodape (lista): footer text.',
  '- equacoes (apostila): number equations; recuo (apostila): paragraph indent; capitulo (apostila): running header.',
  '- regra, revisao (resumo): rule box and Erros comuns/Para revisar blocks.',
  '- valor (simulado): show the question value; espaco: "pequeno", "medio" or "grande" (answer space).',
  '- umafolha (formulario): fit on one page.',
];

export const TOOL_DESCRIPTION = `${BASE}\n\n${MODELS.join('\n')}\n\n${OPTIONS.join('\n')}\n\n${PDF_FIGURE_GUIDE}`;

/* Os nomes dos modelos e das opções já estão no esquema e na descrição. */
export const MODEL_PARAM = 'PDF model (see the list in the description). Optional.';
export const OPTIONS_PARAM = 'Model adjustments; send only what matters. Optional.';

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
