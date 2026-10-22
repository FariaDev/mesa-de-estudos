// @ts-check
/* A lista do seletor de modelo (#59), a parte pura: agrupar por provedor,
   pôr os recentes no topo e os grátis num grupo próprio, filtrar pela busca e
   andar pelo índice ativo. Nada aqui toca o DOM nem o idioma: o desenho da lista
   é de `model-picker-ui.mjs`, e o texto das linhas chega por `label`.
   É interface, então fica em JS com teste, não em Bend (ADR 0001). */

/** @typedef {{name?: string, id: string, provider: string, free?: {is?: boolean, tail?: string[]}, contextWindow?: number, input?: string[], reasoning?: boolean, cost?: {input?: number, output?: number}}} CatalogModel */
/** @typedef {{context: number, vision: boolean, reasoning: boolean, price: null | {input: number, output: number}}} ModelFacts o que o catálogo diz do modelo, para a segunda linha */
/** @typedef {{key: string, provider: string, id: string, name: string, vendor: string, short: string, providerName: string, free: boolean, zenPaid: boolean, favorite: boolean, notes: string[], facts: ModelFacts}} PickerItem */
/** @typedef {{vendor: string, items: PickerItem[]}} PickerSection subgrupo por fabricante de um provedor grande */
/** @typedef {{kind: 'favorite' | 'recent' | 'free' | 'provider' | 'flat', provider: string, title: string, items: PickerItem[], sections?: PickerSection[]}} PickerGroup */
/** @typedef {Record<string, Array<[string, string]>>} ModelPairs pares `[provedor, id]` por motor */
/** @typedef {ModelPairs} ModelRecents recentes por motor, do mais novo ao mais velho */
/** @typedef {ModelPairs} ModelFavorites favoritos por motor, na ordem em que foram marcados */

export const RECENT_LIMIT = 5;
/* Ajustes do seletor: o OpenRouter entrega centenas de modelos num provedor
   só. A partir daqui o grupo do provedor se divide por fabricante. */
export const SECTION_THRESHOLD = 20;
/* Nome sem diferença de caixa nem de acento, e "GPT 5" antes de "GPT 10". */
const NAME_ORDER = new Intl.Collator('pt-BR', {sensitivity: 'base', numeric: true});
/* Teto só contra arquivo editado à mão: ninguém marca 50 favoritos de verdade. */
export const FAVORITE_LIMIT = 50;

/* Id do catálogo → nome para o título do grupo. Um id que não está aqui
   aparece cru (`providerName`). */
const PROVIDER_NAMES = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI Codex',
  google: 'Google',
  'google-vertex': 'Google Vertex',
  xai: 'xAI',
  opencode: 'OpenCode Zen',
  'opencode-go': 'OpenCode Go',
  commandcode: 'Command Code',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  cerebras: 'Cerebras',
  mistral: 'Mistral',
  deepseek: 'DeepSeek',
  'github-copilot': 'GitHub Copilot',
  'amazon-bedrock': 'Amazon Bedrock',
  'azure-openai-responses': 'Azure OpenAI',
  zai: 'Z.AI',
  minimax: 'MiniMax',
  huggingface: 'Hugging Face',
});

/**
 * O nome do provedor para o título do grupo; id desconhecido volta cru.
 * `providerName('xai')` → `'xAI'`; `providerName('meu-provedor')` → `'meu-provedor'`
 * @param {string} id
 * @returns {string}
 */
export function providerName(id) {
  return Object.hasOwn(PROVIDER_NAMES, id) ? PROVIDER_NAMES[/** @type {keyof typeof PROVIDER_NAMES} */ (id)] : id;
}

/* "Fabricante: Modelo" é o formato dos nomes do OpenRouter. O prefixo tem de
   ser curto e sem dois-pontos, para um nome que só tem ":" no meio (raro, mas
   possível) não perder pedaço. */
const VENDOR_PREFIX = /^([^:]{1,40}):\s+(\S.*)$/u;

/**
 * Separa o fabricante do nome no formato do OpenRouter; sem prefixo, `vendor`
 * vem vazio e `model` é o nome inteiro.
 * `splitVendor('DeepSeek: DeepSeek V4.1 Flash')` → `{vendor: 'DeepSeek', model: 'DeepSeek V4.1 Flash'}`
 * @param {string} name
 * @returns {{vendor: string, model: string}}
 */
export function splitVendor(name) {
  const text = String(name ?? '').trim();
  const hit = VENDOR_PREFIX.exec(text);
  return hit ? {vendor: hit[1].trim(), model: hit[2].trim()} : {vendor: '', model: text};
}

