import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {installPrototypeMethods} = require('../src/prototype-mixins.cjs');

test('installPrototypeMethods instala métodos e getters com o mesmo this, não enumeráveis', () => {
  class Owner { constructor() { this.n = 2; } own() { return this.double(); } }
  class Extra { double() { return this.n * 2; } get triple() { return this.n * 3; } }
  installPrototypeMethods(Owner, [Extra]);
  const owner = new Owner();
  assert.equal(owner.own(), 4);
  assert.equal(owner.triple, 6);
  assert.deepEqual(Object.keys(Owner.prototype), []);
  assert.equal(Owner.prototype.constructor, Owner);
});

test('installPrototypeMethods recusa método repetido, com o nome e a origem', () => {
  class Owner { same() {} }
  class Extra { same() {} }
  assert.throws(() => installPrototypeMethods(Owner, [Extra]), /método repetido ao montar Owner: same \(vindo de Extra\)/);
});
