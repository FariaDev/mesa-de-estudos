# Issue #36 — Foto do celular: resultado

Branch `claude/zen-chaum-031cea`. Sem push e sem PR.

## O que entrou

- **Núcleo Bend `core/phonedrop.bend`**, com 42 leis em `core/laws/phonedrop.bend` e provas em `core/proofs/phonedrop.bend`. Ele guarda só os invariantes, como pede o ADR 0001:
  - o fluxo: desligado → esperando → recebeu N → parado / expirou / erro de rede;
  - a porta (`door`): servidor parado, token errado e caminho desconhecido dão o mesmo "fechado";
  - a foto (`photo`): tipo, foto vazia, teto por foto e por sessão, servidor parado no meio do envio;
  - os status HTTP, os limites e o prazo de 10 min.

  O artefato `desk/src/generated/phonedrop.core.js` foi regenerado e commitado.
- **Host (main):**
  - `desk/phone-host.cjs`: servidor, token, prazo e entrega ao renderer;
  - `desk/phone-image.cjs`: tipo pelos bytes, EXIF fora, rotação lida à parte;
  - `desk/phone-network.cjs`: escolha da interface;
  - `desk/phone-qr.cjs`: QR code sem dependência;
  - `desk/phone-page.cjs`: a página do celular.
- **Renderer:** `desk/src/phone-photo.mjs` (botão, popover, QR em SVG, foto em pé → bandeja) e `desk/src/phone-orientation.mjs` (a conta da rotação, sem DOM).
- **Catálogos:** um bloco novo `phone.*` em `desk/locales/pt-BR.json` e `en.json`, no lugar da ordem alfabética (entre `pending.*` e `popnote.*`). Nenhuma chave existente mudou.
- **Caixa de mensagem:** só o botão `#phone-photo` e o popover `#phone-pop`. Mais três ajustes pequenos:
  - `orderActions` agora respeita `data-follows`, para o botão ficar logo depois do Anexar sem mexer no núcleo `composerbox`;
  - o Esc conhece o `#phone-pop`;
  - a primeira abertura trava o botão como trava o Anexar.
- **Docs:**
  - Guia: tópico "Foto do celular" em O tutor, com `data-i18n`;
  - `docs/agents/mapa.md`: linha nova;
  - `desk/README.md`: uma linha;
  - `core/README.md`: módulo e contagens.

Nenhuma dependência nova no `package.json`. O bundle já copia todo `.cjs`/`.mjs` da raiz e `src/`, então os arquivos novos entram sem mudar `bundle-runtime.cjs`.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` (estrito) | **ok**: 68 artefatos reproduzíveis, nenhum byte mudou, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | **ok**: 1488 testes, 0 falhas (build, provas e paridade sem cache) |
| `npm run ui -- composer,attach,phone` | **ok**: `phone-photo-ui`, `composer-box-ui` e `composer-mentions-ui`, 3 de 3, sem repetição |
| `node tests/phone-photo-ui.mjs` sozinho, com capturas | **ok** (PASS). As capturas ficaram fora do repo e foram conferidas a olho: popover nos dois temas, em 1440×900 e 900×650, e a página do celular em 375×812 |
| `node tests/bundle-payload-ui.mjs` | **ok** |
| `npm run test:packaged` | **ok** |
| `npm run hunts` | **não rodado**, a pedido do orquestrador: fica para a bateria completa no main |

Os testes de janela foram liberados pelo orquestrador da sessão "UI/UX da mesa de estudos".

**Visto nas capturas, sem conserto nesta entrega:**
- O aviso "Foto do celular anexada" aparece por cima do canto do popover, porque os dois moram sobre a caixa.
- Com o popover aberto, as miniaturas da bandeja ficam por baixo dele.

Os dois somem ao fechar o popover e não escondem o estado nem o QR. Se incomodar, o ajuste é deslocar o aviso enquanto `#phone-pop` estiver aberto.

## O que cada teste prova sobre a segurança

`tests/phone-host.test.mjs` sobe o servidor de verdade em `127.0.0.1` e usa um cliente HTTP cru no papel do celular. O relógio é falso.

