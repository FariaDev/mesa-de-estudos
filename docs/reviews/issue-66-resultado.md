# #66 — Página do celular com o trio ∫ Σ ∇

Protótipos de referência: `docs/design/setup-guia-r1/Celular-inicio`, `-enviando` e `-erro.dc.html` (locais, fora do git). A Folhinha dos protótipos foi trocada pelo trio, como pede a issue.

## O que mudou

### Três estados, um personagem por estado

A página (`desk/phone-page.cjs`) agora tem `main[data-state]`:

| Estado | Personagem | O que aparece |
|---|---|---|
| `start` | ∫ `normal`, 92px, ao lado do título | "Conectado à Mesa de Estudos" / "Foto para a Mesa"; o lead; **Tirar foto** (64px, no acento) e **Escolher da galeria**; cartão "Dica para a foto sair boa" com três itens; rodapé com o cadeado |
| `sending` | Σ `pensando`, 92px | cartão com "Enviando n de N…", "k prontas" e a barra (com o brilho enquanto envia); **Mais uma** e **Da galeria** lado a lado; grade "Enviadas desta vez" com o ✓ âmbar; lista "Enviado para a Mesa (n de N)" |
| `offline` | ∇ `aflita`, 140px, num cartão `role="alert"` | "Sem conexão com a Mesa."; "O celular está na mesma rede? Confira o Wi-Fi e tente de novo. As fotos que já chegaram continuam lá."; **Tentar de novo**. As enviadas continuam na grade |

- A página entra em `sending` na primeira foto e fica nele. As recusas do servidor (foto grande, tipo errado, cheio, Mesa parada) aparecem no cartão da barra, em vermelho, como antes.
- Só a falha de rede leva a `offline`. A foto que falhou e as que faltavam do lote ficam guardadas. **Tentar de novo** manda essas fotos de novo, e se a rede voltar a página volta para `sending`.
- A grade mostra a foto a caminho esmaecida e sem o ✓. Se ela falha, sai da grade.

### Desenho de uma fonte só

- `desk/phone-cast.cjs` (novo) monta o personagem de cada estado com o `mascoteMarkup` de `src/mascote.mjs` (via `require` do ESM, como outros `.cjs` já fazem com `src/i18n.mjs`). `PHONE_CAST` diz quem aparece em cada estado. O SVG não é copiado.
- **CSP:** o desenho traz atributos `style` (o tamanho, o pivô do lápis e as faíscas), e a CSP com nonce os recusaria. `liftInlineStyles` os troca por `data-style`, e o script da página, que tem o nonce, os aplica pelo CSSOM. Fica sem `unsafe-inline`.
- `phoneCastCss` junta:
  - os tokens `--t-*` e `--ease-*` lidos do `style.css`;
  - o bloco de movimento reduzido lido do `src/motion.css`;
  - o `src/trio.css` inteiro;
  - o layout novo em `src/phone-page.css`.

  O `main.cjs` lê os quatro arquivos uma vez e passa ao host (`castCss`), como já fazia com a paleta (`lookCss`).
- `src/phone-page.css` mora em `src/` de propósito: o portão de movimento (`tests/motion-tokens.test.mjs`) também cobre esse arquivo. A barra cresce por `scaleX`, sem transição de largura.
- O ✓ das fotos usa `--amber`, que vem do `AMBAR` de `trio-art.mjs`. Esse valor agora é exportado; antes ficava preso no módulo.
- **STIX:** não vai embutida. A página usaria ~160 KB a mais a cada abertura, e a CSP (`default-src 'none'`) não deixa carregar fonte. Os títulos usam `"STIX Two Text","Iowan Old Style",Charter,Georgia,serif`: a STIX do aparelho, se houver, ou uma serifa do sistema. No iPhone, cai na Iowan.
- **Movimento:** só o que o `trio.css` já faz (piscar, o "?" do Σ, o tremor do ∇) e o brilho da barra, tudo com os tokens da #63. Com `prefers-reduced-motion`, `--t-loop` e `--t-slow` viram 0s, cada um fica no quadro de descanso e o brilho some.

