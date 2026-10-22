# Issue #44 — Começar sem plano pago: modelos gratuitos do OpenCode Zen pelo Pi

Branch `claude/busy-wescoff-117e00`. Sem push, sem PR, sem comentário na issue.
Nenhum modelo foi chamado (nem grátis): tudo roda com fakes com nome.

## O que a pessoa vê

1. **Primeira abertura** (Pi achado): ao lado de "Chamar o tutor", o botão
   **Usar modelos grátis**. O mesmo caminho está em Configurações → Pastas e
   programas → **Modelos gratuitos (OpenCode Zen)**.
2. **Cartão de aviso** antes do site: precisa de conta no OpenCode; o site pode
   pedir cartão/saldo (a Mesa não conseguiu confirmar — ver abaixo, "confira no
   console"); modelos **Grátis** não cobram e como evitar cobrança por engano;
   a chave fica só neste computador. Então abre `https://opencode.ai/auth` no
   navegador do sistema.
3. **Chave**: quando a Mesa volta ao foco, lê a área de transferência **só ali**;
   se parece chave (`sk-…`), pergunta **"Usar esta chave?"** com a máscara
   (`sk-••••4444`). Recusar não guarda nada e não pergunta de novo pela mesma
   chave. Campo manual continua. Atalho **"Usar a chave do OpenCode deste
   computador"** aparece só se o arquivo existe (a Mesa só verifica existência) e
   diz qual arquivo vai ler; a leitura é no clique.
4. **Automático**: teste só em `/inference/v1/models` (sem inferência) com frases
   distintas para rede, chave recusada, conta sem cobrança, formato que não é
   chave; guarda; religa o tutor; escolhe como padrão o primeiro modelo
   recomendado **de retenção zero** que o Pi oferece; o seletor abre com ele
   marcado **Grátis** e a frase *"Pronto. O tutor está usando um modelo grátis
   que não guarda suas mensagens."*
5. **Seletor**: cada modelo grátis leva **Grátis** + política de dados (*Não
   guarda nem treina*, *Pode usar para treinar*, *Só teste: não mande dados
   pessoais*, *Guarda por 30 dias, não treina*, *Treina modelos da Meta*, ou
   *Sem informação de privacidade*) e, só se a lista ao vivo do Zen foi
   conferida e o modelo não está nela, *Pode ter saído do plano gratuito*.
   `jev-1.13-free` fica fora (o Pi não o chama; motivo em `free-models.json`).
   Modelo pago do Zen pede confirmação **uma vez** ("Este modelo cobra por uso").
6. **Configurações**: campo com a chave mascarada, Testar, Criar uma chave,
   Remover, e o bloco **Como evitar cobrança** (desligar a recarga automática é o
   que de fato segura; limite mensal ajuda mas não segura a recarga; usar só
   modelos Grátis). Tudo nos dois idiomas (`freeModels.*`).

## Decisões

- **Onde mora a chave:** cifrada pelo cofre do sistema (`safeStorage` do Electron)
  em `opencode-key.bin` na pasta de dados; o Pi a recebe como `OPENCODE_API_KEY`
  no **ambiente** ao nascer (o Pi 1.3.0 instalado lê essa variável para o
  provedor `opencode`). Não escrevi no `auth.json` do Pi: seria mexer no perfil
  `~/.pi` do usuário, fora do escopo. Nunca em `config.json`, `desk.json`, log ou
  linha de comando. Sem cofre (Linux sem chaveiro, `basic_text`), a Mesa **não
  guarda** e diz isso — não há texto plano de reserva.
- **Teste da chave com `Authorization: Bearer`:** a lista de modelos é pública
  (200 sem chave) — conferido na rede antes de escrever o código; só com a chave
  no cabeçalho a resposta distingue chave válida (200) de recusada (401). Sem o
  cabeçalho "Testar" não validaria nada.
- **Núcleo Bend** (`core/freemodels.bend`, 49 leis/provas): o que vale como chave
  e a máscara, o resultado do teste e sua frase, o que é grátis, a política, o
  aviso do pago, "pode ter saído", o padrão e a frase final. `core/firstrun.bend`
  ganhou `freeModelsButton`. Artefatos regenerados e commitados.
- **Botão da primeira abertura aparece sempre que o Pi foi achado**, não só
  quando "nenhum provedor está autenticado": saber isso exigiria ler as
  credenciais do Pi, o que a tarefa proíbe. Custo: quem já usa o Pi vê um botão
  a mais até chamar o tutor.
- **Padrão recomendado provisório** (`recommendedVerified: false`): a ordem de
  `free-models.json` é palpite até o roteiro manual rodar (item 3 da issue). A
  garantia que importa é testada: recomendado só com retenção zero.
- **Item 4 (integração direta do OpenCode) não foi necessário**: o caminho pelo
  Pi funciona (provado com o Pi falso, por ambiente).

## Fatos de cobrança e fontes (conferidos em 2026-10-17, sem criar conta)

- **O console exige cartão?** *Não confirmado.* <https://opencode.ai/docs/zen/>
  diz "add your billing details and credits, and copy your API key"
  (sugere que dados de cobrança fazem parte do início), mas não diz se são
  obrigatórios para modelos grátis, e criar conta para ver a tela estava vetado.
  O cartão de aviso diz que o site **pode** pedir cartão ou saldo e manda
  conferir no console antes de informar qualquer cartão. **Pendência para quem
  tiver conta:** conferir a tela e ajustar `freeModels.card.billing`.
- **Recarga automática:** a mesma página: saldo abaixo de US$ 5 recarrega US$ 20;
  dá para mudar o valor ou desligar. A página não diz se vem ligada por padrão.
- **Limite mensal:** a página dá o exemplo de US$ 20 e avisa que a recarga
  automática ainda pode gerar cobrança acima do limite (por isso o texto "ajuda,
  mas não segura a recarga").
- **Política de dados dos grátis** (tabela de `desk/free-models.json`, conferida
  em 2026-10-17 em <https://opencode.ai/docs/zen/>): em geral retenção zero e sem
  treino, com exceções: Big Pickle pode usar dados para melhorar o modelo; Beam
  Free retém 30 dias; Muse Spark 1.3 Contributor Free treina modelos da Meta.
  `cat-jam-free` e `step-5-preview-free` vêm da conferência de 2026-10-15 da
  issue (a página de hoje já não os lista).
- **Onde o OpenCode guarda a chave:** `~/.local/share/opencode/auth.json`
  (<https://opencode.ai/docs/providers/>; `XDG_DATA_HOME` vale). A página não
  confirma que `opencode auth login` use o mesmo arquivo. A Mesa só testa se ele
  existe e o lê no clique.

## Portões (em `desk/`)

- `npm run verify:bend` — ok (67 artefatos reproduzíveis, provas verdes).
- `MESA_GATE_CACHE=0 npm test` — 1440 testes ok, 0 falhas (inclui
  `opencode-host.test.mjs`, `model-options.test.mjs`, paridade dos catálogos).
- `npm run ui -- settings,accent,color-roles,about,guide,first-run,tutor-states,language,model-indicator,composer,dialog-standard,free-models`
  — 16 ok, 0 falhas. Na primeira rodada `settings-sections-ui` reprovou
  (inventário de campos sem os da chave: corrigido) e `free-models-ui` estourou
  o prazo (o console falso mantinha o processo vivo: `server.unref()`).
- Não rodei `node tests/native-*.mjs`: não toquei o perfil do Pi nem as extensões.
- Não rodei `npm run hunts` nem a rodada cheia (fica para o main, como combinado).

## Provas de "pronto quando"

- Fluxo curto na janela, sem rede real: `desk/tests/free-models-ui.mjs` (botão →
  cartão → link aberto → foco sem chave → "Usar esta chave?" com máscara →
  recusa não guarda → teste → chave guardada → padrão grátis → seletor).
- Chave fora de `config.json`/`desk.json`/log: o mesmo teste varre **todo o
  runtime** e não acha a chave; o fake-pi registra que ela chegou só pelo
  ambiente (`keyInArgs: false`).
- Seletor com Grátis, política por modelo e padrão de retenção zero; modelo pago
  pergunta uma vez; Configurações e "Como evitar cobrança" nos dois idiomas.
- Medido nos dois temas em 1440×900 e 900×650: cartão (cabe, rodapé numa linha,
  raio 16 px, título 15 px) e bloco das Configurações (sem rolagem lateral,
  controle de 30 px).
- Capturas (só revisão visual, sem material de curso), fora do repositório:
  `/private/tmp/claude-501/-Users-would-Developer-learning-canvas--claude-worktrees-busy-wescoff-117e00/5d56ad99-ded7-48c1-89bd-f70927802148/scratchpad/capturas-44/`
  (cartão e configurações nos dois temas e tamanhos, "Usar esta chave?", pronto,
  seletor, modelo pago).

## O que não foi feito ou verificado

- **Roteiro manual** (`docs/manual/modelos-gratuitos.md`) escrito, **não
  executado** (gasta a chave de quem rodar). Por isso a ordem dos padrões é
  provisória.
- `safeStorage`, área de transferência, navegador e rede reais não foram
  exercitados (fakes: `fake-secret-cipher.cjs`, arquivo no lugar da área de
  transferência, `opened-links.jsonl`, `fake-opencode.mjs`). O gatilho do
  "Usar esta chave?" é o evento `focus` da janela; no teste é disparado à mão.
- O catálogo do Pi real não foi consultado: o `fake-pi-opencode.mjs` imita
  `cost` zero e ids do Zen. Se o Pi real não anotar custo zero, vale o sufixo
  `-free` e `big-pickle`.
- O texto do cartão sobre cartão/saldo precisa da conferência de quem tem conta.

## Arquivos

Núcleo: `core/freemodels.bend` + `laws/` + `proofs/`, `core/firstrun.bend`,
`core/build.mjs`, `core/PROOF.bend`. Host: `desk/opencode-host.cjs`,
`opencode-key-store.cjs`, `free-models.json`, `main.cjs`, `preload.cjs`.
Janela: `desk/src/free-models.mjs`, `model-options.mjs`, `state.mjs`,
`main.mjs`, `tutor-state.mjs`, `index.html`, `study-tools.css`, catálogos
`locales/*.json`. Testes e fakes: `opencode-host.test.mjs`,
`model-options.test.mjs`, `free-models-ui.mjs`, `fake-opencode.mjs`,
`fake-secret-cipher.cjs`, `fake-pi-opencode.mjs`, `fake-pi.mjs`,
`settings-sections-ui.mjs`. Docs: `docs/agents/mapa.md`, `docs/agents/customizar.md`,
`docs/manual/modelos-gratuitos.md`, `core/README.md`.
