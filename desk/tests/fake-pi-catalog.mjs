// @ts-check
/* Catálogo grande do Pi de mentira (ajustes do seletor e do indicador): o Pi
   real do usuário entrega uns 390 modelos do OpenRouter, mais xai,
   opencode-go, openai-codex e commandcode. Este gerador monta um catálogo
   parecido, determinístico, no formato do Pi (`provider`, `id`, `name`,
   `input`, `reasoning`, `cost` por milhão de tokens, `contextWindow`).
   Os nomes do OpenRouter vêm como "Fabricante: Modelo", e os grátis com o id
   terminado em `:free` e o nome em "(free)", como no catálogo real. */

/** @typedef {{provider: string, id: string, name: string, input: string[], reasoning?: boolean, cost: {input: number, output: number, cacheRead: number, cacheWrite: number}, contextWindow: number, maxTokens: number}} FakeCatalogModel */

/* Fabricante → famílias de modelo. Os nomes são de mentira, só no formato. */
const VENDORS = Object.freeze([
  ['DeepSeek', 'deepseek', ['DeepSeek V4.1 Flash', 'DeepSeek V4.1', 'DeepSeek R2', 'DeepSeek Coder V3', 'DeepSeek Prover V3']],
  ['Qwen', 'qwen', ['Qwen3.5 235B A22B', 'Qwen3.5 Coder 480B', 'Qwen3.5 32B', 'Qwen3.5 VL 72B', 'Qwen3.5 Max', 'QwQ 64B']],
  ['MiniMax', 'minimax', ['MiniMax M3', 'MiniMax M3 Flash', 'MiniMax-01']],
  ['Meta', 'meta-llama', ['Llama 5 Maverick', 'Llama 5 Scout', 'Llama 4.5 70B Instruct', 'Llama Guard 5']],
  ['Mistral', 'mistralai', ['Mistral Large 3', 'Mistral Medium 3.5', 'Codestral 26', 'Devstral 2', 'Ministral 8B', 'Pixtral Large']],
  ['Google', 'google', ['Gemini 3.5 Pro', 'Gemini 3.5 Flash', 'Gemini 3.5 Flash Lite', 'Gemma 4 27B', 'Gemma 4 9B']],
  ['Anthropic', 'anthropic', ['Claude Opus 5', 'Claude Sonnet 5', 'Claude Haiku 5']],
  ['OpenAI', 'openai', ['GPT-5.5', 'GPT-5.5 Mini', 'GPT-5.5 Nano', 'o5', 'o5 Mini', 'GPT-OSS 120B', 'GPT-OSS 20B']],
  ['xAI', 'x-ai', ['Grok 5', 'Grok 5 Fast', 'Grok Code Fast 2']],
  ['Cohere', 'cohere', ['Command A', 'Command R7B']],
  ['NousResearch', 'nousresearch', ['Hermes 5 405B', 'Hermes 5 70B']],
  ['Microsoft', 'microsoft', ['Phi-5', 'Phi-5 Mini', 'MAI DS R2']],
  ['Moonshot AI', 'moonshotai', ['Kimi K3', 'Kimi K3 Thinking']],
  ['Z.AI', 'z-ai', ['GLM 5', 'GLM 5 Air', 'GLM 5V']],
  ['Inception', 'inception', ['Mercury 2', 'Mercury Coder 2']],
  ['Elorian', 'elorian', ['Elorian Large', 'Elorian Small']],
  ['Reflection', 'reflection', ['Reflection 3 70B']],
  ['Pareto', 'pareto', ['Pareto Code']],
  ['Ériu', 'eriu', ['Ériu 12B']],
  ['ByteDance', 'bytedance', ['Seed 2 Pro', 'Seed 2 Lite', 'UI-TARS 2']],
  ['Baidu', 'baidu', ['ERNIE 5', 'ERNIE 5 Turbo']],
  ['Tencent', 'tencent', ['Hunyuan T2', 'Hunyuan A13B']],
  ['Amazon', 'amazon', ['Nova 2 Pro', 'Nova 2 Lite', 'Nova 2 Micro']],
  ['Perplexity', 'perplexity', ['Sonar Pro 2', 'Sonar Reasoning 2']],
  ['AI21', 'ai21', ['Jamba 2 Large', 'Jamba 2 Mini']],
  ['IBM', 'ibm-granite', ['Granite 5 8B']],
  ['Arcee AI', 'arcee-ai', ['Virtuoso Large', 'Coder Large', 'Spotlight']],
  ['TheDrummer', 'thedrummer', ['Anubis 70B', 'Cydonia 24B', 'Rocinante 12B']],
  ['Sao10K', 'sao10k', ['Euryale 70B', 'Lunaris 8B']],
  ['Liquid', 'liquid', ['LFM 3 40B', 'LFM 3 7B']],
]);