/**
 * O nome curto do modelo para o indicador da fileira: sem o "Fabricante: ".
 * `shortModelName('Qwen: Qwen3.5 32B')` → `'Qwen3.5 32B'`; `shortModelName('Pi de teste')` → `'Pi de teste'`
 * @param {string} name
 * @returns {string}
 */
export function shortModelName(name) {
  return splitVendor(name).model;
}

/**
 * A chave de uma linha: a mesma `[provedor, id]` em JSON que o host entende.
 * `modelKey('anthropic', 'sonnet')` → `'["anthropic","sonnet"]'`
 * @param {string} provider
 * @param {string} id
 * @returns {string}
 */
export function modelKey(provider, id) {
  return JSON.stringify([provider, id]);
}

/**
 * Minúsculas e sem acento, para a busca achar "gratis" em "Grátis".
 * `foldSearch('  Grátis ')` → `'gratis'`
 * @param {string} value
 * @returns {string}
 */
export function foldSearch(value) {
  return String(value).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
}

/**
 * A linha da lista a partir de um modelo do catálogo. O primeiro item da cauda
 * do grátis é a marca "Grátis", que o título do grupo já diz; sobram a política
 * de dados e o aviso "pode ter saído".
 * @param {CatalogModel} model
 * @param {(raw: string) => string} label nome já no idioma da tela
 * @returns {PickerItem}
 */
function itemOf(model, label) {
  const free = model.free?.is === true;
  const tail = Array.isArray(model.free?.tail) ? model.free.tail : [];
  const name = label(model.name || model.id);
  const {vendor, model: short} = splitVendor(name);
  return {
    key: modelKey(model.provider, model.id),
    provider: model.provider,
    id: model.id,
    name,
    vendor,
    short,
    providerName: providerName(model.provider),
    free,
    zenPaid: model.provider === 'opencode' && model.free?.is === false,
    favorite: false,
    notes: free ? tail.slice(1) : [],
    facts: factsOf(model, free),
  };
}

/**
 * O que o catálogo já diz do modelo: janela de contexto, imagem na entrada,
 * raciocínio e o preço por milhão de tokens (só de pago com preço conhecido).
 * `factsOf({id: 'a', provider: 'p', contextWindow: 128000, input: ['text', 'image']}, false)`
 * → `{context: 128000, vision: true, reasoning: false, price: null}`
 * @param {CatalogModel} model
 * @param {boolean} free
 * @returns {ModelFacts}
 */
export function factsOf(model, free) {
  const context = Number(model.contextWindow);
  const input = Number(model.cost?.input), output = Number(model.cost?.output);
  const priced = !free && model.cost !== undefined && Number.isFinite(input) && Number.isFinite(output) && input + output > 0;
  return {
    context: Number.isFinite(context) && context > 0 ? context : 0,
    vision: Array.isArray(model.input) && model.input.includes('image'),
    reasoning: model.reasoning === true,
    price: priced ? {input, output} : null,
  };
}

/**
 * A janela de contexto em mil ou milhão, para o texto curto da linha.
 * `contextSize(131072)` → `{unit: 'K', value: 131}`; `contextSize(1048576)` → `{unit: 'M', value: 1}`
 * @param {number} tokens
 * @returns {{unit: 'K' | 'M', value: number}}
 */
export function contextSize(tokens) {
  if (tokens >= 1e6) return {unit: 'M', value: Math.round(tokens / 1e5) / 10};
  return {unit: 'K', value: Math.max(1, Math.round(tokens / 1e3))};
}

/**
 * Ordem por nome, sem caixa nem acento, com números em ordem natural; o id desempata.
 * `[{name: 'b', id: '1'}, {name: 'Á', id: '2'}].sort(byName)` → Á antes de b
 * @param {{name: string, id: string}} left
 * @param {{name: string, id: string}} right
 * @returns {number}
 */
export function byName(left, right) {
  return NAME_ORDER.compare(left.name, right.name) || NAME_ORDER.compare(left.id, right.id);
}

/**
 * Cada termo da busca tem de aparecer no nome, no id ou no provedor.
 * `matchesQuery(item, 'grok xai')` → `true` para o Grok do xAI
 * @param {PickerItem} item
 * @param {string} query
 * @returns {boolean}
 */
