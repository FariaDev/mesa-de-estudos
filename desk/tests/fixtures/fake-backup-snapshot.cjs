'use strict';

/* Snapshot falso com nome para o agendador automático: falha `failures` vezes
   com `error` e depois devolve um snapshot de mentira. `waitFor` segura a
   tentativa em voo para o teste de simultaneidade. `take` recebe os mesmos
   argumentos que o `backupNow` real e anota cada chamada em `calls`. */

class FakeBackupSnapshot {
  /** @param {{failures?: number, error?: string, waitFor?: Promise<unknown>}} [options] */
  constructor({failures = 1, error = 'snapshot falhou (fake)', waitFor = null} = {}) {
    this.failuresLeft = failures;
    this.error = error;
    this.waitFor = waitFor;
    this.calls = [];
  }

  async take({root, now = Date.now()} = {}) {
    this.calls.push({root, now});
    if (this.waitFor) await this.waitFor;
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw Error(this.error);
    }
    const created = new Date(now).toISOString();
    return {snapshotId: `snap-fake-${this.calls.length}`, created, path: '', entries: 0};
  }
}

module.exports = {FakeBackupSnapshot};