### Textos (pt-BR e en)

Chaves novas:

- `phone.page.connected`;
- `more`, `moreGallery`;
- `ready.one/other`;
- `networkHelp`, `retry`;
- `tipsTitle`, `tipFrame`, `tipLight`, `tipPage`.

Os nomes `tip.*` viraram `tip*` porque o teste de locales leria `tip.one` como plural.

`phone.page.network` agora é só o título: "Sem conexão com a Mesa." / "No connection to the Desk.". A pergunta passou para `networkHelp`.

O teste de tom da #64 (`setup-flow.test.mjs`) passou a cobrir também as chaves `phone.*`.

## Testes

- `tests/phone-cast.test.mjs` (novo, 6 testes):
  - personagem e humor de cada estado;
  - nenhum `style=` no desenho;
  - erro com o valor recebido e os estados aceitos;
  - o CSS com tokens, congelamento e trio;
  - erro quando falta token ou falta o bloco de movimento reduzido;
  - a página começa em `start`, com os três personagens.
- `tests/phone-host.test.mjs`: teste novo com o CSS real. A CSP continua sem `unsafe-inline`/`unsafe-eval`/`unsafe-hashes`, todo `<style>` e todo `<script>` executável leva o nonce, e o HTML não tem atributo `style`.
- `tests/phone-photo-ui.mjs` (janela): a página em 375×812, nos dois temas e nos três estados, com o personagem certo pelo contrato do módulo (classe `mascote-<id>`, `data-humor` e largura).
  - Com `reducedMotion: 'reduce'`, o piscar e os laços ficam em 0s. Sem a preferência, o personagem pisca.
  - Sem conexão: o teste fecha o popover, o que derruba o servidor. A foto seguinte cai no ∇, e "Tentar de novo" mantém o estado.
  - O console do celular não registra nenhuma violação de CSP.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok: 68 artefatos reproduzíveis, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 2000 passam, 0 falham (inclui `tsc` e `eslint`) |
| `npm run ui -- phone` | ok, 3 de 3 seguidas, depois da correção abaixo |

Também conferi a página servida pelo host de verdade (CSP ativa) numa aba de 375×812, nos três estados e nos dois temas. O console ficou limpo. Nessa conferência apareceu um bug meu: o ∇ sumia do cartão de erro, porque a regra que esconde o personagem do topo pegava também o do cartão. Corrigi antes do teste de janela, e o `expectCast` do estado offline cobre o caso.

## Correção pega no teste de janela

| Falha | Causa | Tipo | Correção |
|---|---|---|---|
| `phone-photo-ui`, intermitente: "a rotação 6 deixa a foto em pé" (veio 40×20) e "rotação 8 também fica em pé". Falhou 2 vezes em 3 antes da correção. | Cada foto que chegava ao renderer abria outro laço `releaseHeld` enquanto o anterior ainda desenhava a sua foto em pé. A PNG pequena terminava antes da JPEG girada e entrava na frente, e a bandeja ficava fora da ordem de envio. Vem da #36, não da página nova. | **bug do app** | Fila `src/phone-queue.mjs` (`createPhoneQueue`): um laço só, na ordem de chegada, e espera a resposta do tutor terminar como antes. Regressão: `tests/phone-queue.test.mjs` (uma foto lenta seguida de uma rápida), além do próprio `phone-photo-ui`. |

## Decisões em aberto (com recomendação)

1. **Recusa do servidor não é "Sem conexão".** Foto grande, tipo errado, cheio e Mesa parada ficam no cartão da barra, com o Σ. O ∇ só aparece na falha de rede, como na tabela da issue.
   - *Recomendo manter.*
2. **STIX do sistema, não embutida.** Ver acima.
   - *Recomendo manter*: são ~160 KB por abertura num link de rede local.
3. **O "?" do Σ em tema escuro** é o violeta escuro do desenho, e fica com pouco contraste no fundo escuro. É o mesmo na Mesa.
   - *Recomendo tratar no trio, se for o caso, e não na página.*
