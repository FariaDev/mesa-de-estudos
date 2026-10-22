# Customizar a Mesa para um usuário

Contrato de personalização: onde mora o `config.json` local, o schema do bloco
`desk`, exemplos de pedido e o que não cabe no JSON. Vem do `AGENTS.md`, onde
ficava inteiro (#43). Consulte quando o pedido for ajustar a mesa de outra
pessoa.

Regra de partida: preferir `config.json` a editar `renderer.mjs` /
`index.html`. Só mexa no código se o pedido não couber no schema abaixo.

## Customizar para este usuário

Peça (ou infira) matérias, pastas de PDF, se quer um ou dois leitores, e como o arquivo do enunciado/formulário se chama. Aí edite o `config.json` **local**, não o repositório, a menos que o usuário queira versionar o dele.

Onde está o arquivo:

- macOS: `~/Library/Application Support/Mesa de Estudos/config.json`
- Windows: `%APPDATA%/Mesa de Estudos/config.json`
- Se `LEARNING_DESK_RUNTIME` estiver definido: `<runtime>/config.json`

A UI **Ajustes → Configurações** muda pastas, nomes de matéria, título e flags do bloco `desk`, além de um ou dois leitores, seus nomes, termos de preferência e botão do segundo leitor. A janela tem cinco seções na lateral: Matérias, Leitores, Recursos da mesa, Aparência e avisos, Pastas e programas. O tema Sistema/Claro/Escuro e a cor de acento ficam em Aparência e avisos, valem na hora e são estado de interface, não campo do `config.json` (Cancelar não os desfaz). As demais mudanças entram ao salvar; Cancelar e Esc descartam as edições de todas as seções, e matéria com nome sem pasta (ou nome repetido) mostra o erro ao lado do campo em vez de salvar. Após editar o JSON externamente, reabra o app.

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
| `refsToggle` | `false` esconde o botão Referências (as referências continuam indo ao Pi e aparecem na linha Vai junto) |
| `endDay` | `false` esconde Encerrar por hoje |
| `studyContext` | `false` esconde o `Editar` da linha Vai junto (questão ativa e Rascunho `.xopp`) e tira matéria, questão e rascunho do que vai com a mensagem |
| `xournal` | `false` esconde o botão Xournal++ |
| `conferir` | `false` esconde Conferir Xournal++ |
| `panels` | 1 ou 2 leitores. `label` é o título do painel. `prefer` são trechos do nome do PDF (sem acento importa; “Limites” pega `Limites.pdf`). O 1º painel pega o primeiro `prefer`; se não houver, um arquivo que não case com o outro painel. `toggle` é o texto do botão que recolhe o 2º painel. Um item só em `panels` = um PDF. |

`courses` (já na Configurações): `id`, `name` (rótulo), `path` (pasta de PDFs, com ou sem `_state.md`).

O editor de leitores preserva campos extras ao salvar. Campos vazios de nome, preferência e botão herdam os defaults normalizados; não representam preferência vazia. O chat lateral abre pelo cabeçalho do tutor e pode abrir também com um leitor; o segundo leitor se recolhe pelo menu Estudar e reabre pela faixa que fica no lugar dele. Seu histórico/rascunho ficam em `runtime/sidechats/`, escopados à conversa principal e matéria. Retomar não deve renovar o contexto herdado: use a ação explícita de atualização. Não reutilize a ponte, fila, permissões ou estado de envio do principal.

Tutor: copie e edite `desk/templates/TUTOR.md` e `LEARNER.md` para a pasta de dados do usuário (ou a matéria). Não edite os templates do repo salvo pedido explícito.

### Exemplos de pedido

- “Só uma lista de exercícios, sem formulário” → `"panels": [{ "label": "Lista", "prefer": ["lista", "exerc"] }]`
- “O enunciado é a prova, o apoio é a tabela” → `prefer: ["prova"]` e `prefer: ["tabela"]`
- “Não uso Xournal++” → `"xournal": false, "conferir": false`
- “Renomeia para Mesa da Ana” → `"title": "Mesa da Ana"`

### Idioma da interface e do tutor (#41)

O idioma **não é campo do `config.json`**: mora no estado de interface (`desk.json`, em `uiLanguage` e `tutorLanguage`), como o tema. Peça a troca em **Configurações → Aparência e avisos** (ou no seletor "Português · English" da primeira abertura); vale na hora e o Cancelar das Configurações não a desfaz.

- **Interface:** `pt-BR` ou `en`. Enquanto ninguém escolhe, segue o idioma do sistema (`pt*` → Português; qualquer outro → English) e nada é gravado.
- **Tutor:** *Acompanhar minhas mensagens* (padrão), *Português* ou *English*. A instrução entra pela base comum de `desk/src/agents/desk-prompts.cjs`, igual para Pi e Claude, e vale assim que o tutor for ligado: com o tutor ocioso a Mesa o religa na hora; durante uma resposta a nota "vale na próxima vez" continua e a Mesa religa quando a resposta acabar.
- **Frases:** `desk/locales/pt-BR.json` e `en.json`. Para outra língua ou outro texto, edite o catálogo — não o HTML nem o renderer. Os rótulos de leitor do `config.json` (`desk.panels`) são dado da pessoa e não passam pelo catálogo.
- Fases 1 e 2 da #41: a casca (barra superior, menus nativos, Configurações, primeira abertura), a coluna do tutor (caixa de mensagem e "Vai junto", estados, cabeçalho da sessão, chat lateral) e os leitores (barra, numeração, folha sem material) já trocam; Caderno, Estatísticas, Calculadora, Guia, Sobre, aba Livre e diálogo de material seguem em português até a fase 3 (ver `docs/reviews/issue-41-fase1-resultado.md` e `docs/reviews/issue-41-fase2-resultado.md`).
- Nas Configurações, os botões "abrir" e "Conferir" levam o nome do programa escolhido no Conferir; sem escolha dizem "programa de escrita".

### Modelos grátis, sem plano pago (#44)

Quem não paga plano de IA estuda com os modelos gratuitos do OpenCode Zen pelo Pi. **Não é campo do `config.json`**: a chave do Zen mora no cofre do sistema (Keychain, Credential Manager ou chaveiro do Linux, via `safeStorage` do Electron), em `opencode-key.bin` dentro da pasta de dados, **cifrada**, e vai ao Pi como `OPENCODE_API_KEY` no ambiente dele (nunca em `config.json`, `desk.json`, log ou linha de comando). O modelo escolhido fica em `desk.json` (`opencodeModel`) e o aviso de modelo pago aceito em `opencodePaidOk`.

- **Onde pedir:** botão **Usar modelos grátis** na primeira abertura (ao lado de "Chamar o tutor") ou **Configurações → Pastas e programas → Modelos gratuitos (OpenCode Zen)** (campo com a chave mascarada, Testar, Criar uma chave, Remover e "Como evitar cobrança").
- **Política de dados por modelo** é dado da Mesa, em `desk/free-models.json` (com data de conferência e fonte); a ordem de `recommended` define o padrão e só vale para retenção zero. Para outra pessoa, o que muda é a chave dela, não esse arquivo.
- **Sem cofre** (Linux sem chaveiro) a Mesa diz isso e não guarda a chave em texto: sem plano pago nesse computador, use o campo do Pi.
- As frases são do catálogo (`freeModels.*` em `desk/locales/*.json`), nos dois idiomas.

### O que não cabe no JSON

Traduzir a UI para uma terceira língua (a Mesa fala português e inglês; veja acima), mudar o número de painéis para 3+, ou colocar tinta dentro da mesa. Explique o limite e, se o usuário insistir, altere o mínimo em `desk/index.html` / `desk/style.css` / `desk/renderer.mjs` numa cópia local — não force isso no default do autor.

## Setup num computador novo

```sh
cd desk
npm ci
npm run setup
npm start
```

Sem configuração a Mesa abre uma tela cheia de passos (sem diálogo): boas-vindas, como a Mesa funciona, nome da matéria, pasta de PDFs (escolhida ou solta na tela), tutor opcional e pronto. A primeira matéria nasce em **Criar a matéria**, no último passo; a pasta de dados confirmada vai para o `config.json` local. O Pi autentica o provedor na primeira conexão.
