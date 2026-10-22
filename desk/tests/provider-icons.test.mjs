/* Logos dos provedores e dos fabricantes no seletor de modelo (acabamento da
   #59; logos dos fabricantes): caminhos do Lobe Icons embutidos, na cor do
   texto, com um monograma colorido para quem não tem logo. Nada de rede. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {choiceIcon, providerIcon, providerIconSlug, vendorIcon, vendorIconSlug, brandIcon, mappedIconSlugs, monogramLetters, monogramSlot, MONOGRAM_SLOTS} from '../src/provider-icons.mjs';

const SVG = /^<svg class="icon provider-icon" data-brand="[a-z0-9]+" viewBox="0 0 \d+ \d+" fill="currentColor"( fill-rule="evenodd")? aria-hidden="true">(<path d="[^"]{8,}"( fill-opacity="0\.\d+")?\/>)+<\/svg>$/;
const MONO = /^<span class="provider-mono" data-slot="[1-6]" aria-hidden="true">[^<]{1,2}<\/span>$/;

/* Provedor → slug esperado: os do Pi do usuário, os do Simple Icons de antes e os ids do models.dev. */
const PROVIDERS = Object.freeze({
  anthropic: 'anthropic', openai: 'openai', 'openai-codex': 'openai', google: 'google', 'google-vertex': 'googlecloud',
  xai: 'grok', opencode: 'opencode', 'opencode-go': 'opencode', commandcode: 'commandcode', openrouter: 'openrouter', groq: 'groq', cerebras: 'cerebras', mistral: 'mistral',
  deepseek: 'deepseek', 'github-copilot': 'githubcopilot', 'amazon-bedrock': 'bedrock', 'azure-openai-responses': 'azure',
  zai: 'zai', minimax: 'minimax', huggingface: 'huggingface', moonshotai: 'moonshot', zhipuai: 'zhipu', nvidia: 'nvidia',
  cohere: 'cohere', perplexity: 'perplexity', inception: 'inception',
});

/* Prefixo do id do OpenRouter → slug do fabricante (a lista do pedido e os do catálogo de mentira). */
const VENDORS = Object.freeze({
  openai: 'openai', 'x-ai': 'grok', 'meta-llama': 'meta', qwen: 'qwen', alibaba: 'alibaba', moonshotai: 'moonshot',
  'z-ai': 'zai', thudm: 'zhipu', minimax: 'minimax', anthropic: 'anthropic', google: 'google', mistralai: 'mistral',
  deepseek: 'deepseek', cohere: 'cohere', perplexity: 'perplexity', nvidia: 'nvidia', nousresearch: 'nousresearch',
  liquid: 'liquid', inception: 'inception', amazon: 'nova', microsoft: 'microsoft', ai21: 'ai21', 'arcee-ai': 'arcee',
  baidu: 'baidu', bytedance: 'bytedance', 'ibm-granite': 'ibm', tencent: 'tencent',
});

const GENERIC = ['meu-provedor', 'constructor'];

test('providerIconSlug: cada provedor conhecido tem o logo do dono; o xAI usa o do Grok', () => {
  for (const [provider, slug] of Object.entries(PROVIDERS)) assert.equal(providerIconSlug(provider), slug, provider);
  assert.equal(providerIconSlug('toString'), '', 'nada de herança do Object');
});

test('vendorIconSlug: o prefixo do id do modelo diz o fabricante', () => {
  for (const [prefix, slug] of Object.entries(VENDORS)) assert.equal(vendorIconSlug(`${prefix}/modelo-1:free`), slug, prefix);
  assert.equal(vendorIconSlug('gpt-5.5-codex'), '', 'sem prefixo, sem logo');
  assert.equal(vendorIconSlug('sao10k/euryale-70b'), '', 'fabricante sem logo');
  assert.equal(vendorIconSlug('/x'), '', 'prefixo vazio');
  assert.equal(vendorIconSlug('~openai/gpt-latest'), 'openai', 'apelido do OpenRouter com til');
  assert.equal(vendorIconSlug('xiaomi/mimo-v3'), 'xiaomimimo');
  assert.equal(vendorIconSlug('meituan/longcat-2'), 'longcat');
});