export function matchesQuery(item, query) {
  const terms = foldSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = foldSearch(`${item.name} ${item.id} ${item.providerName} ${item.provider}`);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Os pares guardados que ainda estão no catálogo, na ordem guardada, até
 * `limit`. Um recente ou favorito que saiu do catálogo não aparece.
 * @param {PickerItem[]} items todos os itens do catálogo
 * @param {Array<[string, string]>} pairs
 * @param {number} limit
 * @returns {PickerItem[]}
 */
function livePairs(items, pairs, limit) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const live = pairs.map(([provider, id]) => byKey.get(modelKey(provider, id))).filter((item) => item !== undefined);
  return live.slice(0, limit);
}

/**
 * Os grupos da lista, na ordem em que aparecem: Favoritos, Recentes, Grátis e
 * um por provedor (por nome, A–Z; dentro dele, a ordem do catálogo). O Claude
 * usa uma lista só, sem grupos, recentes nem favoritos. Com busca, Favoritos e
 * Recentes saem (as linhas já estão nos outros grupos) e grupos sem resultado
 * somem. Toda linha de um modelo favorito leva `favorite: true`, para a estrela.
 * @param {CatalogModel[]} catalog
 * @param {{engine?: string, query?: string, recents?: Array<[string, string]>, favorites?: Array<[string, string]>, label?: (raw: string) => string}} [options]
 * @returns {PickerGroup[]}
 * @example groupModels([{id: 'a', provider: 'xai'}], {engine: 'pi'}).map((g) => g.title) // ['xAI']
 */
export function groupModels(catalog, {engine = 'pi', query = '', recents = [], favorites = [], label = (raw) => raw} = {}) {
  const starred = new Set(favorites.map(([provider, id]) => modelKey(provider, id)));
  const all = catalog.map((model) => ({...itemOf(model, label), favorite: engine !== 'claude' && starred.has(modelKey(model.provider, model.id))}));
  const shown = all.filter((item) => matchesQuery(item, query));
  if (engine === 'claude') return shown.length ? [{kind: 'flat', provider: '', title: '', items: shown}] : [];
  const groups = [];
  const searching = query.trim() !== '';
  const favorite = searching ? [] : livePairs(all, favorites, FAVORITE_LIMIT);
  if (favorite.length) groups.push({kind: 'favorite', provider: '', title: '', items: favorite});
  const recent = searching ? [] : livePairs(all, recents, RECENT_LIMIT);
  if (recent.length) groups.push({kind: 'recent', provider: '', title: '', items: recent});
  const free = shown.filter((item) => item.free).sort(byName);
  if (free.length) groups.push({kind: 'free', provider: '', title: '', items: free});
  groups.push(...providerGroups(shown.filter((item) => !item.free)));
  return groups;
}

/**
 * Um grupo por provedor (A–Z) com as linhas por nome; o grande se divide por
 * fabricante (`sectionsOf`), e então `items` segue a ordem das seções.
 * @param {PickerItem[]} items
 * @returns {PickerGroup[]}
 */
function providerGroups(items) {
  /** @type {Map<string, PickerItem[]>} */
  const byProvider = new Map();
  for (const item of items) {
    const rows = byProvider.get(item.provider);
    if (rows) rows.push(item); else byProvider.set(item.provider, [item]);
  }
  return [...byProvider.entries()]
    .map(([provider, rows]) => providerGroup(provider, rows))
    .sort((left, right) => NAME_ORDER.compare(left.title, right.title));
}

/** @param {string} provider @param {PickerItem[]} rows @returns {PickerGroup} */
function providerGroup(provider, rows) {
  const sections = sectionsOf(rows);
  const items = sections ? sections.flatMap((section) => section.items) : rows.sort(byName);
  return {kind: 'provider', provider, title: providerName(provider), items, ...(sections ? {sections} : {})};
}

/**
 * Subgrupos por fabricante ("Fabricante: Modelo") de um provedor com
 * `SECTION_THRESHOLD` linhas ou mais: fabricantes A–Z, as linhas sem
 * fabricante por último, e dentro de cada um por nome curto. Sem dois
 * fabricantes distintos, não vale dividir: `null`.
 * `sectionsOf(vinteDoDeepSeekEDoQwen).map((s) => s.vendor)` → `['DeepSeek', 'Qwen']`
 * @param {PickerItem[]} rows
 * @returns {PickerSection[] | null}
 */
