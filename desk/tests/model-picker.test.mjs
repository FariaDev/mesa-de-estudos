/* O seletor de modelo (#59), a parte pura: grupos por provedor, recentes, busca,
   grátis à parte e o índice ativo do teclado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {message} from '../src/i18n.mjs';
import {
  RECENT_LIMIT, providerName, modelKey, foldSearch, matchesQuery, groupModels, flattenGroups,
  stepActive, initialActive, normalizeRecents, pushRecent, railEntries,
  FAVORITE_LIMIT, normalizeFavorites, toggleFavorite, alignedScrollTop, isFavoriteShortcut, activeAfterFlip,
} from '../src/model-picker.mjs';

const zeroTail = [message('freeModels.badge'), message('freeModels.policy.zero')];
const catalog = [
  {name: 'Sonnet 5', id: 'sonnet-5', provider: 'anthropic'},
  {name: 'Grok 4', id: 'grok-4', provider: 'xai'},
  {name: 'Grok 4 Fast', id: 'grok-4-fast', provider: 'xai'},
  {name: 'GLM 5.3 Flash Free', id: 'glm-5.3-flash-free', provider: 'opencode', free: {is: true, tail: zeroTail}},
  {name: 'GPT 5.5', id: 'gpt-5.5', provider: 'opencode', free: {is: false, tail: []}},
  {name: 'Modelo caseiro', id: 'caseiro', provider: 'meu-provedor'},
];

const titles = (groups) => groups.map((group) => group.kind === 'provider' ? group.title : group.kind);

test('providerName: o mapa dá o nome e um id desconhecido aparece cru', () => {
  assert.equal(providerName('xai'), 'xAI');
  assert.equal(providerName('opencode'), 'OpenCode Zen');
  assert.equal(providerName('meu-provedor'), 'meu-provedor');
  assert.equal(providerName('constructor'), 'constructor', 'chave herdada do Object não é provedor');
});

test('modelKey é o par [provedor, id] em JSON, o mesmo valor que o host entende', () => {
  assert.equal(modelKey('anthropic', 'sonnet-5'), '["anthropic","sonnet-5"]');
  assert.deepEqual(JSON.parse(modelKey('anthropic', '')), ['anthropic', '']);
});

test('groupModels: um grupo por provedor, A–Z, e os grátis num grupo só deles', () => {
  const groups = groupModels(catalog, {engine: 'pi'});
  assert.deepEqual(titles(groups), ['free', 'Anthropic', 'meu-provedor', 'OpenCode Zen', 'xAI']);
  const free = groups[0];
  assert.deepEqual(free.items.map((item) => item.id), ['glm-5.3-flash-free']);
  const zen = groups.find((group) => group.provider === 'opencode');
  assert.deepEqual(zen.items.map((item) => item.id), ['gpt-5.5'], 'o grátis não se repete no grupo do provedor');
});

test('groupModels: dentro do provedor a ordem é por nome, sem caixa nem acento (ajustes do seletor)', () => {
  const shuffled = [
    {name: 'Reflection', id: 'r', provider: 'openrouter'}, {name: 'deepSeek', id: 'd', provider: 'openrouter'},
    {name: 'Élorian', id: 'e', provider: 'openrouter'}, {name: 'Inception', id: 'i', provider: 'openrouter'},
    {name: 'GPT 10', id: 'g10', provider: 'openrouter'}, {name: 'GPT 5', id: 'g5', provider: 'openrouter'},
  ];
  const router = groupModels(shuffled, {engine: 'pi'}).find((group) => group.provider === 'openrouter');
  assert.deepEqual(router.items.map((item) => item.name), ['deepSeek', 'Élorian', 'GPT 5', 'GPT 10', 'Inception', 'Reflection']);
  const xai = groupModels(catalog, {engine: 'pi'}).find((group) => group.provider === 'xai');
  assert.deepEqual(xai.items.map((item) => item.id), ['grok-4', 'grok-4-fast']);
});

test('o grátis guarda a política e o aviso, sem repetir a marca que o título já diz', () => {
  const [free] = groupModels(catalog, {engine: 'opencode'})[0].items;
  assert.deepEqual(free.notes, [message('freeModels.policy.zero')]);
  assert.equal(free.free, true);
  assert.equal(free.zenPaid, false);
});

test('o pago do Zen leva a marca zenPaid; pago de outro provedor e sem anotação não', () => {
  const items = flattenGroups(groupModels(catalog, {engine: 'pi'}));
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  assert.equal(byId['gpt-5.5'].zenPaid, true);
  assert.equal(byId['grok-4'].zenPaid, false);
  assert.equal(byId['glm-5.3-flash-free'].zenPaid, false);
});

test('recentes: vão no topo, do mais novo ao mais velho, e o que saiu do catálogo não aparece', () => {
  const recents = [['xai', 'grok-4-fast'], ['antigo', 'sumiu'], ['anthropic', 'sonnet-5']];
  const groups = groupModels(catalog, {engine: 'pi', recents});
  assert.equal(groups[0].kind, 'recent');
  assert.deepEqual(groups[0].items.map((item) => item.id), ['grok-4-fast', 'sonnet-5']);
  assert.ok(groups.some((group) => group.provider === 'xai'), 'o recente continua no grupo do provedor');
});

test('recentes: no máximo RECENT_LIMIT, mesmo com mais guardados', () => {
  const many = Array.from({length: 9}, (_, n) => ['p', `m${n}`]);
  const big = many.map(([provider, id]) => ({id, provider}));
  const [recent] = groupModels(big, {engine: 'pi', recents: many});
  assert.equal(recent.items.length, RECENT_LIMIT);
});

test('sem recentes vivos, não há grupo Recentes', () => {
  assert.equal(groupModels(catalog, {engine: 'pi', recents: [['x', 'y']]}).some((group) => group.kind === 'recent'), false);
});

test('busca: filtra pelo nome, pelo id e pelo provedor, sem acento nem caixa, e tira os recentes', () => {
  const recents = [['xai', 'grok-4']];
  assert.deepEqual(flattenGroups(groupModels(catalog, {engine: 'pi', query: 'GROK', recents})).map((i) => i.id), ['grok-4', 'grok-4-fast']);
  assert.deepEqual(flattenGroups(groupModels(catalog, {engine: 'pi', query: 'zen gpt'})).map((i) => i.id), ['gpt-5.5']);
  assert.deepEqual(flattenGroups(groupModels(catalog, {engine: 'pi', query: 'CASEIRO'})).map((i) => i.id), ['caseiro']);
  assert.equal(groupModels(catalog, {engine: 'pi', query: 'grok', recents}).some((group) => group.kind === 'recent'), false);
});

test('busca: os termos valem em conjunto e grupos sem resultado somem', () => {
  assert.deepEqual(groupModels(catalog, {engine: 'pi', query: 'xai sonnet'}), []);
  assert.deepEqual(titles(groupModels(catalog, {engine: 'pi', query: 'flash'})), ['free']);
});

test('busca em branco não filtra', () => {
  assert.equal(flattenGroups(groupModels(catalog, {engine: 'pi', query: '   '})).length, catalog.length);
});

test('o nome da linha passa pelo rótulo (idioma da tela) e a busca acha o texto traduzido', () => {
  const label = (raw) => raw === 'Sonnet 5' ? 'Soneto 5' : raw;
  const [group] = groupModels(catalog, {engine: 'pi', query: 'soneto', label});
  assert.equal(group.items[0].name, 'Soneto 5');
});

test('Claude: uma lista só, sem grupos nem recentes, na ordem do catálogo', () => {
  const claude = [{name: 'Padrão do Claude', id: '', provider: 'anthropic'}, {name: 'Sonnet', id: 'sonnet', provider: 'anthropic'}];
  const groups = groupModels(claude, {engine: 'claude', recents: [['anthropic', 'sonnet']]});
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, 'flat');
  assert.deepEqual(groups[0].items.map((item) => item.id), ['', 'sonnet']);
  assert.deepEqual(groupModels(claude, {engine: 'claude', query: 'zzz'}), []);
});

test('catálogo vazio dá lista vazia', () => {
  assert.deepEqual(groupModels([], {engine: 'pi'}), []);
});

test('stepActive: desce e sobe com volta, e sem linhas fica em -1', () => {
  assert.equal(stepActive(3, 2, 1), 0);
  assert.equal(stepActive(3, 0, -1), 2);
  assert.equal(stepActive(3, 1, 1), 2);
  assert.equal(stepActive(3, -1, 1), 0);
  assert.equal(stepActive(3, -1, -1), 2);
  assert.equal(stepActive(0, -1, 1), -1);
});

test('initialActive: o modelo em uso, senão a primeira linha, senão nenhuma', () => {
  const items = [{key: 'a'}, {key: 'b'}];
  assert.equal(initialActive(items, 'b'), 1);
  assert.equal(initialActive(items, 'zzz'), 0);
  assert.equal(initialActive([], 'a'), -1);
});

test('foldSearch tira acento, caixa e espaço nas pontas; matchesQuery usa o mesmo molde', () => {
  assert.equal(foldSearch('  Grátis '), 'gratis');
  const [group] = groupModels([{name: 'Pensão', id: 'p', provider: 'x'}], {engine: 'pi'});
  assert.equal(matchesQuery(group.items[0], 'PENSAO'), true);
  assert.equal(matchesQuery(group.items[0], 'outra'), false);
});

test('normalizeRecents: guarda só pares de texto por motor, até o limite, e ignora lixo', () => {
  assert.deepEqual(normalizeRecents({pi: [['xai', 'grok'], ['só um'], [1, 2], ['', 'x']], opencode: 'ruim', claude: []}), {pi: [['xai', 'grok']]});
  assert.deepEqual(normalizeRecents(null), {});
  assert.deepEqual(normalizeRecents([['xai', 'grok']]), {});
  const ten = Array.from({length: 10}, (_, n) => ['p', `m${n}`]);
  assert.equal(normalizeRecents({pi: ten}).pi.length, RECENT_LIMIT);
  assert.equal(Object.hasOwn(normalizeRecents(JSON.parse('{"__proto__": [["a","b"]]}')), '__proto__'), false);
});

test('pushRecent: o novo vai ao topo, sem repetir, no limite, sem mudar o original e por motor', () => {
  const start = {pi: [['xai', 'a'], ['xai', 'b']]};
  const next = pushRecent(start, 'pi', 'xai', 'b');
  assert.deepEqual(next.pi, [['xai', 'b'], ['xai', 'a']]);
  assert.deepEqual(start.pi, [['xai', 'a'], ['xai', 'b']], 'o original fica como estava');
  assert.deepEqual(pushRecent(start, 'opencode', 'opencode', 'z').opencode, [['opencode', 'z']]);
  let grown = {};
  for (let n = 0; n < 8; n += 1) grown = pushRecent(grown, 'pi', 'p', `m${n}`);
  assert.equal(grown.pi.length, RECENT_LIMIT);
  assert.deepEqual(grown.pi[0], ['p', 'm7']);
});

test('railEntries: uma entrada por grupo, com o provedor para o logo; Claude e grupo único não têm trilho', () => {
  const groups = groupModels(catalog, {engine: 'pi', recents: [['xai', 'grok-4']], favorites: [['anthropic', 'sonnet-5']]});
  const rail = railEntries(groups);
  assert.deepEqual(rail.map((entry) => entry.kind), groups.map((group) => group.kind));
  assert.equal(rail[0].kind, 'favorite', 'a estrela fica no topo do trilho');
  const providers = rail.filter((entry) => entry.kind === 'provider');
  assert.deepEqual(providers.filter((entry) => ['Anthropic', 'xAI', 'meu-provedor'].includes(entry.title)).map((entry) => [entry.title, entry.provider]), [['Anthropic', 'anthropic'], ['meu-provedor', 'meu-provedor'], ['xAI', 'xai']]);
  assert.equal(rail.find((entry) => entry.kind === 'recent')?.provider, '', 'Recentes usa ícone da Mesa, não logo');
  assert.equal(rail.some((entry) => 'mark' in entry), false, 'sem letra no trilho');
  assert.deepEqual(railEntries(groupModels(catalog, {engine: 'claude'})), []);
  assert.deepEqual(railEntries(groupModels(catalog, {engine: 'pi', query: 'grok'})), [], 'um grupo só: sem trilho');
});

test('groupModels: Favoritos no topo, acima dos Recentes, e a estrela em toda linha do favorito', () => {
  const groups = groupModels(catalog, {engine: 'pi', recents: [['xai', 'grok-4']], favorites: [['xai', 'grok-4-fast'], ['anthropic', 'sonnet-5']]});
  assert.deepEqual(groups.slice(0, 2).map((group) => group.kind), ['favorite', 'recent']);
  assert.deepEqual(groups[0].items.map((item) => item.id), ['grok-4-fast', 'sonnet-5'], 'na ordem em que foram marcados');
  const sonnetRows = flattenGroups(groups).filter((item) => item.id === 'sonnet-5');
  assert.equal(sonnetRows.length, 2, 'o favorito aparece no grupo dele e no de Favoritos');
  assert.equal(sonnetRows.every((item) => item.favorite), true);
  assert.equal(flattenGroups(groups).find((item) => item.id === 'grok-4')?.favorite, false);
});

test('groupModels: favorito que saiu do catálogo não aparece; busca tira o grupo; Claude não tem favoritos', () => {
  const gone = groupModels(catalog, {engine: 'pi', favorites: [['xai', 'grok-3'], ['openai', 'sumiu']]});
  assert.equal(gone.some((group) => group.kind === 'favorite'), false);
  const searching = groupModels(catalog, {engine: 'pi', query: 'grok', favorites: [['xai', 'grok-4']]});
  assert.deepEqual(titles(searching), ['xAI']);
  assert.equal(flattenGroups(searching)[0].favorite, true, 'na busca a estrela segue acesa');
  const claude = groupModels(catalog, {engine: 'claude', favorites: [['anthropic', 'sonnet-5']]});
  assert.equal(flattenGroups(claude).some((item) => item.favorite), false);
});

test('toggleFavorite: liga no fim, desliga, separa por motor e não muda o recebido', () => {
  const first = toggleFavorite({}, 'pi', 'xai', 'grok');
  assert.deepEqual(first, {pi: [['xai', 'grok']]});
  const second = toggleFavorite(first, 'pi', 'openai', 'gpt');
  assert.deepEqual(second.pi, [['xai', 'grok'], ['openai', 'gpt']]);
  assert.deepEqual(first, {pi: [['xai', 'grok']]}, 'o original não muda');
  assert.deepEqual(toggleFavorite(second, 'pi', 'xai', 'grok'), {pi: [['openai', 'gpt']]});
  assert.deepEqual(toggleFavorite(first, 'pi', 'xai', 'grok'), {}, 'motor sem favorito some');
  assert.deepEqual(toggleFavorite(first, 'opencode', 'xai', 'grok'), {pi: [['xai', 'grok']], opencode: [['xai', 'grok']]});
  const full = {pi: Array.from({length: FAVORITE_LIMIT}, (_, at) => /** @type {[string, string]} */ (['p', `m${at}`]))};
  const grown = toggleFavorite(full, 'pi', 'p', 'novo');
  assert.equal(grown.pi.length, FAVORITE_LIMIT);
  assert.deepEqual(grown.pi.at(-1), ['p', 'novo']);
});

