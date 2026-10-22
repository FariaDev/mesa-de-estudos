# #41, fase 3: todas as telas em inglês e português

Resultado da fase 3 da issue #41 ("Mesa em inglês e português"). Com a interface
em `en`, nenhuma tela mostra português; em `pt-BR`, nenhuma mostra inglês. Nada
foi enviado: os commits ficam locais, na branch da worktree (sem push, PR ou
comentário na issue).

## O que mudou

**Telas traduzidas.** Caderno de revisão e Estatísticas; Calculadora, Guia, Sobre
e a aba Livre (com os diálogos de material e de modelos da #39); paleta de
comandos e "Encerrar por hoje"; aviso de atualização e biblioteca de sessões;
menus de contexto; painel do GeoGebra e menções `@` (#53); mensagens de erro do
processo principal que chegam ao aluno. O catálogo passou de 741 para 2190 chaves
por idioma (paridade de chaves e de argumentos conferida por
`tests/locales.test.mjs`).

**Texto que vai ao modelo segue o idioma do tutor**, não o da tela: instruções de
ferramenta (GeoGebra, menções `@`), blocos de `studycontext`, perguntas e
recusas do adaptador Claude, pedidos de resposta do chat lateral. O host usa
`languageHost.tutorLanguage()` / `tutorT()`; o renderer, `tutorText()`. Os logs
(`desk.log`, diagnósticos) continuam sempre em português.

**Política de erro.** O erro que o aluno pode ver no processo principal é uma
mensagem marcada (`message(chave, args)` de `src/i18n.mjs`) e é traduzido onde
aparece: o `preload.cjs` tira o prefixo "Error invoking remote method" do
Electron para a marca sobreviver ao IPC, e `toast`/`state.activity()` traduzem. O
erro dirigido ao modelo sai no idioma do tutor.

**Troca de idioma com tudo aberto.** Telas montadas uma vez agora se refazem no
evento `desk-language`: nome da sessão no cabeçalho e lista de sessões
("Sessão de …"/"Session of …"), nota do OpenCode nas Configurações, e as demais
já listadas nas fases 1 e 2.

## Núcleos Bend que saíram para JS (ADR 0001)

Interface (texto, rótulo, árvore) não é invariante de domínio. Onde a fase
precisava mexer num núcleo de interface, ele foi para JS com teste, em vez de
ganhar mais chaves em Bend:

| Antes (Bend) | Agora (JS) | Teste |
|---|---|---|
| prompts de revisão em `core/review.bend` | `desk/src/review-prompts.mjs` | `tests/review-prompts.test.mjs` |
| apresentação das Estatísticas em `core/studystats.bend` (cálculo e invariantes ficam no núcleo) | `desk/src/study-stats-text.mjs` | `tests/study-stats-text.test.mjs` |
| `summary` do layout em `core/mesaqollayout.bend` | `summaryOf` no aplicador | `tests/layout-presets.test.mjs` |
| títulos das seções da paleta | ids de seção + `t()` | testes da paleta (`rg -l palette desk/tests`) |
| `core/studycontext.bend`: bloco numa só frase | uma mensagem por linha (host junta), no idioma do tutor | provas e `tests/studycontext.test.mjs` |
| nomes de sessão Livre/matéria guardados | `desk/src/free-names.mjs` | `tests/free-names.test.mjs` |

Leis e provas dos núcleos que ficaram foram atualizadas e fecham; artefatos de
`desk/src/generated/*` regenerados e commitados.

## Decisões

- **Chave e argumentos, frase única no catálogo, junção no host** (mesma regra das
  fases 1 e 2): um núcleo não concatena mensagens nem passa mensagem como
  argumento de outra.
- **Calculadora:** o resultado fica guardado com ponto decimal e é formatado pelo
  idioma da tela na hora de pintar (`shown()` em `src/calc.mjs`): em pt-BR sai
  `0,5`; em en, `0.5`. O histórico e os rótulos acompanham.
- **Rótulos guardados em disco em português** (preview do "Conferir Xournal++",
  títulos de sessão Livre, nome de matéria padrão) são traduzidos na exibição
  (`STORED_CONFERIR_LABEL`, `displayFreeTitle`, `displayCourseName`), então o
  arquivo não muda de formato.
- **Exportação em Markdown** usa os rótulos do idioma da tela.
- **Janelas de limite de uso** viram fichas neutras; a causa de nova tentativa do
  Claude é o código cru.
- **Plural: zero é sempre a forma `other`.** O CLDR põe o zero de pt-BR em "one",
  e a Mesa dizia "1 item" para 0 itens (achado pelo `review-notebook-ui`).
  `pluralKey` agora trata `count === 0` como `other`; regressão em
  `tests/i18n.test.mjs`.
- **Rótulos de leitor do `config.json`** continuam dado da pessoa; os defaults de
  `desk/config.cjs` não mudaram.
- Vocabulário em inglês: sem "chat/thread/conversation" fora de Configurações e
  Sobre, exceto "side chat".

## Defeitos achados e corrigidos

Só apareceram rodando as janelas e a hunt:

- **Zero em pt-BR mostrava "1 item"** (acima), com regressão.
- **Nome da sessão e lista de sessões ficavam no idioma antigo** depois da troca:
  `tutor-header.mjs` e `main.mjs` agora se refazem em `desk-language`
  (`language-ui` varre `#chat` nos dois idiomas e pegou "Session of …" em pt-BR).
- **Nota do OpenCode nas Configurações** ficava em inglês depois de voltar a
  pt-BR (`free-models.mjs` ganhou o repintar).
- **`idle` do backup** sombreava `message` em `main.cjs` e o aviso perdia a
  mensagem; o parâmetro virou `reason`.
- **`text.mjs`**: `t` local escondia o import (`uiT`).
- **Testes que comparavam regex em português com a chave crua** passaram por
  `ptText`/`ptMatches`/`ptT` (`tests/pt-text.mjs`); os que comparavam decimal
  com ponto na calculadora (`calculator-ui`, `ui-smoke`,
  `responsive-chat-calc-ui`, `hunt-calc-ggb`) passaram a esperar `0,5`/`2,5`.
- **Esperas fixas** da hunt comentadas ("espera fixa: …") e o resto por
  `tests/waits.mjs`.

## A hunt de idiomas

`tests/hunt-language.mjs` (com `tests/language-sweep.mjs`) anda por todas as
telas em `en` e em `pt-BR`, nos dois temas e em 1440×900 e 900×650, e falha em
palavra do outro idioma, vocabulário proibido em inglês, mensagem de núcleo sem
tradução (U+E000 no texto ou em atributo) e texto cortado. Ficam fora da varredura
o texto do PDF e do material do curso, blocos marcados `lang="en"` (licenças,
Khan Academy) e o nome do titular dos direitos. O diálogo de modelos fica de fora
porque pede o tutor ligado (coberto por `language-ui` e pelos testes de host).

## Portões

Rodados nesta worktree; antes das janelas conferi por `pgrep` que não havia
Electron de outra worktree (o `Mesa de Estudos.app` do checkout principal estava
aberto, sem interferir).

| Portão | Resultado |
|---|---|
| `npm run build:bend` e `npm run verify:bend` | verde (67 artefatos reproduzíveis, "All terms check", nenhum `@unsafe`) |
| `MESA_GATE_CACHE=0 npm test` | 1471 testes, 0 falhas |
| `npm run ui` (completo) | 69 janelas; 67 ok na primeira rodada; `improvements-ui` e `language-ui` morreram por "o app não fechou em 15 s" sob carga (3 janelas em paralelo) e passaram juntos, isolados |
| `npm run ui -- calc,review-notebook,free-study-integration,material-template-dialog,sidechat-ipc,ui-smoke,activity-viz,language` | verde depois dos ajustes de texto (a falha de frame desanexado do `activity-viz-ui` não voltou) |
| `node tests/hunt-language.mjs` | sem palavra do outro idioma em `en` e `pt-BR` |
| `npm run hunts` | verde (`hunt-calc-ggb` e `hunt-qol-ipc` ajustados para as mensagens traduzidas) |

Não rodei `tests/bundle-payload-ui.mjs` nem `npm run test:packaged`: nenhum arquivo
de dados de inicialização foi criado (`locales/*.json` já estavam no bundle).
`tests/fake-pi.mjs` não mudou. Nenhuma inferência real, nenhum `claude auth`
(só `--version`), nenhum JSONL pessoal, credencial ou log de usuário lido.

## O que fica

Ainda em português **de propósito** (contrato interno, diagnóstico ou dado):

- Validações de contrato do `preload.cjs` ("X inválido"), cerca de 100 mensagens
  internas do adaptador Claude, ponte de atividade/material, diagnósticos de
  `free-workspaces`, promoção do Livre, updater, journal, zip/manifesto.
- Erros do KaTeX (em inglês), erros do cliente de extensões, mensagens do helper
  `visual-check`.
- Cabeçalhos do PDF dos modelos (template em português), marcadores do envelope
  enviados ao modelo (`[Ferramenta pedida na Mesa: …]`), o rótulo padrão
  "Formulário" (`formLabel`, dado do `config`), a prévia "Sessão indisponível…" e
  o "Revisão" de reserva do `main.cjs` do Claude.
- Logs (`desk.log`): sempre em português.
- `hunt-calc-ggb` imprime a nota conhecida "o botão Enviar … acertou SPAN"
  (calculadora alta sobre o composer, anterior à fase).

Próximo passo natural: rodar a bateria completa no `main` no lote dos tickets
(portões em lote) e, se aparecer, decidir se vale traduzir os diagnósticos acima.
