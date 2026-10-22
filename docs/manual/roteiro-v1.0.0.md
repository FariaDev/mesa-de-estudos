# Roteiro manual da v1.0.0

Teste à mão antes do PR da v1.0.0. Ele consolida o roteiro de 12/10 (`docs/design/roteiro-teste-a-mao.md`) e o que entrou depois (#26 a #68). Os roteiros por motor continuam à parte: [claude-paridade.md](claude-paridade.md), [opencode-motor.md](opencode-motor.md) e [modelos-gratuitos.md](modelos-gratuitos.md).

**Para marcar, use a página:** https://claude.ai/artifact/6e2ycFn4ftruq5X8XMW5cT. Lá cada item tem os botões ok/falhou e um campo de nota; as marcas ficam salvas na página, e o orquestrador as lê de lá. Este arquivo é a fonte dos itens.

**Como marcar:** na coluna **ok?**, `ok` ou `falhou`. Quando falhar, escreva em **nota** uma linha do que viu (ou o nome do print) e siga em frente. O log fica em `desk/.runtime/desk.log` (Sobre → log do app).

**Antes:** faça uma cópia de `desk/.runtime/` para fora do repositório. Não use material de curso nos prints que forem para issue.

## Parte A: do zero, sem tocar nos seus dados (15 min)

Com a Mesa fechada, em `desk/`:

```bash
rm -rf /tmp/mesa-zero /tmp/mesa-zero-home && mkdir -p /tmp/mesa-zero-home && HOME=/tmp/mesa-zero-home LEARNING_DESK_RUNTIME=/tmp/mesa-zero npm start
```

A HOME falsa é o que deixa o teste do zero de verdade. Sem ela, a Mesa acha o cofre em `~/Documents/Obsidian Vault` e monta as suas matérias sozinha, igual ao `first-run-ui.mjs`. Nessa HOME, o Pi e o Claude Code não aparecem, então pule o passo do tutor (A7).

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| A1 | Abrir | A primeira abertura ocupa a tela cheia, com o trio ∫ Σ ∇ em Boas-vindas. O resto da Mesa fica inerte atrás. | | |
| A2 | Trocar o idioma para English e voltar | Todos os textos trocam, inclusive os do passeio. Nada fica em português no inglês. | | |
| A3 | Avançar por Como funciona; voltar com Voltar | Os passos ficam no topo; o Voltar existe em todo passo depois do primeiro. | | |
| A4 | Nome: deixar vazio e tentar avançar | O aviso aparece ao lado do campo, sem avançar. | | |
| A5 | PDFs: escolher uma pasta **pelo clique** | A pasta aparece no passo. Era o bug da #64. | | |
| A6 | PDFs: soltar uma pasta em cima | Também entra. | | |
| A7 | Tutor: pular | Dá para seguir sem tutor. | | |
| A8 | Pronto → Criar a matéria | A matéria só nasce aqui; cai na Mesa normal com os PDFs. | | |
| A9 | Fechar e abrir de novo com as mesmas variáveis (sem o `rm -rf`) | Não repete o setup. | | |
| A10 | Repetir em janela de 900×650 | Nada corta nem sobrepõe, inclusive o cartão do Tutor. | | |

Depois: `rm -rf /tmp/mesa-zero /tmp/mesa-zero-home`.

## Parte B: com os seus dados (`npm start` em `desk/`)

### B1. Primeira olhada (3 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B1.1 | Abrir | Abre na sua matéria, com os PDFs e a sessão anterior. | | |
| B1.2 | Olhar o cabeçalho | Logo G1 (a folha com a ∫) no acento escolhido, Estudar, busca ⌘K e ⚙. | | |
| B1.3 | Ajustes → trocar tema (Sistema, Claro, Escuro) e os 6 acentos | Vale na hora. O escuro é cinza (Grafite), não quase preto. A logo do cabeçalho troca de cor junto. | | |
| B1.4 | Olhar os dois temas com calma | Nada com cara de quebrado; textos de erro, aviso e sucesso legíveis. | | |
| B1.5 | Ajustes → reduzir movimento no sistema (Acessibilidade do macOS) | As animações somem ou ficam mínimas. | | |

### B2. Teclado e menus (3 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B2.1 | Tab até Estudar, Enter | O menu abre com o foco no primeiro item. | | |
| B2.2 | ↓ ↑ Home End; ↓ no último | Andam pelos itens e dão a volta. | | |
| B2.3 | Esc | Fecha e o foco volta ao Estudar. | | |
| B2.4 | ⌘K, digitar, apagar, digitar outra coisa | Continua achando. | | |
| B2.5 | ⌘/ | Abre o Guia da Mesa. | | |

### B3. Tutor com o Pi (10 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B3.1 | Chamar o tutor e mandar uma mensagem | Liga; a resposta chega; a linha "Vai junto" mostra matéria e página. | | |
| B3.2 | Parar no meio de uma resposta | Para. | | |
| B3.3 | Enviar durante uma resposta | Vira fila e sai quando a resposta acaba. | | |
| B3.4 | Tutor desligado: enviar duas mensagens | Ficam guardadas; o tutor é chamado sozinho e elas saem uma vez, na ordem. | | |
| B3.5 | Seletor de modelo: buscar, favoritar, ver recentes e o grupo Grátis | Grupos por provedor; os grátis à parte. | | |
| B3.6 | Trocar modelo e esforço no cabeçalho | O indicador "modelo · esforço" acompanha. | | |
| B3.7 | Mencionar uma ferramenta com @ (ex.: @geogebra) | A menção aparece e o tutor usa a ferramenta. | | |
| B3.8 | Pedir uma figura ("desenhe um gráfico de x²") | Sai no chat; dá para abrir em tela cheia. | | |
| B3.9 | Pedir uma atividade interativa | Cartão novo com prever, observar e concluir; funciona sem internet. | | |
| B3.10 | Citação "Arquivo.pdf, p. N" na resposta | É clicável, leva à página, e o Voltar funciona. | | |
| B3.11 | Compactar (Mais opções → Resumir agora) | Resume e a conversa segue. | | |

### B4. PDF pelo tutor (5 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B4.1 | Estudar → PDF pelo tutor; testar cada modelo: Lista, Apostila, Resumo, Simulado, Formulário | A prévia em A4 muda por modelo. | | |
| B4.2 | Revisar, editar e salvar | O PDF salvo abre no leitor. | | |

### B5. Leitor (5 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B5.1 | Arrastar um PDF do Finder para o leitor | "Solte para abrir em …" e abre. | | |
| B5.2 | Arrastar um arquivo que não é PDF | Só um aviso. | | |
| B5.3 | Leitor sem material | A folha "Lista 0" aparece. | | |
| B5.4 | Busca no material, favoritos, sumário | Funcionam. | | |
| B5.5 | Recolher o segundo leitor e reabrir pela faixa | Funciona. | | |

### B6. Conferir e foto do celular (8 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B6.1 | Conferir com o Xournal++ aberto | Captura a janela, anexa, e o tutor responde sobre o que você escreveu. | | |
| B6.2 | Configurações: trocar o programa do Conferir por outra janela | O botão passa a dizer "Conferir <programa>" e captura a janela escolhida. | | |
| B6.3 | Foto do celular: abrir o QR e ler no celular (mesma rede) | A página do celular abre com a ∫ e o título "Foto para a Mesa". | | |
| B6.4 | Mandar 3 fotos seguidas | O Σ aparece enquanto envia; as fotos entram na bandeja **na ordem de envio**. | | |
| B6.5 | Desligar o Wi-Fi do celular e tentar enviar | O ∇ aparece com o aviso de erro. | | |

### B7. Telas redesenhadas (5 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B7.1 | Guia da Mesa: lateral, busca, Próximo/Anterior | A busca mostra a seção de origem. | | |
| B7.2 | Caderno (Revisar hoje) e Estatísticas | Abrem no layout novo, nos dois temas. | | |
| B7.3 | Calculadora: conta na linha recolhida; abrir o painel; RAD/GRAUS | Funciona. | | |
| B7.4 | Sobre | Mostra as versões dos componentes; o log do app abre. | | |
| B7.5 | Chat lateral: abrir, perguntar, fechar | A resposta não entra na sessão principal. | | |
| B7.6 | Aba Livre: conversar sem matéria; depois Criar matéria | A conversa e os PDFs vão para a matéria nova. | | |
| B7.7 | Encolher a janela até ~900×650 | Nada some nem sobrepõe. | | |

### B8. Ajustes, avisos e problemas (5 min)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B8.1 | Configurações: passar por todas as seções; Cancelar | Cancelar descarta as edições. | | |
| B8.2 | Encerrar por hoje → fechar → abrir | Aparece "onde parei", com Retomar · Sessão nova · Esquecer. | | |
| B8.3 | Se houver atualização do Pi ou do Claude Code | Ponto no ⚙ **e** no item Ajustes do menu; a linha "<ferramenta> <versão> disponível" no topo das Configurações; o ponto some ao abrir. | | |
| B8.4 | Atualizar por dentro da Mesa (só se quiser atualizar de verdade) | Mostra o comando exato antes; roda só depois da confirmação; o tutor religa. | | |
| B8.5 | Mais opções do tutor → Relatar um problema | Relatório sem caminho pessoal, chave nem nome de matéria; prompt pronto. Não envie nada. | | |

### B9. Outros motores (opcional, 10 min cada)

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| B9.1 | Claude: ⌘K → Sessão nova com Claude Code; seguir [claude-paridade.md](claude-paridade.md) | Liga com o seu CLI, e a interface diz "Claude (experimental)". | | |
| B9.2 | OpenCode com modelo grátis; seguir [opencode-motor.md](opencode-motor.md) | Liga; o seletor só oferece os Grátis sem confirmação. | | |
| B9.3 | Modelo pago no OpenCode | A Mesa pergunta uma vez antes. | | |

## Parte C: o app instalado (5 min)

Em `desk/`, rode `npm run install-app` e abra o **Mesa de Estudos.app**.

| # | O que fazer | O que esperar | ok? | nota |
|---|---|---|---|---|
| C1 | Olhar o ícone no Dock, no Finder (lista e ícones pequenos) e no Launchpad | G1 violeta; nos tamanhos pequenos, a variante com a ∫ legível. | | |
| C2 | Trocar o acento com o app aberto | O ícone do Dock acompanha o acento. | | |
| C3 | Abrir, estudar 2 min, fechar | Igual ao `npm start`. | | |
| C4 | Sobre | Versão 1.0.0. | | |

## O que não entra aqui

- Windows.
- Atualização 0.5.0 → 1.0.0 de ponta a ponta: fica no passo de publicação, com o release criado.
- Pendências da 1.0.x (#69).