| Regra | Teste | O que prova |
|---|---|---|
| Sobe só a pedido | "só sobe a pedido" | criar o host não abre porta; o estado é `off` e não há endereço |
| Token por sessão, o resto é 404 | "sem token, com token errado ou em caminho que não existe" | raiz, token com um caractere trocado, token cortado, POST com token errado, `/photo` sem token, PUT e GET em `/photo` dão **404 com o mesmo corpo**: a resposta não diz se o token quase acertou; nenhuma foto entra |
| Token morre com o servidor | "depois de Parar, nada entra" | depois de Parar a conexão é recusada; Ligar de novo gera outro endereço; o token antigo no servidor novo dá 404 |
| Desliga sozinho | "depois de 10 minutos sem uso" | há um prazo só, de 600 000 ms; um pedido válido recomeça o prazo; quando ele vence, o estado vira `expired` e a conexão é recusada |
| Desliga sozinho (abuso) | "pedido sem token não segura o servidor ligado" | um pedido sem token não renova o prazo |
| Só imagens | "o tipo vale pelos bytes" | texto mandado como `image/jpeg`, corpo vazio, GIF e JPEG cortado dão 415 |
| Limite por foto | "acima do limite por foto" | 15 MB + 1 byte dá 413 (`size`), sem foto entregue |
| Limite por sessão | "acima do limite por sessão" | a 13ª foto dá 413 (`full`) |
| Não serve arquivo do disco | "nenhum caminho do disco é servido" | `/package.json`, `/main.cjs`, `../`, `%2e%2e`, `/etc/passwd` e `index.html`, também com o token na frente, dão 404 sem conteúdo do disco; a página é montada na memória |
| Página sem nada de fora | "com o token a página abre" | a CSP tem `default-src 'none'` e `no-store`; não há URL externa na página; ela segue o idioma da Mesa (`en` no teste) |
| EXIF sai | "o EXIF sai… e a rotação chega" | um JPEG com APP1 (orientação 6, descrição e IFD de GPS com marca) e COM chega sem a marca do GPS, sem o comentário e sem `Exif`; a orientação 6 vai à parte; os dados da imagem ficam idênticos |
| EXIF sai (PNG/WebP) | "PNG e WebP também saem sem metadados" | `tEXt` e `eXIf` saem do PNG; `EXIF` e `XMP ` saem do WebP; o tamanho do RIFF é refeito e as marcas do VP8X são desligadas |
| Sem rede local, nada escuta | "sem rede local" | só com VPN (`utun`), o estado é `error` e nada escuta |

Outros testes:

- As leis do núcleo provam o mesmo pelo lado da regra. Quatro exemplos:
  - `phone_porta_servidor_parado_fecha` e `phone_porta_sem_token_fecha` valem para qualquer caminho;
  - `phone_parar_nunca_fica_de_pe` e `phone_expirar_nunca_fica_de_pe` valem de qualquer estado;
  - `phone_status_parado_404`;
  - os tetos estão na fronteira exata.
- `tests/phone-parts.test.mjs` cobre a parte pura:
  - o Reed-Solomon bate com o exemplo da norma (HELLO WORLD 1-M);
  - versão, localizadores e relógio do QR;
  - a escolha de rede deixa fora VPN, ponte, contêiner, WSL, Tailscale e link-local;
  - as matrizes de rotação.
- `tests/escape-policy.test.mjs` ganhou o teste de regressão: o popover conta como popover, e o Esc fecha sem cancelar o turno.
- `tests/phone-photo-ui.mjs` cobre a janela:
  - o popover nos dois temas, em 1440×900 e 900×650;
  - duas fotos na bandeja, com o aviso e "2 fotos recebidas";
  - nenhuma fala na sessão e nenhum prompt no Pi falso (`FAKE_PI_QUEUE_LOG` vazio);
  - a foto com rotação 6 chega em pé (32×64, vermelho em cima), sem `Exif` nem GPS no data URL;
  - o Esc desliga o servidor;
  - a página do celular numa janela de 375×812, nos dois temas: sem rolagem lateral, botões com 44 px ou mais, `capture="environment"`, e o envio pela galeria da própria página (rotação 8) chega à bandeja.

O QR code também foi conferido à mão com o leitor do macOS (`CIDetector`, num script fora do repo): ele leu as versões 1, 4, 9 e 10 e as oito máscaras.

## Decisões tomadas por conta própria