export function sectionsOf(rows) {
  if (rows.length < SECTION_THRESHOLD) return null;
  /** @type {Map<string, PickerItem[]>} */
  const byVendor = new Map();
  for (const item of rows) {
    const list = byVendor.get(item.vendor);
    if (list) list.push(item); else byVendor.set(item.vendor, [item]);
  }
  const named = [...byVendor.keys()].filter(Boolean);
  if (named.length < 2) return null;
  const shortOrder = (/** @type {PickerItem} */ left, /** @type {PickerItem} */ right) => byName({name: left.short, id: left.id}, {name: right.short, id: right.id});
  const vendors = named.sort((left, right) => NAME_ORDER.compare(left, right));
  if (byVendor.has('')) vendors.push('');
  return vendors.map((vendor) => ({vendor, items: /** @type {PickerItem[]} */ (byVendor.get(vendor)).sort(shortOrder)}));
}

/**
 * As entradas do trilho de provedores ao lado da lista (como o seletor do T3
 * Code): uma por grupo, para pular até ele. Lista plana (Claude) ou um grupo só
 * não precisam de trilho. O desenho escolhe o ícone: o logo do `provider`, ou a
 * estrela, o relógio e a faísca de Favoritos, Recentes e Grátis.
 * `railEntries(groupModels(catalog, {engine: 'pi'}))` → `[{group: 0, kind: 'provider', title: 'xAI', provider: 'xai'}]`
 * @param {PickerGroup[]} groups
 * @returns {Array<{group: number, kind: PickerGroup['kind'], title: string, provider: string}>}
 */
export function railEntries(groups) {
  if (groups.length < 2 || groups.some((group) => group.kind === 'flat')) return [];
  return groups.map((group, at) => ({group: at, kind: group.kind, title: group.title, provider: group.provider}));
}

/**
 * As linhas na ordem em que aparecem na tela, que é a ordem do teclado.
 * @param {PickerGroup[]} groups
 * @returns {PickerItem[]}
 */
export function flattenGroups(groups) {
  return groups.flatMap((group) => group.items);
}

/**
 * Anda o índice ativo, com volta nas pontas (como o menu `@`, #53). Sem linhas, -1.
 * `stepActive(3, 2, 1)` → `0`; `stepActive(3, 0, -1)` → `2`; `stepActive(0, -1, 1)` → `-1`
 * @param {number} count quantas linhas há
 * @param {number} index o índice ativo (-1 se nenhum)
 * @param {number} delta +1 desce, -1 sobe
 * @returns {number}
 */
export function stepActive(count, index, delta) {
  if (count <= 0) return -1;
  if (index < 0) return delta > 0 ? 0 : count - 1;
  return (index + delta + count) % count;
}

/**
 * Atalho da estrela na linha ativa (#58): ⌘D no macOS, Ctrl+D fora, o mesmo
 * "favoritar" dos navegadores. Livre na Mesa (⌘⇧D é a densidade) e sem
 * colidir com a busca, que só recebe letras sem modificador.
 * `isFavoriteShortcut({key: 'd', metaKey: true}, true)` → `true`
 * @param {{key: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean, shiftKey?: boolean}} event
 * @param {boolean} isMac
 * @returns {boolean}
 */
export function isFavoriteShortcut(event, isMac) {
  if (String(event.key || '').toLowerCase() !== 'd' || event.altKey || event.shiftKey) return false;
  return isMac ? !!event.metaKey && !event.ctrlKey : !!event.ctrlKey && !event.metaKey;
}

/**
 * Depois da estrela, a linha ativa segue o MESMO modelo: o favorito ganha uma
 * cópia no grupo do topo (ou a perde), e os índices andam. Fica a cópia mais
 * perto de onde o foco estava (no empate, a de baixo: o original desceu uma
 * casa quando a cópia entrou no topo); sem nenhuma, o índice antigo na lista.
 * `activeAfterFlip([{key: 'a'}, {key: 'b'}, {key: 'a'}], 'a', 3)` → `2`
 * @param {Array<{key: string}>} items @param {string} key @param {number} previous
 * @returns {number}
 */
export function activeAfterFlip(items, key, previous) {
  let best = -1;
  items.forEach((item, at) => {
    if (item.key === key && (best < 0 || Math.abs(at - previous) <= Math.abs(best - previous))) best = at;
  });
  return best >= 0 ? best : Math.min(previous, items.length - 1);
}

/**
 * A linha ativa ao abrir ou refiltrar: a do modelo em uso, se estiver à vista;
 * senão a primeira.
 * `initialActive([{key: 'a'}, {key: 'b'}], 'b')` → `1`
 * @param {Array<{key: string}>} items
 * @param {string} selectedKey
 * @returns {number}
 */
