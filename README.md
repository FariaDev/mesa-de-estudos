# Mesa de Estudos

App local (Electron) de apoio ao estudo: dois PDFs independentes, calculadora numérica e Pi na mesma janela. A escrita continua no [Xournal++](https://xournalpp.github.io/).

```
Mesa de Estudos                         Xournal++
  enunciado + formulário (PDF)            escrita à mão
  calculadora local                       tentativa
  chat com o Pi
```

## Requisitos

- Node 22.19+ (exigência do Pi)
- [Pi](https://github.com/earendil-works/pi) (o `npm run setup` tenta instalar)
- PDFs da matéria numa pasta qualquer

## Começar

```sh
cd desk
npm ci
npm run setup
npm run doctor
npm start
```

Na primeira abertura: pasta de dados + pelo menos uma matéria (nome e pasta de PDFs). O Pi pede as credenciais do provedor na primeira conexão; elas ficam no Pi, não neste app.

`npm run doctor` confere Pi, políticas, fontes, extensão visual e persistência sem abrir o app.

Instruções para um agente configurar o computador: [`desk/SETUP.md`](desk/SETUP.md).

## O que entra / o que não entra

- **Entra:** PDFs, calculadora, conversa com o Pi, configurações de pastas e nomes.
- **macOS:** botão Conferir Xournal++ (captura a janela do Xournal++ e anexa à mensagem; você escreve e envia quando quiser).
- **Windows:** PDFs, calculadora, Pi e Conferir Xournal++ (captura a janela do Xournal++ pelo PowerShell do sistema; Ctrl+V cola prints também).
- **Não entra:** canvas de tinta, edição de PDF, telemetria, conta na nuvem.

## Configurações

**Mesa → Configurações** (⌘ ,): pasta de dados, nomes das matérias, pastas de PDF, caminho do `pi`.

Um agente pode ir além (rótulos dos painéis, PDF inicial, um ou dois leitores) editando o bloco `desk` do `config.json`. Ver [`AGENTS.md`](AGENTS.md) e [`desk/config.example.json`](desk/config.example.json). O default do repositório permanece o da mesa do autor.

O app irmão **Conversa** (`chat/`) substitui o ChatGPT web no dia a dia: só chat, busca e histórico, sem matéria nem pasta de trabalho. Ver [`chat/README.md`](chat/README.md).

## Desenvolvimento

```sh
cd desk
npm test
node tests/ui-smoke.mjs
```

No Mac, se `Mesa de Estudos.app` já existir ao lado de `desk/`:

```sh
npm run install-app
```

## Créditos

- **Lucas Faria** — autor

Licença [MIT](LICENSE).
