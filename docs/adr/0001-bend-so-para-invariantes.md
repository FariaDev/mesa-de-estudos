# 1. Bend só para invariantes de domínio

**Status:** aceita pelo usuário em 2026-10-17 (#56).

## Contexto

O `AGENTS.md` manda pôr "lógica que nunca pode quebrar" no núcleo Bend, com leis em `core/laws/` e provas em `core/proofs/`. Na prática, a regra foi lida de forma ampla. Hoje são 70 núcleos e 67 artefatos gerados, com 1,9 MB de JS. Muitos deles montam a interface:

- árvores de nós de avisos e diálogos (`updatenotice`, `dialogsview`, `tutorstate`);
- dicas de rodapé (`settingsview.footerHint`);
- rótulos e textos que, desde a #41, voltam como chave e argumentos.

O custo apareceu várias vezes:

- **A linguagem é jovem.** O verificador aceitava lei falsa preenchida por `@unsafe` num arquivo importado (#47). O `Nat` muda de BigInt para number na versão 2.0.37 (#49), o que obriga a fixar a toolchain e planejar uma migração.
- **O artefato gerado é ilegível.** Revisão e depuração passam por 1,9 MB de JS de máquina.
- **Ajuste de interface fica caro.** Mudar um texto ou a posição de um nó exige editar o núcleo, a lei e a prova, regenerar e conferir os bytes. A #41 precisou converter dezenas de núcleos para chave e argumentos.

As leis valem de verdade onde há invariante de domínio. Exemplos: a fila não perde mensagem, a faixa de versões do Claude recusa uma série nova, a navegação do PDF não sai do documento, o quadro do GeoGebra nunca apaga sem guardar. Nesses casos elas já pegaram defeitos.

## Decisão

O Bend fica para **invariantes de domínio**: regras sobre o estado do aluno e das ferramentas cuja quebra perde dado, bloqueia o estudo ou aceita algo perigoso.

A **interface** fica em JS comum, com teste de unidade e, quando houver pixel, teste de janela. Interface aqui quer dizer árvore de nós, texto, rótulo, dica, ordem de botões e posição.

O que fica no Bend:
- estado, fila e backup;
- versões e faixas;
- regras de limpeza e restauração;
- validação de configuração;
- navegação e cálculo de páginas;
- política de ferramentas.

Teste para decidir um caso novo: **"se isso quebrar, o aluno perde algo ou o app faz algo que não devia?"** Se sim, é Bend. Se a quebra só deixa a tela errada, é JS com teste.

Os núcleos de interface existentes **não são reescritos de propósito**. Um núcleo só sai do Bend quando um ticket já precisar mexer nele, e o ticket registra a migração.

## Consequências

- Ticket de interface fica mais rápido, e o `verify:bend` deixa de crescer com cada tela.
- A migração do `Nat` (#49) fica menor a cada núcleo de interface que sai.
- Perde-se a garantia formal sobre a montagem da interface. Os testes de janela e de unidade já cobrem esse risco.
- O `AGENTS.md` muda a linha "Lógica que nunca pode quebrar mora no núcleo Bend", que passa a falar em invariante de domínio e a citar este ADR. O `docs/agents/mapa.md` ganha a coluna de onde cada feature mora.

## Alternativas consideradas

- **Manter como está:** custo crescente, que já apareceu na #41, na #47 e na #49.
- **Tirar o Bend de vez:** perde as provas que pegam defeito real nos invariantes. A troca não compensa.
- **Migrar os núcleos de interface agora:** é trabalho grande, sem ganho para o usuário, e colidiria com os tickets abertos.
