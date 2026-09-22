# Mesa de Estudos — instruções para agentes

Produto: mesa de referências local (Electron) ao lado do Xournal++. Código em `desk/` (app) e `visual-check/` (captura macOS).

Há um app irmão em `chat/` (**Conversa**): chat geral com o Pi, sem pasta de projeto, sem PDF e sem tinta. Não misture features da Conversa na Mesa, nem o contrário.

A mesa do autor já está no jeito dele. **Não altere os defaults em `desk/config.cjs`** para “melhorar” o app dele. Para outra pessoa, personalize o `config.json` **dela**.

## Leitura

1. [`README.md`](README.md)
2. [`desk/SETUP.md`](desk/SETUP.md)
3. Esta seção **Customizar**
4. [`desk/config.example.json`](desk/config.example.json)
5. [`desk/README.md`](desk/README.md) só se precisar do fluxo de estudo
6. [`visual-check/README.md`](visual-check/README.md) só para Conferir Xournal++

## Regras

- Dois apps: Mesa + Xournal++. Não implementar canvas de tinta dentro da Mesa.
- Fale com o usuário no idioma dele.
- Não altere PDFs nem materiais de curso.
- Runtime da mesa: `desk/.runtime/` (não versionar).
- Não publique sessões JSONL, credenciais do Pi, capturas com material de curso, nem o bundle `Mesa de Estudos.app`.
- Conferir Xournal++ captura a janela do Xournal++ no macOS (`screencapture`) e no Windows (PowerShell do sistema); o helper `visual-check` continua sendo macOS.
- Preferir `config.json` a editar `renderer.mjs` / `index.html`. Só mexa no código se o pedido não couber no schema abaixo.
- Portão do núcleo: `npm run verify:bend` (em `desk/` ou `chat/`) exige a toolchain pinada e roda build + provas. O hook `.githooks/pre-push` o roda antes de todo push; `git push --no-verify` é a saída de emergência.

## Release (fluxo do updater por clique)

O updater da Mesa (Sobre → Atualizar e reiniciar) só funciona a partir da
v0.4.0 — a primeira versão que o contém. Para publicar `vX.Y.Z`:

1. snapshot no repositório público `FariaDev/mesa-de-estudos` e push na `main` dele
   (`git push --no-verify`: o `verify:bend` regenera também os artefatos do app
   irmão, que ficam fora da árvore pública e reprovam o portão);
2. tag `vX.Y.Z` no público;
3. `gh release create vX.Y.Z --notes "…"` — o corpo da Release é o "o que mudou" mostrado no app.

Quem prefere terminal (ou recuperação) usa `npm run update` em `desk/`:
checa, aplica (git/bundle/zip), roda `npm ci` só se o lock mudou, re-sincroniza
o bundle no macOS e reabre. Comportamento real, por modo:

- **zip** (instalação sem git): baixa a tag anunciada, valida a versão dentro
  do zip ANTES de copiar e substitui só o que o manifesto da instalação
  gerencia (`desk/.update-manifest.json`) — órfão gerenciado sai, arquivo
  local fica. `--versao X.Y.Z` seleciona versão aqui.
- **git/bundle** (clone): `git pull --ff-only` na branch de
  DESENVOLVIMENTO — não baixa a tag; `--versao` não seleciona versão
  (recusado com explicação) e a versão final é lida do `package.json`
  (divergência da tag anunciada é aviso no log, nunca "vX no lugar").
- Clone com **trabalho local** (arquivo rastreado modificado) é recusado antes
  de qualquer mutação — commit/stash e rode de novo. Nada é destruído.

Falhou = rollback automático: instantâneo dos arquivos gerenciados (nunca da
raiz toda), `git reset --hard` para a cabeça anterior (só com o clone limpo)
e `npm ci` de recuperação quando as dependências foram mexidas; a versão
antiga reabre com o motivo em `.runtime/desk.log`. Se a própria recuperação
falhar, o **backup é preservado** (caminho no log) e o Sobre mostra
"recuperação incompleta". A atualização tem lock compartilhado entre
Sobre/Atualizar Pi/CLI e handshake do worker (o app só fecha depois de o
worker confirmar que subiu; sem Node do sistema, aborta com o app de pé).

## Setup num computador novo

```sh
cd desk
npm ci
npm run setup
npm start
```

Depois: Configurações → nome da matéria + pasta de PDFs. O Pi autentica o provedor na primeira conexão.

## Mapa para agentes (onde cada coisa mora)

Para não se perder entre as camadas — a regra do repo: **a lógica que nunca
pode quebrar mora no núcleo Bend (com leis+provas); o aplicador cola no DOM; o
IPC liga ao main; os testes cobrem os dois lados.**

