# 3. Bend pelo que a lei prova

**Status:** aceita pelo Lucas em 2026-11-01 (#97). Substitui o [ADR 0001](0001-bend-so-para-invariantes.md).

## Contexto

O ADR 0001 pôs no Bend só os invariantes de domínio e mandou a interface para JS. O corte ficou estreito em duas direções:

- Regra de interface com consequência para o aluno ficava sem prova. "A resposta certa não aparece antes da resposta" é interface pelo texto do ADR, mas, se quebrar, o aluno perde o exercício.
- Na prática, a regra não foi seguida por inteiro: a #90 pôs pílulas, separadores e `tabindex` no núcleo, com lei e prova, e nessas leis a prova só repete a implementação.

O Lucas continua vendo muito valor no Bend. As leis já pegaram defeitos reais (fila, faixa de versões, navegação do PDF, GeoGebra), e TypeScript (#96) não substitui isso: tipos dizem o formato do dado, provas dizem que a regra vale. Os custos do ADR 0001 continuam reais: toolchain jovem, migração do `Nat` (#49), artefato gerado ilegível e ajuste visual caro quando passa pelo núcleo.

## Decisão

O teste passa a ser: **a lei diz algo que o código sozinho não diz, e a quebra custaria algo ao aluno?**

Vai para o Bend, com lei e prova:

- invariantes de domínio: estado, fila, backup, versões e faixas, limpeza e restauração, validação de configuração, navegação e cálculo de páginas, política de ferramentas;
- regras de interface com consequência para o aluno: "o resultado é enviado uma vez só", "a resposta certa não aparece antes da resposta", "a página citada sempre aparece".

Fica em JS com teste, e pixel com teste de janela:

- o que a lei só repetiria: classe CSS, `tabindex`, ordem de nós, texto, rótulo, dica e posição.

Em caso de dúvida, escreva a lei. Se ela repetir a implementação com outras palavras, é JS.

## Núcleos que já existem

Nenhuma varredura. O ticket que mexer num núcleo de interface aplica o teste acima ao que tocar: mantém o que prova regra e passa para JS o que só repete o código, registrando no ticket. Isso substitui a regra de tirar o núcleo inteiro quando um ticket mexer nele.

## Consequências

- Interface com consequência ganha prova, e o `verify:bend` volta a crescer um pouco por isso.
- Ajuste puramente visual continua sem passar pelo núcleo.
- Referências antigas ao ADR 0001 em código e relatórios ficam como histórico: a decisão daquele momento.