test('normalizeFavorites: só pares de texto por motor, até o teto', () => {
  assert.deepEqual(normalizeFavorites({pi: [['xai', 'grok'], ['x'], [1, 2]], claude: 'ruim'}), {pi: [['xai', 'grok']]});
  assert.deepEqual(normalizeFavorites(undefined), {});
  const many = Array.from({length: FAVORITE_LIMIT + 9}, (_, at) => ['p', `m${at}`]);
  assert.equal(normalizeFavorites({pi: many}).pi.length, FAVORITE_LIMIT, 'favoritos não caem no teto dos recentes');
  assert.equal(Object.hasOwn(normalizeFavorites(JSON.parse('{"__proto__": [["a","b"]]}')), '__proto__'), false);
});

test('alignedScrollTop: o topo da lista nunca corta uma linha pela metade', () => {
  const edges = [{top: 4, bottom: 28}, {top: 28, bottom: 72}, {top: 72, bottom: 116}];
  assert.equal(alignedScrollTop(50, edges), 28, 'cortada: sobe até o começo da linha');
  assert.equal(alignedScrollTop(28, edges), 28, 'já alinhada: fica');
  assert.equal(alignedScrollTop(46, edges, 4), 24, 'com respiro de cima, a linha fica inteira abaixo dele');
  assert.equal(alignedScrollTop(500, edges), 500, 'fora dos itens: não mexe');
  assert.equal(alignedScrollTop(2, [{top: 0, bottom: 30}], 4), 0, 'nunca negativo');
});

