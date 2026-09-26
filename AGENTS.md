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
- Rodada local: `npm test` usa cache do portão por conteúdo (`core/**`, artefatos gerados, verificadores de paridade com os hosts que eles importam, e `package.json`; `MESA_GATE_CACHE=0 npm test` força) e `npm run hunts` roda os `tests/hunt-*.mjs` em paralelo (2 por vez). O hook de push continua sem cache.

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
| Ponte RPC do Pi (estado, timeout, aviso de linha torta, kill) | `core/rpcstate.bend` (+`laws/`+`proofs/`) | `desk/src/generated/rpcstate.core.js` e `chat/src/generated/rpcstate.core.js` | `desk/rpc.cjs`, `chat/rpc.cjs` (`onGarbage` → `desk_warn`/`pi_warning`; nunca `desk_error`) | — | `tests/rpc.test.mjs` (dos dois apps) |
| Diário do turno | `core/worklog.bend` | idem | `desk/src/worklog.mjs`, `chat/src/worklog.mjs` | eventos | `tests/worklog*.test.mjs` |
| Linha do tempo do turno (a fala fecha a rodada; rodada nova nasce embaixo) | — (host puro; `chat/src/worklog.mjs#historyTurns` + `parts`) | — | `chat/src/chat.mjs`, `chat/src/worklog-view.mjs` | — | `tests/worklog.test.mjs`, `tests/hunt-mcp.mjs`, `hunt-transcript.mjs` |
| Guarda de MCP (auto-correção do agente: truncamento, ferramenta inexistente, repetição que falhou) | — (extensão do Pi, host puro) | — | `chat/extensions/mcp-guard/`, `chat/pi.cjs` | — | `tests/mcp-guard.test.mjs` |
| Passo aberto do diário (prévia some, texto cresce) | `core/worklogview.bend` (`previewHidden` + `laws/`+`proofs/`) | `desk/src/generated/worklogview.core.js` e `chat/src/generated/worklogview.core.js` | `desk/src/worklog-view.mjs`, `chat/src/worklog-view.mjs` + o teto de `.step-text` no CSS | — | `tests/worklog-view.test.mjs`/`worklogview.test.mjs`, `tests/hunt-chat.mjs` (bloco `thinking-open`) |
| Fila do composer e steer | `core/composerview.bend` + `core/pending.bend` (+`laws/`+`proofs/`) | `desk/src/generated/composerview.core.js`, `desk/src/generated/pending.core.js` e `chat/src/generated/composerview.core.js` | `desk/src/queue.mjs` (Conversa: `chat/src/features/queue.mjs`), `desk/pending.cjs` (fila e bandeja no disco, por conversa), `desk/src/main.mjs` (`#prompt`) | `pi-prompt` (`streamingBehavior`), `pending-save`, `tray-save` | `tests/pending.test.mjs`, `tests/hunt-queue.mjs`, `ui-smoke` (bloco `fila-guardada`) |
| Encerrar por hoje e retomada | `core/resume.bend` (+`laws/`+`proofs/`) | `desk/src/generated/resume.core.js` | `desk/resume.cjs` (registro no disco, por matéria), `desk/src/resume.mjs` (cartão), `desk/src/main.mjs` (`#end-day-form`) | `end-day-save`, `resume-clear` | `tests/resume.test.mjs`, `tests/core.test.mjs`, `tests/hunt-shell.mjs` (cenário `encerrar`) |
| Leitor de PDF | `core/pdfview`/`pdfpageview`/`find` | idem | `desk/src/pdf.mjs` | `read-pdf` | `tests/pdf*.test.mjs`, `find-parity.mjs` |
| Navegação resposta → material (citação clicável, favoritos, Voltar, sumário) | `core/pdfref.bend`/`core/pdfnav.bend` (+`laws/`+`proofs/`) | `desk/src/generated/pdfref.core.js`, `desk/src/generated/pdfnav.core.js` | `desk/src/chat.mjs` (linkify), `desk/src/nav.mjs`, `desk/bookmarks.cjs` (disco por matéria) | `bookmarks-save` | `tests/pdfnav.test.mjs`, `tests/bookmarks.test.mjs`, `tests/hunt-nav.mjs` |
| Caderno de revisão | `core/review.bend` (+`laws/`+`proofs/`) | `desk/src/generated/review.core.js` | `desk/review.cjs` (disco por matéria), `desk/src/review.mjs` (aba), `desk/src/dialogs.mjs` (diálogo) | `review-save` | `tests/review.test.mjs`, `tests/hunt-review.mjs`, `ui-smoke` |
| Calculadora (ajuda, guia, ângulo) | `core/calcview.bend` (+`laws/`+`proofs/`) | `desk/src/generated/calcview.core.js` | `desk/src/calc.mjs` (aplica a árvore), `desk/calculator.mjs` (avalia: recíprocas, inversas e ângulos exatos; precisão dupla, sem `eval`) | — | `tests/calcview.test.mjs`, `tests/core.test.mjs`, `ui-smoke`, `tests/hunt-calc-ggb.mjs` |
| Matérias/biblioteca | `core/courses.bend`/`library.bend` | idem | `desk/courses.cjs`, `desk/config.cjs` | `get/save-config` | `tests/lib*.test.mjs`, `subjects.test.mjs` |
| Estado/tema | `core/state.bend`/`statusview`/`toastview` | idem | `desk/src/state.mjs`, `state-adapter.cjs` | `save-state` | `tests/state-parity.mjs`, `toast-view.test.mjs` |
| Perfil de carregamento da Mesa | — (host puro) | — | `desk/profiles.cjs` | — | `tests/profiles.test.mjs`, `npm run profile` |
| Bilhete Conversa → Mesa | `core/handoff.bend` + `laws/`+`proofs/` | `desk/src/generated/handoff.core.js` **e** `chat/src/generated/handoff.core.js` | `desk/handoff.cjs` (protocolo: reivindica, marca o envio, entrega, arquiva; `claimHand` mantém um bilhete na mão por vez), `desk/send.cjs` (ciclo do envio: validar → conectar → marcar → escrever → confirmar), `chat/handoff.cjs` (escreve) | `handoff` (chat) | `tests/handoff.test.mjs`, `tests/send.test.mjs`, `tests/hunt-handoff.mjs`, `appcontract.test.mjs` |

