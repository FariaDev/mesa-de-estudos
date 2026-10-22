# Mesa de Estudos — instruções para agentes

Mesa de referências local (Electron) ao lado do Xournal++. Código em `desk/` (app), `core/` (núcleo Bend) e `visual-check/` (captura macOS). Fale com o usuário no idioma dele.

## Regras invioláveis

- **Não altere os defaults de `desk/config.cjs`.** A mesa do autor já está no jeito dele; para outra pessoa, personalize o `config.json` **dela**. Prefira `config.json` a editar `renderer.mjs` / `index.html`.
- **Não altere PDFs nem materiais de curso.**
- **Não publique** sessões JSONL, credenciais do Pi, capturas com material de curso, nem o bundle `Mesa de Estudos.app`. O runtime fica em `desk/.runtime/` e não é versionado.
- **Dois apps:** a Mesa e um programa de escrita (Xournal++ por padrão; o Conferir aceita outra janela, e o app escolhido fica no estado de interface, fora do `config.json`). **Não implemente canvas de tinta na Mesa.**
- **Chat avulso mora na aba Livre da Mesa** (sessões e leitores da Mesa para estudo avulso, geração revisada de PDF e criação de matéria; aprovada pelo usuário em 2026-10-06). O app Conversa (`chat/`) foi aposentado na #50: o código está só na tag local `conversa-final`, e não volta a existir um segundo app de chat.
- **Invariante de domínio mora no núcleo Bend**, com leis em `core/laws/` e provas em `core/proofs/` que fecham; os artefatos regenerados (`desk/src/generated/*`) vão commitados. A pergunta é "se quebrar, o aluno perde algo ou o app faz o que não devia?". Interface (árvore de nós, texto, rótulo, posição) fica em JS com teste, e núcleo de interface antigo sai quando um ticket já mexer nele ([ADR 0001](docs/adr/0001-bend-so-para-invariantes.md)).
- **Passe pelos portões** abaixo antes de dar algo por pronto. O Conferir captura a janela do Xournal++ no macOS (`screencapture`) e no Windows (PowerShell); o helper `visual-check` é só macOS.

## Portões (em `desk/`)

```sh
npm ci && npm run setup && npm start   # computador novo
npm run verify:bend                    # toolchain pinada: build + provas; o hook pre-push o roda
MESA_GATE_CACHE=0 npm test             # sem o cache por conteúdo do portão
npm run hunts                          # tests/hunt-*.mjs, 2 por vez
npm run ui                             # testes de janela; `npm run ui -- composer,calc` filtra
```

`git push --no-verify` é só a saída de emergência. Detalhe em [`docs/agents/portoes.md`](docs/agents/portoes.md).

## Onde mora cada camada

1. Núcleo: `core/*.bend` com `core/laws/` e `core/proofs/`.
2. Artefato gerado: `desk/src/generated/*.core.js`.
3. Aplicador: `desk/src/*.mjs` cola no DOM; `desk/*-host.cjs` e `desk/main.cjs` ligam o resto.
4. IPC: `desk/preload.cjs` e os handlers `ipcMain`.
5. Testes: `desk/tests/`, cobrindo o núcleo e o aplicador.

Antes de mexer numa feature, procure a linha dela com `rg -n "termo" docs/agents/mapa.md`.

## Código

- Arquivo novo abaixo de 500 linhas. Função de 4 a 20 linhas, com early return e no máximo 2 níveis de indentação, como **meta** para código novo e reescrito, não como lei: não quebre função coesa só para bater o número.
- Uma responsabilidade por módulo.
- Nomes específicos, fáceis de achar com `rg`: nada de `data`, `handler`, `manager`, `utils`.
- Sem duplicação: o que os dois motores dividem sai de uma fonte só (como os `guide.mjs`).
- Mensagem de erro com o valor recebido e o formato esperado, sem caminho pessoal nem segredo.
- Comentário diz o porquê e cita o ticket ou commit; não o apague em refactor. Comentário que repete o código sai.
- Função pública ganha JSDoc com tipos, intenção e um exemplo.
- Função nova ganha teste; toda correção ganha teste de regressão.
- I/O externo nos testes entra por fakes com nome (como `fake-pi.mjs`), não por stubs inline.
- Dependência entra por parâmetro ou acessor (o padrão dos `*-host.cjs`); biblioteca de terceiros fica atrás de uma casca da Mesa.
- Não rode formatador no repositório inteiro: apagaria o `git blame` e colidiria com os tickets abertos. Mantenha o estilo do arquivo.

## Mais detalhe (leia só quando o trabalho pedir)

- [`docs/agents/mapa.md`](docs/agents/mapa.md): mapa de features (núcleo → artefato → aplicador → IPC → testes) e a nota sobre o bilhete Conversa → Mesa aposentado.
- [`docs/agents/release.md`](docs/agents/release.md): publicar versão e comportamento do updater.
- [`docs/agents/customizar.md`](docs/agents/customizar.md): `config.json`, schema `desk` e exemplos de pedido.
- [`docs/agents/portoes.md`](docs/agents/portoes.md): cache do portão, hunts, ui e capturas.
- Fluxo de estudo: [`desk/README.md`](desk/README.md). Conferir Xournal++: [`visual-check/README.md`](visual-check/README.md).
- Contexto de usuário novo: [`README.md`](README.md), [`desk/SETUP.md`](desk/SETUP.md) e [`desk/config.example.json`](desk/config.example.json).

## Agent skills

### Issue tracker

Issues vivem no GitHub Issues de `FariaDev/mesa-e-conversa` (remote `origin`), via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: um `CONTEXT.md` e `docs/adr/` na raiz. See `docs/agents/domain.md`.
