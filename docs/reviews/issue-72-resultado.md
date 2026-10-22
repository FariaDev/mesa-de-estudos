# #72 — Atualizar da 0.5.0 pelo zip deixava a Mesa sem abrir

Quem aplica o zip é o código da versão instalada. Na 0.5.0 a lista substituível é `src`, `assets`, `templates`, `scripts` e `tests`. `desk/locales/` nasceu depois e ficava de fora. O `require('./locales/pt-BR.json')` de `language-host.cjs` quebrava na abertura com `MODULE_NOT_FOUND`. Clone por git não passa por essa lista.

A correção põe os catálogos em `desk/src/locales/`. Uma pasta dentro de `src/` a 0.5.0 já copia. A lista da versão nova continua com `locales`, para o manifesto de quem já está na 1.0.0 ainda poder apagar `desk/locales/`.

Commits locais na branch `issue-72-locales`, sem push e sem PR.

## O que mudou

- `git mv` de `desk/locales/` para `desk/src/locales/` (`en.json` e `pt-BR.json`).
- Caminhos nos hosts, em `src/`, nos testes e nos scripts. `bundle-runtime.cjs` deixou de copiar `locales/` à parte, porque `src/` já leva os catálogos.
- Comentário em `updater-core.cjs` e `updater-files.cjs` (#72) explicando por que `locales` fica em `CODE_DIRS`. `tests/updater.test.mjs` continua afirmando que `desk/locales/en.json` é substituível por essa lista.
- `docs/agents/mapa.md`, `docs/agents/customizar.md` e os comentários de caminho em `core/` (`msg.bend`, `phonedrop.bend`, `laws/claudeversion.bend`, `README.md`). `docs/reviews/`, `docs/design/` e `docs/release-assets/v1.0.0/` ficaram como estavam. São o registro da época em que a pasta se chamava `desk/locales/`.
- Versão `1.0.1` em `desk/package.json` e no lock. Notas em `docs/release-assets/v1.0.1/notas.md`.
- Teste novo `desk/tests/updater-compat.test.mjs`. A fixture `desk/tests/fixtures/updater-rules-0.5.0.cjs` é uma cópia de `normalizeRel`, `isProtected` e `isReplaceable` da tag v0.5.0, com as constantes que elas usam. O teste não lê o zip.

Exceções no teste, nenhuma carregada ao abrir:

- `desk/.gitignore`, metadado do git.
- `desk/types/**`, só o `tsc`. O runtime cita esses arquivos em JSDoc.

## Falha do teste antes da correção

Rodado com os catálogos ainda em `desk/locales/`, antes do `git mv`:

```
node --test --test-timeout=30000 tests/updater-compat.test.mjs
```

```
✖ todo arquivo rastreado de desk/ é substituível pela regra da 0.5.0
  AssertionError [ERR_ASSERTION]: a regra da 0.5.0 recusou ["desk/locales/en.json","desk/locales/pt-BR.json"]; esperado dentro de src/, assets/, templates/, scripts/ ou tests/, ou na raiz do desk com extensão .cjs/.mjs/.html/.css/.md/.json
  + actual - expected

  + [
  +   'desk/locales/en.json',
  +   'desk/locales/pt-BR.json'
  + ]
  - []

ℹ tests 1
ℹ pass 0
ℹ fail 1
```

Depois do `git mv` o mesmo teste passa. `git ls-files desk` não recusa mais nenhum arquivo carregado na abertura.

## Ponta a ponta, fora do repositório

```
curl -sSL -o /tmp/v050.zip https://codeload.github.com/FariaDev/mesa-de-estudos/zip/refs/tags/v0.5.0
unzip -q /tmp/v050.zip -d /tmp/mesa-72-050
git archive --format=zip --prefix=mesa-de-estudos-1.0.1/ HEAD -o /tmp/v101.zip
```

O zip do HEAD tem 11165403 bytes. O `applyZip` chamado é o de `/tmp/mesa-72-050/mesa-de-estudos-0.5.0/desk/updater.cjs`, com o buffer de `/tmp/v101.zip`, `announcedVersion: '1.0.1'` e a raiz extraída. Em seguida, `writeManifest` e `removeOrphans`, como o ramo zip de `applyUpdate` faz. O zip da 0.5.0 não traz `.update-manifest.json`, então não havia órfão para apagar.

```
{
  "version": "1.0.1",
  "replaced": 1216,
  "skipped": 470,
  "created": 798,
  "written": 1216,
  "orphansRemoved": 0,
  "localeWritten": true,
  "localeExists": true
}
```

`desk/src/locales/pt-BR.json` existe na árvore atualizada. Em `desk/` dessa árvore:

```
node -e "require('./language-host.cjs')"
```

Saída vazia, exit 0. Não precisou de `npm ci`. O módulo só puxa o núcleo gerado, `src/i18n.mjs` e os dois JSON.

Bônus, Electron 44.7.2 já instalado em `desk/node_modules` do worktree, porque a árvore temporária não tem `node_modules`. `LEARNING_DESK_RUNTIME=/tmp/mesa-72-runtime` e `HOME=/tmp/mesa-72-home`, para não usar a pasta de dados de quem já tem a Mesa aberta. O processo ficou no ar 5 s, gravou cache em `/tmp/mesa-72-runtime/electron/` e foi encerrado no pid dele. O log não teve `MODULE_NOT_FOUND`. Só um aviso de sandbox do helper.

## Portões

Em `desk/`:

- `npm run verify:bend`: 68 artefatos reproduzíveis, nenhum byte mudou. `ALL PROOFS CHECK`. `verify: ok`.
- `MESA_GATE_CACHE=0 npm test`: sintaxe ok em 727 arquivos. `tsc` e `eslint` sem erro. `ALL PROOFS CHECK`. Paridade: `CORES PASSED` (60000 comparações) e `FIND PASSED` (20000). Testes: 2041 pass, 0 fail, 0 skipped. `duration_ms` 31597. Exit 0.
- `npm run ui -- language,about,first-run,ui-smoke`: 5 ok, 0 com falha, 0 pulados, 110 s. `about-ui.mjs`, `tutor-language-ipc-smoke.mjs`, `first-run-ui.mjs`, `language-ui.mjs`, `ui-smoke.mjs`. Nenhum precisou de segunda rodada.

## Commits

- `510c0d8` fix(desk): catálogos de idioma em src/locales (#72)
- `c01154c` test(desk): a regra do updater da 0.5.0 cobre o desk (#72)
- `2c7502d` release(desk): versão 1.0.1 (#72)