O bilhete passa por fases no disco, e o nome do arquivo diz a fase:
`conversa.json` (pendente) → `reivindicado-*` (em uso; o envio ainda NÃO começou)
→ `enviando-*` (envio iniciado, confirmação pendente) → `entregue-*` (o Pi
aceitou) → `arquivo/`. `falha/` guarda o que não vira contexto e `duvida/` guarda
o que pode ter chegado sem confirmação. **Nada é apagado nesse caminho.** Só
`reivindicado-*` volta para a fila: a marca de envio iniciado é gravada antes da
primeira escrita no Pi (`beginDelivery`) e, se não puder ser gravada, nada é
enviado. Na abertura, `recoverClaims` devolve `reivindicado-*` à fila (queda antes
do envio), manda `enviando-*` para `duvida/` (queda no meio do envio: nunca
reenvia sozinho) e arquiva `entregue-*`; o que já foi entregue nunca volta para a
fila, para não repetir contexto. Sem identidade no contrato do Pi, não há entrega
exatamente uma vez: a falha de envio é *recusada* (nada escrito) ou *ambígua*
(pode ter sido escrita), e as duas vão para lugares diferentes.

A ordem do envio (validar anexo → conectar → marcar o envio → escrever →
confirmar → ler o estado) e o momento em que `lastContextKey` é atualizado moram
em `desk/send.cjs`, não no main: é o que permite provar por comportamento
(`tests/send.test.mjs`) que uma falha antes da aceitação não consome o bilhete
nem o contexto. O `main.cjs` só decide **quando** chamar; o objetivo do bilhete
vem do que a conversa tem (`title`/`preview`), nunca do rótulo decorado — conversa
vazia não manda "Nova conversa" como assunto.

Durante a execução a Mesa mantém no máximo UM bilhete na mão (`claimHand`): cada
mensagem procura um pendente — o bilhete que a Conversa escrever DEPOIS da
primeira mensagem é reivindicado na mensagem seguinte, não só no próximo
reinício — e o que chega com outro na mão espera a vez. O aceite (e a entrega
incerta) solta a mão; a recusa comprovada a mantém para a próxima tentativa, e o
caminho guardado acompanha a fase do arquivo a cada transição.

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
