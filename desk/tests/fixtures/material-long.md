# Limites e derivadas

Documento longo sintético (nenhum dado pessoal) para provar multipágina,
cabeçalho de tabela repetido e ordem de leitura.

## Objetivo

Relacionar limite, derivada e reta tangente com exemplos curtos e uma tabela
longa que atravessa a quebra de página.

## Resolução guiada

A definição de derivada é

$$f'(a)=\lim_{h\to 0}\frac{f(a+h)-f(a)}{h}.$$

Para $f(x)=x^2$, o passo a passo fica

$$\begin{aligned} f'(a) &= \lim_{h\to 0}\frac{(a+h)^2-a^2}{h} \\ &= \lim_{h\to 0}\frac{2ah+h^2}{h} \\ &= 2a. \end{aligned}$$

## Tabela longa

| n | $2^n$ | Paridade | Comentário de conferência do resultado |
| --- | --- | --- | --- |
| 1 | $2$ | par | valor pequeno e conferível à mão |
| 2 | $4$ | par | potência de dois |
| 3 | $8$ | par | potência de dois |
| 4 | $16$ | par | potência de dois |
| 5 | $32$ | par | potência de dois |
| 6 | $64$ | par | potência de dois |
| 7 | $128$ | par | potência de dois |
| 8 | $256$ | par | potência de dois |
| 9 | $512$ | par | potência de dois |
| 10 | $1024$ | par | potência de dois |
| 11 | $2048$ | par | potência de dois |
| 12 | $4096$ | par | potência de dois |
| 13 | $8192$ | par | potência de dois |
| 14 | $16384$ | par | potência de dois |
| 15 | $32768$ | par | potência de dois |
| 16 | $65536$ | par | potência de dois |
| 17 | $131072$ | par | potência de dois |
| 18 | $262144$ | par | potência de dois |
| 19 | $524288$ | par | potência de dois |
| 20 | $1048576$ | par | potência de dois |
| 21 | $2097152$ | par | potência de dois |
| 22 | $4194304$ | par | potência de dois |
| 23 | $8388608$ | par | potência de dois |
| 24 | $16777216$ | par | potência de dois |
| 25 | $33554432$ | par | potência de dois |
| 26 | $67108864$ | par | potência de dois |
| 27 | $134217728$ | par | potência de dois |
| 28 | $268435456$ | par | potência de dois |
| 29 | $536870912$ | par | potência de dois |
| 30 | $1073741824$ | par | potência de dois |
| 31 | $2147483648$ | par | potência de dois |
| 32 | $4294967296$ | par | potência de dois |
| 33 | $8589934592$ | par | potência de dois |
| 34 | $17179869184$ | par | potência de dois |
| 35 | $34359738368$ | par | potência de dois |
| 36 | $68719476736$ | par | potência de dois |
| 37 | $137438953472$ | par | potência de dois |
| 38 | $274877906944$ | par | potência de dois |
| 39 | $549755813888$ | par | potência de dois |
| 40 | $1099511627776$ | par | potência de dois |
| 41 | $2199023255552$ | par | potência de dois |
| 42 | $4398046511104$ | par | potência de dois |
| 43 | $8796093022208$ | par | potência de dois |
| 44 | $17592186044416$ | par | potência de dois |
| 45 | $35184372088832$ | par | potência de dois |
| 46 | $70368744177664$ | par | potência de dois |
| 47 | $140737488355328$ | par | potência de dois |
| 48 | $281474976710656$ | par | potência de dois |
| 49 | $562949953421312$ | par | potência de dois |
| 50 | $1125899906842624$ | par | potência de dois |
| 51 | $2251799813685248$ | par | potência de dois |
| 52 | $4503599627370496$ | par | potência de dois |
| 53 | $9007199254740992$ | par | potência de dois |
| 54 | $18014398509481984$ | par | potência de dois |
| 55 | $36028797018963968$ | par | potência de dois |
| 56 | $72057594037927936$ | par | potência de dois |
| 57 | $144115188075855872$ | par | potência de dois |
| 58 | $288230376151711744$ | par | potência de dois |
| 59 | $576460752303423488$ | par | potência de dois |
| 60 | $1152921504606846976$ | par | potência de dois |

## Continuação

Depois da tabela, mais texto para garantir uma terceira página e provar que a
ordem do conteúdo é preservada. Parágrafo final com fórmula curta $a^2+b^2=c^2$
e código:

```python
total = 0
for n in range(1, 11):
    total += n * n
```

Fim do documento longo sintético.
