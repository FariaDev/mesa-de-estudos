/* Fake nomeado do estado da toolchain para os testes do portão do núcleo.
   A decisão (`gate-plan.mjs`) não lê disco nem spawna: recebe este estado. */
export function presentToolchain(overrides = {}) {
  return {
    present: true,
    plugin: '/fake/.bend/current/bend2/main.ts',
    bun: {bin: '/fake/.bun/bin/bun', version: '1.4.2'},
    bend: {bin: '/fake/.bend/bin/bend', version: 'bend 2.0.37'},
    missing: [],
    ...overrides,
  };
}

export function absentToolchain(overrides = {}) {
  return {
    present: false,
    plugin: '',
    bun: null,
    bend: null,
    missing: [
      'plugin em /fake/.bend/current/bend2/main.ts',
      'bun (BUN_BIN, ~/.bun/bin/bun ou PATH)',
      'binário do bend (bend)',
    ],
    ...overrides,
  };
}