1. **O que fica no Bend.** Fluxo, porta, regras da foto, limites e prazo ficam no núcleo. Os textos do popover e da página, a escolha da interface e o QR ficam em JS com teste, conforme o ADR 0001 e o pedido da tarefa. A comparação do token em tempo constante, o reconhecimento do tipo pelos bytes e a limpeza do EXIF são do host; o núcleo recebe o fato pronto, e as leis dizem isso.
2. **Limites.**
   - 15 MB por foto.
   - Por sessão (do Ligar ao Parar): 12 fotos e 100 MB. Li o "por envio" da issue como a sessão do popover, porque um contador por lote viria do celular e seria fácil de burlar.
   - A bandeja continua com o teto de 4 imagens por mensagem; a quinta foto mostra o aviso que já existe.
3. **Tipos aceitos:** JPEG, PNG e WebP, reconhecidos pelos bytes. GIF e HEIC são recusados. O iPhone converte HEIC para JPEG no `<input type=file>`; **conferir à mão**.
4. **Onde a rotação é aplicada.** O host tira o EXIF e manda a orientação à parte. O renderer desenha a foto em pé num canvas, reduzida ao lado máximo da bandeja (1568 px). Isso reencoda a imagem, então nenhum metadado sobrevive nem por acaso. Do JPEG ficam só o JFIF, o ICC e o Adobe (cor); do PNG e do WebP fica uma lista do que desenha a imagem: bloco desconhecido nunca passa.
5. **Clicar fora não fecha o popover.** A pessoa precisa escrever a mensagem enquanto o celular manda as fotos. Fecham o popover, e desligam o servidor: Esc, o próprio botão, recolher a coluna, trocar de conversa, recarregar a página e fechar a Mesa. **Parar** desliga e deixa o popover aberto com **Ligar de novo**.
6. **Durante a resposta do tutor,** o Anexar fica travado. As fotos que chegam esperam o fim da resposta e entram depois, na ordem.
7. **Rede.**
   - O servidor escuta só no IP escolhido, numa porta livre.
   - A ordem dos candidatos: Wi-Fi/Ethernet (`en*`, `eth*`, `wlan*`, "Wi-Fi", "Ethernet") e depois as faixas privadas.
   - Ficam fora: VPN, pontes, VMs, contêineres, WSL, Tailscale/CGNAT (100.64/10) e link-local.
   - Com mais de uma rede, aparece o seletor "Rede".
   - A dica do hotspot aparece se nenhum celular abrir a página em 30 s.
8. **Botão só com ícone** (celular), como o Anexar, com nome acessível e dica "Foto do celular". Assim a fileira estreita não estoura. O lugar logo depois do Anexar vem de `data-follows`, sem mexer no núcleo `composerbox`, que é de interface.
9. **QR sem dependência:** modo byte, correção M, versões 1 a 10. O endereço tem cerca de 50 bytes, versão 4.
10. **Guia.** O tópico novo usa `data-i18n` (`phone.guide.*`). O resto do Guia segue em pt-BR fixo até a fase 3 da #41.
11. **Teste:** `LEARNING_DESK_PHONE_HOST` força o endereço só em modo de teste.

## Possível colisão com a sessão paralela (#41 fase 3)

- Catálogos: só chaves novas `phone.*`, num bloco contíguo.
- `index.html`: o botão, o popover e um `<section>` novo no Guia, entre "Anexar imagens" e "Citar um trecho". Se a fase 3 reescrever o Guia, esse `<section>` é o ponto de merge.
- `src/main.mjs`: três linhas (import, Esc, recolher) e o `initPhonePhoto`.

## A conferir à mão (usuário)

- [ ] iPhone e Android reais, na mesma rede: foto pela câmera, pela galeria e pelo escaneamento de documento do iPhone. Confira que a foto chega em pé e que uma foto HEIC da galeria chega (o iPhone deve convertê-la).
- [ ] O aviso de firewall do macOS na primeira vez (e no Windows, se possível): o texto do popover explica por que ele aparece.
- [ ] O caminho do hotspot: o computador conectado ao hotspot do celular. Confira se a rede escolhida é a certa e se o seletor "Rede" aparece com Wi-Fi e hotspot juntos.
- [ ] O QR lido pela câmera nativa do iPhone e do Android, nos dois temas da Mesa (ele é sempre preto no branco).
- [ ] `npm run hunts`, na bateria completa no main.
