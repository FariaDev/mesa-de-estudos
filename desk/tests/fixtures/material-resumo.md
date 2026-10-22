# Limites e derivadas

Resumo sintético para a prova do template. O desconto era $5 e o outro $10
(isto é dinheiro, não matemática). Fórmula no texto: $f(x)=x^2+1$.

## Conceitos

- limite: $\lim_{h\to 0}\frac{f(a+h)-f(a)}{h}=f'(a)$
- derivada de polinômio
- reta tangente

$$f'(x)=2x$$

## Exemplo resolvido

Use `aligned` para o passo a passo:

$$\begin{aligned} f(x) &= x^2 + 3x \\ f'(x) &= 2x + 3 \end{aligned}$$

Um `cases`:

$$g(x)=\begin{cases} x^2, & x \ge 0 \\ -x, & x < 0 \end{cases}$$

Código com cifrão e cerquilha (não pode virar math nem heading):

```js
const preco = 10; // custa $10 e $5
// # não é um heading
const tex = "$x^2$";
```

## Tabela

| Passo | Expressão | Resultado |
| --- | --- | --- |
| 1 | $2+3$ | $5$ |
| 2 | $5\cdot 4$ | $20$ |