/* Variantes que o OpenRouter publica de um mesmo modelo (datas, contexto, :free). */
const VARIANTS = Object.freeze(['', ' Preview', ' (2026-08)', ' (2026-04)', ' Extended', ' Turbo', ' Instruct', ' Base', ' Nitro', ' Thinking', ' Beta', ' Lite', ' (2025-12)']);

const slug = (/** @type {string} */ text) => text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');

/**
 * @param {string} provider @param {string} id @param {string} name @param {number} seed @param {boolean} reasoning @param {boolean} free
 * @returns {FakeCatalogModel}
 */
function modelOf(provider, id, name, seed, reasoning, free) {
  const price = free ? 0 : Math.round(((seed * 37) % 1500) + 5) / 100;
  const model = /** @type {FakeCatalogModel} */ ({
    provider, id, name,
    input: seed % 3 === 0 ? ['text'] : ['text', 'image'],
    cost: {input: price, output: Math.round(price * 400) / 100, cacheRead: 0, cacheWrite: 0},
    contextWindow: [32768, 65536, 131072, 200000, 262144, 1000000, 1048576][seed % 7],
    maxTokens: 16384,
  });
  if (reasoning && seed % 2 === 0) model.reasoning = true;
  return model;
}

/** Os modelos do OpenRouter: cada família com as variantes, e um `:free` a cada sete. @param {boolean} reasoning */
function openRouterModels(reasoning) {
  /** @type {FakeCatalogModel[]} */
  const out = [];
  let seed = 1;
  for (const variant of VARIANTS) {
    for (const [vendor, prefix, families] of VENDORS) {
      for (const family of /** @type {string[]} */ (families)) {
        const name = `${vendor}: ${family}${variant}`;
        const id = `${prefix}/${slug(family + variant)}`;
        out.push(modelOf('openrouter', id, name, seed, reasoning, false));
        if (seed % 7 === 0) out.push(modelOf('openrouter', `${id}:free`, `${name} (free)`, seed, reasoning, true));
        seed++;
      }
    }
  }
  return out;
}

/** Os provedores que não são o OpenRouter, no formato do Pi do usuário. @param {boolean} reasoning */
function otherProviders(reasoning) {
  const plain = [
    ['openai-codex', 'gpt-5.5-codex', 'GPT-5.5 Codex'], ['openai-codex', 'gpt-5.5-codex-mini', 'GPT-5.5 Codex Mini'],
    ['opencode-go', 'kimi-k3', 'Kimi K3'], ['opencode-go', 'glm-5', 'GLM 5'], ['opencode-go', 'qwen3.5-coder', 'Qwen3.5 Coder'],
    ['commandcode', 'command-1', 'Command Code 1'], ['commandcode', 'command-1-mini', 'Command Code 1 Mini'],
    ['xai', 'grok-5', 'Grok 5'], ['xai', 'grok-5-mini', 'Grok 5 Mini'],
  ];
  return plain.map(([provider, id, name], at) => modelOf(provider, id, name, at + 1000, reasoning, false));
}

/**
 * Um catálogo de até `total` modelos (OpenRouter e os outros provedores do
 * usuário), sempre na mesma ordem.
 * `bigCatalog(450, {reasoning: true}).length` → `450`
 * @param {number} total
 * @param {{reasoning?: boolean}} [options]
 * @returns {FakeCatalogModel[]}
 */
export function bigCatalog(total, {reasoning = false} = {}) {
  const all = [...otherProviders(reasoning), ...openRouterModels(reasoning)];
  if (all.length < total) throw new Error(`bigCatalog: pedido ${total} modelos, o gerador só monta ${all.length}`);
  return all.slice(0, total);
}
