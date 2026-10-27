// Funções puras do seletor com um catálogo grande (ajustes do seletor e do
// indicador): nome curto "Fabricante: Modelo", ordem dentro do grupo,
// subgrupos por fabricante, a segunda linha útil e o custo de agrupar ~450.
import test from 'node:test';
import assert from 'node:assert/strict';
import {splitVendor, shortModelName, groupModels, flattenGroups, sectionsOf, factsOf, contextSize, SECTION_THRESHOLD} from '../src/model-picker.mjs';
import {bigCatalog} from './fake-pi-catalog.mjs';

test('splitVendor separa o fabricante do nome no formato do OpenRouter', () => {
  assert.deepEqual(splitVendor('DeepSeek: DeepSeek V4.1 Flash'), {vendor: 'DeepSeek', model: 'DeepSeek V4.1 Flash'});
  assert.deepEqual(splitVendor('Moonshot AI: Kimi K3 (free)'), {vendor: 'Moonshot AI', model: 'Kimi K3 (free)'});
  assert.deepEqual(splitVendor('Pi de teste'), {vendor: '', model: 'Pi de teste'});
});

test('splitVendor não corta nome sem o espaço depois dos dois-pontos nem com prefixo comprido', () => {
  assert.deepEqual(splitVendor('ratio 1:2 model'), {vendor: '', model: 'ratio 1:2 model'});
  const long = `${'x'.repeat(41)}: Modelo`;
  assert.deepEqual(splitVendor(long), {vendor: '', model: long});
  assert.deepEqual(splitVendor(''), {vendor: '', model: ''});
});

test('shortModelName tira o "Fabricante: " para o indicador da fileira', () => {
  assert.equal(shortModelName('Qwen: Qwen3.5 32B'), 'Qwen3.5 32B');
  assert.equal(shortModelName('Sonnet 5'), 'Sonnet 5');
});

const router = (vendor, model, extra = {}) => ({provider: 'openrouter', id: `${vendor.toLowerCase()}/${model.toLowerCase().replace(/\s+/g, '-')}`, name: `${vendor}: ${model}`, ...extra});

test('provedor com 20 ou mais modelos se divide por fabricante, A–Z, com as linhas por nome curto', () => {
  const rows = [];
  for (let i = 12; i >= 1; i--) rows.push(router('Qwen', `Qwen3.5 ${i}B`));
  for (let i = 1; i <= 8; i++) rows.push(router('DeepSeek', `DeepSeek V${i}`));
  rows.push({provider: 'openrouter', id: 'openrouter/auto', name: 'Auto Router'});
  const group = groupModels(rows, {engine: 'pi'}).find((g) => g.provider === 'openrouter');
  assert.deepEqual(group.sections.map((section) => section.vendor), ['DeepSeek', 'Qwen', ''], 'fabricantes A–Z e sem fabricante por último');
  assert.deepEqual(group.sections[1].items.slice(0, 3).map((item) => item.short), ['Qwen3.5 1B', 'Qwen3.5 2B', 'Qwen3.5 3B'], 'dentro do fabricante, nome curto em ordem natural');
  assert.deepEqual(group.items.map((item) => item.key), group.sections.flatMap((section) => section.items.map((item) => item.key)), 'a ordem do teclado é a das seções');
});

test('abaixo do limiar, ou com um fabricante só, não há subgrupos', () => {
  const few = Array.from({length: SECTION_THRESHOLD - 1}, (_, i) => router(i % 2 ? 'Qwen' : 'Meta', `M${i}`));
  assert.equal(groupModels(few, {engine: 'pi'})[0].sections, undefined);
  const single = Array.from({length: SECTION_THRESHOLD + 5}, (_, i) => router('Qwen', `M${i}`));
  assert.equal(sectionsOf(groupModels(single, {engine: 'pi'})[0].items), null);
});

test('a busca acha pelo nome completo e pelo fabricante, também dentro dos subgrupos', () => {
  const rows = Array.from({length: 30}, (_, i) => router(i % 3 ? 'Qwen' : 'DeepSeek', `Model ${i}`));
  const byVendor = flattenGroups(groupModels(rows, {engine: 'pi', query: 'deepseek'}));
  assert.equal(byVendor.length, 10);
  const byFull = flattenGroups(groupModels(rows, {engine: 'pi', query: 'qwen: model 1'}));
  assert.ok(byFull.length > 0 && byFull.every((item) => item.vendor === 'Qwen'));
});

test('factsOf: contexto, visão, raciocínio e preço só de pago com preço conhecido', () => {
  assert.deepEqual(factsOf({id: 'a', provider: 'p', contextWindow: 131072, input: ['text', 'image'], reasoning: true, cost: {input: 0.27, output: 1.1}}, false),
    {context: 131072, vision: true, reasoning: true, price: {input: 0.27, output: 1.1}});
  assert.deepEqual(factsOf({id: 'a', provider: 'p', cost: {input: 0, output: 0}}, true), {context: 0, vision: false, reasoning: false, price: null}, 'grátis não mostra preço');
  assert.equal(factsOf({id: 'a', provider: 'p', cost: {input: 0, output: 0}}, false).price, null, 'preço zero de pago (assinatura) não vira "US$ 0"');
  assert.equal(factsOf({id: 'a', provider: 'p'}, false).price, null, 'sem preço no catálogo, sem preço na linha');
});

test('contextSize em mil e em milhão', () => {
  assert.deepEqual(contextSize(128000), {unit: 'K', value: 128});
  assert.deepEqual(contextSize(131072), {unit: 'K', value: 131});
  assert.deepEqual(contextSize(1048576), {unit: 'M', value: 1});
  assert.deepEqual(contextSize(2000000), {unit: 'M', value: 2});
  assert.deepEqual(contextSize(1500000), {unit: 'M', value: 1.5});
});

test('o grupo Grátis também vai por nome', () => {
  const free = {is: true, tail: []};
  const groups = groupModels([{provider: 'openrouter', id: 'z:free', name: 'Zeta (free)', free}, {provider: 'opencode', id: 'a-free', name: 'alfa', free}], {engine: 'pi'});
  assert.deepEqual(groups.find((g) => g.kind === 'free').items.map((item) => item.name), ['alfa', 'Zeta (free)']);
});

/* Melhor de 5 rodadas das 6 buscas, em ms por chamada. */
function groupingMs(size) {
  const rows = bigCatalog(size, {reasoning: true});
  let best = Infinity;
  for (let round = 0; round < 5; round++) {
    const started = performance.now();
    for (const query of ['', 'd', 'de', 'dee', 'deep', 'deepseek v4']) flattenGroups(groupModels(rows, {engine: 'pi', query}));
    best = Math.min(best, (performance.now() - started) / 6);
  }
  return best;
}

/* Era uma rodada só: fria (JIT sem aquecer) e na rodada paralela do `npm test`
   chegou a 83 ms (achado 19 da #67). O melhor de 5 tira o pico de carga e o
   aquecimento; o normal é ~0,4 ms, bem abaixo do teto de 25 ms (#69). */
test('agrupar e buscar ~450 modelos fica bem abaixo de um quadro', () => {
  const each = groupingMs(450);
  assert.ok(each < 25, `groupModels com 450 modelos: ${each.toFixed(2)} ms por chamada (melhor de 5), esperado < 25 ms`);
});