| Feature | Núcleo (lei/prova) | Artefato | Aplicador/host | IPC | Testes |
|---|---|---|---|---|---|
| Diálogos (Pi, Encerrar, imagem, Configurações, Ajuda/Sobre) | `core/dialogsview.bend` + `laws/`+`proofs/` | `desk/src/generated/dialogsview.core.js` | `desk/src/dialogs.mjs` | — | `tests/dialogsview.test.mjs`, `ui-smoke` |
| Boas-vindas da primeira abertura | idem (blocos `welcome*`) | idem | `renderWelcome` + `main.mjs` | — | idem + bloco PRIMEIRA ABERTURA |
| Updater (checagem/aplicação/rollback) | — (host puro) | — | `desk/updater.cjs`, `scripts/update-cli.mjs`, `scripts/install-app.mjs` | `update-check/apply/pi`, `update-result`, `open-log` | `tests/updater.test.mjs`, `updateflow.test.mjs`, `gitreal.test.mjs`, bloco ATUALIZACAO |
| Painel Componentes | `nodeState`/`componentIds` (dialogsview) | idem | `desk/components.cjs` | `components` | `tests/components.test.mjs` |
| Chat/Conferir (anexo) | `core/talkview`/`attachview`/`attachments` | idem | `desk/src/chat.mjs` + `src/capture-lock.mjs` | `capture-ready` | `tests/capture-lock.test.mjs`, `talkview.test.mjs`, hunt |
| Framing do Pi | `core/framing.bend` | idem | `desk/rpc.cjs` | — | `tests/framing-parity.mjs` |
| Diário do turno | `core/worklog.bend` | idem | `desk/src/worklog.mjs` | eventos | `tests/worklog*.test.mjs` |
| Leitor de PDF | `core/pdfview`/`pdfpageview`/`find` | idem | `desk/src/pdf.mjs` | `read-pdf` | `tests/pdf*.test.mjs`, `find-parity.mjs` |
| Matérias/biblioteca | `core/courses.bend`/`library.bend` | idem | `desk/courses.cjs`, `desk/config.cjs` | `get/save-config` | `tests/lib*.test.mjs`, `subjects.test.mjs` |
| Estado/tema | `core/state.bend`/`statusview`/`toastview` | idem | `desk/src/state.mjs`, `state-adapter.cjs` | `save-state` | `tests/state-parity.mjs`, `toast-view.test.mjs` |

Leis novas em `core/laws/` têm de fechar em `core/proofs/` (cenários concretos)
e os artefatos regenerados vão commitados (`desk/src/generated/*`).

## Customizar para este usuário

Peça (ou infira) matérias, pastas de PDF, se quer um ou dois leitores, e como o arquivo do enunciado/formulário se chama. Aí edite o `config.json` **local**, não o repositório, a menos que o usuário queira versionar o dele.

Onde está o arquivo:

- macOS: `~/Library/Application Support/Mesa de Estudos/config.json`
- Windows: `%APPDATA%/Mesa de Estudos/config.json`
- Se `LEARNING_DESK_RUNTIME` estiver definido: `<runtime>/config.json`

A UI **Mesa → Configurações** muda pastas e nomes de matéria e **preserva** o bloco `desk`. Depois de editar `desk` no JSON, peça para reabrir o app.

### Schema (`desk`)

Defaults (o jeito do autor — deixe assim se o usuário não pediu o contrário):

```json
{
  "desk": {
    "title": "Mesa de Estudos",
    "calculator": true,
    "xournal": true,
    "conferir": true,
    "refsToggle": true,
    "endDay": true,
    "studyContext": true,
    "panels": [
      { "label": "Enunciado", "prefer": ["Limites"] },
      { "label": "Formulário & apoio", "prefer": ["Formul"], "toggle": "Formulário" }
    ]
  }
}
```

| Campo | Efeito |
|---|---|
| `title` | Nome na barra e no título da janela |
| `calculator` | `false` esconde a calculadora |
| `refsToggle` | `false` esconde o botão Referências (as referências continuam indo ao Pi) |
| `endDay` | `false` esconde Encerrar por hoje |
| `studyContext` | `false` esconde Lista/questão ativa e o Rascunho `.xopp` |
| `xournal` | `false` esconde o botão Xournal++ |
| `conferir` | `false` esconde Conferir Xournal++ |
| `panels` | 1 ou 2 leitores. `label` é o título do painel. `prefer` são trechos do nome do PDF (sem acento importa; “Limites” pega `Limites.pdf`). O 1º painel pega o primeiro `prefer`; se não houver, um arquivo que não case com o outro painel. `toggle` é o texto do botão que recolhe o 2º painel. Um item só em `panels` = um PDF. |

`courses` (já na Configurações): `id`, `name` (rótulo), `path` (pasta de PDFs, com ou sem `_state.md`).

Tutor: copie e edite `desk/templates/TUTOR.md` e `LEARNER.md` para a pasta de dados do usuário (ou a matéria). Não edite os templates do repo salvo pedido explícito.

### Exemplos de pedido

- “Só uma lista de exercícios, sem formulário” → `"panels": [{ "label": "Lista", "prefer": ["lista", "exerc"] }]`
- “O enunciado é a prova, o apoio é a tabela” → `prefer: ["prova"]` e `prefer: ["tabela"]`
- “Não uso Xournal++” → `"xournal": false, "conferir": false`
- “Renomeia para Mesa da Ana” → `"title": "Mesa da Ana"`

### O que não cabe no JSON

Traduzir a UI inteira, mudar o número de painéis para 3+, tema, ou colocar tinta dentro da mesa. Explique o limite e, se o usuário insistir, altere o mínimo em `desk/index.html` / `desk/style.css` / `desk/renderer.mjs` numa cópia local — não force isso no default do autor.