export function initialActive(items, selectedKey) {
  const at = items.findIndex((item) => item.key === selectedKey);
  if (at >= 0) return at;
  return items.length ? 0 : -1;
}

/**
 * Lê pares `[provedor, id]` por motor do estado de interface; o que não for
 * lista de pares de texto é descartado, e cada motor guarda até `limit`.
 * @param {unknown} raw
 * @param {number} limit
 * @returns {ModelPairs}
 */
function normalizePairs(raw, limit) {
  /** @type {ModelPairs} */
  const out = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [engine, list] of Object.entries(raw)) {
    if (!Array.isArray(list) || engine === '__proto__') continue;
    const pairs = list.filter(isModelPair).slice(0, limit).map(([provider, id]) => /** @type {[string, string]} */ ([provider, id]));
    if (pairs.length) out[engine] = pairs;
  }
  return out;
}

/**
 * Lê os recentes guardados no estado de interface; cada motor guarda até `RECENT_LIMIT`.
 * `normalizeRecents({pi: [['xai', 'grok']], x: 3})` → `{pi: [['xai', 'grok']]}`
 * @param {unknown} raw
 * @returns {ModelRecents}
 */
export function normalizeRecents(raw) {
  return normalizePairs(raw, RECENT_LIMIT);
}

/**
 * Lê os favoritos guardados no estado de interface; cada motor guarda até `FAVORITE_LIMIT`.
 * `normalizeFavorites({pi: [['xai', 'grok']], claude: 'x'})` → `{pi: [['xai', 'grok']]}`
 * @param {unknown} raw
 * @returns {ModelFavorites}
 */
export function normalizeFavorites(raw) {
  return normalizePairs(raw, FAVORITE_LIMIT);
}

/**
 * @param {unknown} value
 * @returns {value is [string, string]}
 */
function isModelPair(value) {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string' && value[0] !== '' && value[1].length <= 200;
}

/**
 * Põe um modelo no topo dos recentes do motor, sem repetir e sem passar de
 * `RECENT_LIMIT`. Não muda o objeto recebido.
 * `pushRecent({}, 'pi', 'xai', 'grok')` → `{pi: [['xai', 'grok']]}`
 * @param {ModelRecents} recents
 * @param {string} engine
 * @param {string} provider
 * @param {string} id
 * @returns {ModelRecents}
 */
export function pushRecent(recents, engine, provider, id) {
  const kept = (recents[engine] || []).filter(([p, i]) => p !== provider || i !== id);
  /** @type {Array<[string, string]>} */
  const next = [[provider, id], ...kept];
  return {...recents, [engine]: next.slice(0, RECENT_LIMIT)};
}

/**
 * Liga ou desliga a estrela de um modelo no motor: um favorito novo vai para o
 * fim (a ordem é a em que foram marcados); desmarcar tira. O motor sem favorito
 * some do objeto. Não muda o objeto recebido.
 * `toggleFavorite({}, 'pi', 'xai', 'grok')` → `{pi: [['xai', 'grok']]}`
 * @param {ModelFavorites} favorites
 * @param {string} engine
 * @param {string} provider
 * @param {string} id
 * @returns {ModelFavorites}
 */
export function toggleFavorite(favorites, engine, provider, id) {
  const current = favorites[engine] || [];
  const kept = current.filter(([p, i]) => p !== provider || i !== id);
  /** @type {Array<[string, string]>} */
  const next = kept.length === current.length ? [...current, /** @type {[string, string]} */ ([provider, id])].slice(-FAVORITE_LIMIT) : kept;
  const others = Object.fromEntries(Object.entries(favorites).filter(([key]) => key !== engine));
  return next.length ? {...others, [engine]: next} : others;
}

/**
 * Onde parar a rolagem para nenhuma linha ficar cortada no topo: se o topo da
 * lista cai no meio de um item (título de grupo ou linha), sobe até o começo
 * dele. `edges` são os itens em coordenadas da lista (`offsetTop`), em ordem.
 * `alignedScrollTop(50, [{top: 0, bottom: 36}, {top: 36, bottom: 72}])` → `36`
 * @param {number} scrollTop
 * @param {Array<{top: number, bottom: number}>} edges
 * @param {number} [inset] o respiro de cima da lista (padding), que fica acima do item
 * @returns {number}
 */
export function alignedScrollTop(scrollTop, edges, inset = 0) {
  const line = scrollTop + inset;
  const cut = edges.find((edge) => edge.top < line - 0.5 && edge.bottom > line + 0.5);
  if (!cut) return scrollTop;
  return Math.max(0, Math.round(cut.top - inset));
}
