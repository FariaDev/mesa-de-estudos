/* O prompt do tutor não é fala do aluno. O OpenCode antigo o colava no
 * primeiro (e, às vezes, num) envio; ao reler a sessão ele voltava como bolha.
 * Os três motores passam por aqui na hora de mostrar ou de guardar o histórico.
 * Módulo .mjs: o renderer importa direto (a CSP da janela bloqueia `node:`). */

export const OPEN_MARK = '[[mesa-tutor-prompt]]';
export const CLOSE_MARK = '[[/mesa-tutor-prompt]]';
/** Abertura estável de `deskBasePrompt` — vale mesmo se o resto do prompt mudou. */
export const TUTOR_OPENING = 'Você é o tutor da Mesa de Estudos:';

/* Parágrafos que só existem nas instruções (base, motor, oferta, perfil, transcrição). */
const INSTRUCTION_STARTS = [
  TUTOR_OPENING,
  'Gráfico de função, pontos ou retas',
  /* Motor antes do sandbox e depois dele (#78): históricos antigos ainda trazem o primeiro. */
  'Você não edita arquivos',
  'Você não executa comandos',
  'Quando a resposta depender de uma página de PDF',
  'Você pode ler, editar, criar arquivos',
  'Você pode ler, criar e editar arquivos',
  'Mostre tudo nesta conversa',
  'Os caminhos de PDF',
  'Cite um PDF',
  'Este chat lateral',
  'Além do texto, você pode oferecer:',
  'Ofereça quando ajudar o aluno a avançar',
  'LEARNER.md',
  'Transcrição importada para continuar este estudo',
];

/**
 * Prefixo marcado para o servidor que não tem canal de instruções.
 * O marcador volta no histórico e sai na leitura, mesmo se o texto do prompt mudar.
 * @param {string} prompt
 * @param {string} text fala do aluno
 * @returns {string}
 * @example markTutorPrompt('Você é o tutor da Mesa de Estudos: …', 'oi') // '[[mesa-tutor-prompt]]\n…'
 */
export function markTutorPrompt(prompt, text) {
  return `${OPEN_MARK}\n${String(prompt || '').trim()}\n${CLOSE_MARK}\n\n${text}`;
}

/** @param {string} text */
function stripMarks(text) {
  if (!text.includes(OPEN_MARK)) return text;
  let out = '';
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf(OPEN_MARK, cursor);
    if (start < 0) return out + text.slice(cursor);
    out += text.slice(cursor, start);
    /* Sem fechamento, o resto da mensagem não é do prompt: fica como está. */
    const end = text.indexOf(CLOSE_MARK, start + OPEN_MARK.length);
    if (end < 0) return out + text.slice(start);
    cursor = end + CLOSE_MARK.length;
  }
  return out;
}

/** @param {string} text @param {string} prompt */
function stripExactPrompt(text, prompt) {
  const body = String(prompt || '').trim();
  if (!body) return text;
  const trimmed = text.trimStart();
  if (trimmed === body) return '';
  if (!trimmed.startsWith(body)) return text;
  return trimmed.slice(body.length).replace(/^\s+/, '');
}

/** @param {string} part */
function instructionParagraph(part) {
  const line = String(part || '').trim();
  if (!line) return true;
  if (INSTRUCTION_STARTS.some((start) => line.startsWith(start))) return true;
  if (/^(user|assistant):\s/.test(line)) return true;
  if (line.startsWith('- quando um erro')) return true;
  return false;
}

/* Roda inicial de parágrafos de instrução. A fala do aluno, quando veio colada
 * com `\n\n`, fica depois. Um prompt que mudou uma frase continua começando
 * pela abertura estável, então a comparação byte a byte não é a única via. */
function stripInstructionRun(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith(TUTOR_OPENING)) return text;
  const parts = trimmed.split('\n\n');
  let index = 0;
  while (index < parts.length && instructionParagraph(parts[index])) index += 1;
  if (!index) return text;
  return parts.slice(index).join('\n\n').trim();
}

/**
 * Tira o prompt do tutor de um texto de usuário. Sem sobra, devolve vazio
 * (a bolha não nasce). `prompt` é o texto atual; a abertura estável cobre o que divergiu.
 * @param {unknown} text
 * @param {string} [prompt]
 * @returns {string}
 * @example withoutTutorPrompt('[[mesa-tutor-prompt]]\nVocê é o tutor da Mesa de Estudos: …\n[[/mesa-tutor-prompt]]\n\noi', '') // 'oi'
 */
export function withoutTutorPrompt(text, prompt = '') {
  if (typeof text !== 'string' || !text) return '';
  const marked = text.includes(OPEN_MARK);
  const stripped = stripInstructionRun(stripExactPrompt(stripMarks(text), prompt));
  /* O prefixo marcado deixa as quebras que o separavam da fala. A fala crua não se apara. */
  return marked || stripped !== text ? stripped.trim() : stripped;
}

/**
 * Histórico de exibição sem a bolha que era só o prompt. Vale para qualquer mensagem
 * de usuário, não só a primeira — um envio posterior também recebia o prefixo.
 * @param {Array<{role?: string, content?: Array<{type?: string, text?: string}>}>} list
 * @param {string} [prompt]
 * @returns {typeof list}
 * @example visibleHistory([{role:'user', content:[{type:'text', text:'Você é o tutor da Mesa de Estudos: …'}]}], '') // []
 */
export function visibleHistory(list, prompt = '') {
  const out = [];
  for (const message of list || []) {
    if (!message || message.role !== 'user') {
      out.push(message);
      continue;
    }
    const content = userContentWithoutPrompt(message.content, prompt);
    if (content.length) out.push({...message, content});
  }
  return out;
}

/** @param {Array<{type?: string, text?: string}>|undefined} content @param {string} prompt */
export function userContentWithoutPrompt(content, prompt) {
  const out = [];
  for (const part of Array.isArray(content) ? content : []) {
    if (!part || part.type !== 'text' || typeof part.text !== 'string') {
      if (part) out.push(part);
      continue;
    }
    const text = withoutTutorPrompt(part.text, prompt);
    if (text) out.push({...part, text});
  }
  return out;
}


