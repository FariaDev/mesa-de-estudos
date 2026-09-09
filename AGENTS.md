# Mesa de Estudos — instruções para agentes

Produto: mesa de referências local (Electron) ao lado do Xournal++. Código em `desk/` (app) e `visual-check/` (captura macOS).

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
- Conferir Xournal++ é só macOS.
- Preferir `config.json` a editar `renderer.mjs` / `index.html`. Só mexa no código se o pedido não couber no schema abaixo.

## Setup num computador novo

```sh
cd desk
npm ci
npm run setup
npm start
```

Depois: Configurações → nome da matéria + pasta de PDFs. O Pi autentica o provedor na primeira conexão.

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