test('isFavoriteShortcut: ⌘D no macOS, Ctrl+D fora; com ⇧ ou ⌥ é outro atalho (#58)', () => {
  assert.equal(isFavoriteShortcut({key: 'd', metaKey: true}, true), true);
  assert.equal(isFavoriteShortcut({key: 'D', ctrlKey: true}, false), true);
  assert.equal(isFavoriteShortcut({key: 'd', ctrlKey: true}, true), false, 'no macOS Ctrl+D é do campo de texto');
  assert.equal(isFavoriteShortcut({key: 'd', metaKey: true, shiftKey: true}, true), false, '⌘⇧D é a densidade');
  assert.equal(isFavoriteShortcut({key: 'd', metaKey: true, altKey: true}, true), false);
  assert.equal(isFavoriteShortcut({key: 'd'}, true), false, 'letra sem modificador vai para a busca');
});

test('activeAfterFlip: a linha ativa segue o mesmo modelo depois da estrela (#58)', () => {
  const after = [{key: 'b'}, {key: 'a'}, {key: 'b'}, {key: 'c'}];
  assert.equal(activeAfterFlip(after, 'b', 1), 2, 'favoritou: o foco segue na cópia do grupo do provedor, a mais perto');
  assert.equal(activeAfterFlip(after, 'b', 0), 0);
  assert.equal(activeAfterFlip([{key: 'a'}, {key: 'b'}], 'b', 2), 1, 'desfavoritou: os índices voltaram uma casa');
  assert.equal(activeAfterFlip([{key: 'a'}], 'z', 4), 0, 'modelo sumiu: o índice antigo dentro da lista');
  assert.equal(activeAfterFlip([], 'z', 4), -1);
});