test('mappedIconSlugs: todo slug mapeado tem caminho', () => {
  const slugs = mappedIconSlugs();
  for (const slug of [...Object.values(PROVIDERS), ...Object.values(VENDORS)]) assert.ok(slugs.includes(slug), slug);
  for (const slug of slugs) assert.match(brandIcon(slug), SVG, slug);
  assert.equal(brandIcon('nao-existe'), '');
});

test('providerIcon: provedor com logo tem SVG próprio, só de caminhos, na cor do texto', () => {
  for (const provider of Object.keys(PROVIDERS)) {
    const svg = providerIcon(provider);
    assert.match(svg, SVG, provider);
    assert.equal(svg.includes(`data-brand="${providerIconSlug(provider)}"`), true);
  }
  assert.match(providerIcon('openai', 'OpenAI'), /data-brand="openai"/, 'o pedido começou pelo logo da OpenAI');
  assert.match(brandIcon('azure'), /fill-opacity="0\.5"/, 'os tons do Azure vêm do desenho original, sem cor');
  assert.match(brandIcon('nova'), /viewBox="0 0 33 32" fill="currentColor" aria-hidden/, 'a Nova guarda o viewBox e o preenchimento do original');
});

test('providerIcon: sem logo, o monograma com as letras do nome (ajustes do seletor)', () => {
  for (const provider of GENERIC) {
    assert.equal(providerIconSlug(provider), '', provider);
    assert.match(providerIcon(provider), MONO, provider);
  }
  assert.match(providerIcon('meu-provedor'), />MP</);
  assert.match(providerIcon('constructor'), />C</, 'sem nome, as letras saem do id');
  assert.match(providerIcon('x', 'A<b>'), />AB</, 'o texto entra escapado');
});

test('vendorIcon: logo do fabricante no subgrupo; sem logo, o monograma do nome', () => {
  assert.match(vendorIcon('x-ai/grok-5', 'xAI'), /data-brand="grok"/);
  assert.match(vendorIcon('meta-llama/llama-5-scout', 'Meta'), /data-brand="meta"/);
  assert.match(vendorIcon('sao10k/euryale-70b', 'Sao10K'), MONO);
  assert.match(vendorIcon('sao10k/euryale-70b', 'Sao10K'), />SK</);
});

test('choiceIcon: o indicador mostra o fabricante pelo id; sem ele, o provedor; sem provedor, nada', () => {
  assert.match(choiceIcon('openrouter', 'deepseek/deepseek-v4'), /data-brand="deepseek"/);
  assert.match(choiceIcon('opencode-go', 'deepseek-v4.1-flash-free'), /data-brand="opencode"/);
  assert.match(choiceIcon('anthropic', ''), /data-brand="anthropic"/);
  assert.match(choiceIcon('test', 'offline'), MONO);
  assert.equal(choiceIcon('', 'deepseek/deepseek-v4'), '');
});

test('monogramLetters: iniciais de duas palavras, ou inicial e a próxima maiúscula', () => {
  assert.equal(monogramLetters('OpenAI Codex'), 'OC');
  assert.equal(monogramLetters('commandcode'), 'C');
  assert.equal(monogramLetters('Z.AI'), 'ZA');
  assert.equal(monogramLetters('Ériu'), 'É');
  assert.equal(monogramLetters('---'), '?');
});

test('monogramSlot: a mesma cor para o mesmo id, sempre dentro da paleta, e os chips do usuário não ficam iguais', () => {
  const ids = ['openai', 'openai-codex', 'xai', 'opencode-go', 'commandcode', 'groq', 'zai'];
  for (const id of ids) {
    assert.equal(monogramSlot(id), monogramSlot(id));
    assert.ok(monogramSlot(id) >= 1 && monogramSlot(id) <= MONOGRAM_SLOTS);
  }
  const chips = [['openai-codex', 'OpenAI Codex'], ['xai', 'xAI'], ['opencode-go', 'OpenCode Go'], ['commandcode', 'Command Code']].map(([id, name]) => providerIcon(id, name));
  assert.equal(new Set(chips).size, chips.length, `os quatro do trilho do usuário não ficam iguais (${chips.join(' ')})`);
});

test('provider-icons: nada de rede nem de cor fixa', () => {
  const source = fs.readFileSync(new URL('../src/provider-icons.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /https?:\/\//, 'nenhum endereço: o crédito no comentário vai sem protocolo');
  assert.doesNotMatch(source, /fetch\(|#[0-9a-f]{6}\b|fill="(?!currentColor)/i);
});
