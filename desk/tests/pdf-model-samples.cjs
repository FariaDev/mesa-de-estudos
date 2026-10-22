'use strict';
/* Conteúdo de exemplo INVENTADO (nada de material de curso), um por modelo de
   PDF do tutor: usado pelo runner de PDF e pelos testes de modelo. */
const lista = `# Lista 3 — Frações e proporções

1. Calcule o valor de cada expressão:
   1. $\\frac{1}{2}+\\frac{1}{3}$
   2. $\\frac{3}{4}-\\frac{1}{8}$
   3. $\\frac{2}{5}\\cdot\\frac{10}{3}$
   4. $\\frac{7}{9}\\div\\frac{14}{27}$
   5. $\\frac{5}{6}+\\frac{1}{12}$
   6. $2-\\frac{3}{7}$
2. Resolva as proporções para $x$:
   1. $\\frac{x}{4}=\\frac{9}{12}$
   2. $\\frac{3}{x}=\\frac{15}{20}$
   3. $\\frac{x+1}{5}=\\frac{6}{10}$
3. Uma receita usa $\\frac{3}{4}$ de xícara de açúcar para cada 2 xícaras de farinha. Quanto açúcar é preciso para 5 xícaras de farinha?
4. Simplifique ao máximo:
   1. $\\frac{18}{24}$
   2. $\\frac{45}{60}$
   3. $\\frac{126}{198}$

## Gabarito

1. a) $\\frac{5}{6}$ b) $\\frac{5}{8}$ c) $\\frac{4}{3}$ d) $\\frac{3}{2}$ e) $\\frac{11}{12}$ f) $\\frac{11}{7}$
2. a) $3$ b) $4$ c) $2$
3. $\\frac{15}{8}$ de xícara.
4. a) $\\frac{3}{4}$ b) $\\frac{3}{4}$ c) $\\frac{7}{11}$
`;
const listaLonga = `# Lista 4 — Problemas

1. Um reservatório com formato de prisma retangular tem 4 m de comprimento, 2,5 m de largura e 1,8 m de altura. Se ele está com água até $\\frac{3}{5}$ da altura e uma torneira despeja 12 litros por minuto, quanto tempo falta para encher o reservatório por completo?
   1. Escreva a expressão do volume que falta preencher, em litros, explicando cada passo do raciocínio utilizado na conversão de unidades.
   2. Determine o tempo, em horas e minutos, necessário para completar o volume.
2. Duas cidades distam 360 km uma da outra; um carro parte da primeira às 8h a 60 km/h e outro parte da segunda às 9h a 80 km/h no sentido contrário. A que horas eles se encontram?
`;
const apostila = `# Progressões aritméticas

## 2. Sequências

Uma sequência é uma lista ordenada de números. Nesta seção estudamos as sequências em que a diferença entre termos consecutivos é constante, e vemos como escrever o termo geral. O texto corre justificado, com recuo na primeira linha de cada parágrafo, como num livro.

**Definição 2.1.** *Uma progressão aritmética é uma sequência em que cada termo, a partir do segundo, é a soma do anterior com uma constante $r$, chamada razão.*

O termo geral é dado por

$$a_n = a_1 + (n-1)\\,r$$

e a soma dos $n$ primeiros termos por

$$S_n = \\frac{n\\,(a_1+a_n)}{2}$$

**Exemplo 03:** Em $(3, 7, 11, \\dots)$ temos $a_1=3$ e $r=4$, logo $a_{10}=3+9\\cdot 4=39$.

| Termo | Fórmula | Exemplo |
| --- | --- | --- |
| $a_n$ | $a_1+(n-1)r$ | 39 |
| $S_n$ | $n(a_1+a_n)/2$ | 210 |

## 3. Aplicações

Quando a razão é negativa a sequência decresce. Os mesmos resultados valem, e a soma pode ser usada para contar objetos empilhados.

$$a_n = a_m + (n-m)\\,r$$
`;
const resumo = `# Resumo — Função afim

**A ideia.** Uma função afim muda a uma taxa constante: a cada passo em $x$, o valor de $y$ sobe (ou desce) sempre o mesmo tanto.

**Regra.** $f(x)=ax+b$, onde $a$ é a taxa de variação e $b$ é o valor em $x=0$.

## Exemplo resolvido

1. Dado $f(2)=7$ e $f(5)=13$, a taxa é $a=\\frac{13-7}{5-2}=2$.
2. Então $b=7-2\\cdot 2=3$.
3. Logo $f(x)=2x+3$.

## Erros comuns

- Trocar o sinal de $b$ ao isolar $x$.
- Confundir $a$ com o valor de $f(1)$.

## Para revisar

- Taxa de variação entre dois pontos.
- Gráfico de uma reta a partir de $a$ e $b$.
`;
const simulado = `# Simulado — Funções

Leia com atenção. Não é permitido o uso de calculadora. Duração: 50 minutos.

## Questão 1 (2,0 pontos)

Determine o valor de $f(3)$ para $f(x)=2x^2-x+1$.

## Questão 2 (1,5 ponto)

Qual das alternativas representa uma função afim?

- ( ) $f(x)=x^2+1$
- ( ) $f(x)=3x-4$
- ( ) $f(x)=\\frac{1}{x}$
- ( ) $f(x)=\\sqrt{x}$

## Questão 3 (3,0 pontos) {longa}

Uma loja cobra uma taxa fixa de R$ 12 mais R$ 3 por item. Escreva a função que dá o custo $C(n)$ para $n$ itens, calcule o custo de 15 itens e explique o seu raciocínio.

## Questão 4 (3,5 pontos) {longa}

Resolva o sistema $\\begin{cases}x+y=10\\\\ 2x-y=5\\end{cases}$ e interprete a solução.

## Gabarito comentado

1. $f(3)=2\\cdot 9-3+1=16$.
2. Alternativa b: é a única da forma $ax+b$.
3. $C(n)=12+3n$; $C(15)=57$.
4. $x=5$ e $y=5$.
`;
const formulario = `# Formulário de Cálculo

Em toda a folha, $u=f(x)$ e $u'=f'(x)$.

## Derivadas

1. $(c)'=0$
2. $(x^n)'=n x^{n-1}$
3. $(u+v)'=u'+v'$
4. $(u\\,v)'=u'v+u\\,v'$
5. $\\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^2}$
6. $(\\sin u)'=u'\\cos u$
7. $(\\cos u)'=-u'\\sin u$

## Integrais

1. $\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C$
2. $\\int \\frac{1}{x}\\,dx=\\ln|x|+C$
3. $\\int e^x\\,dx=e^x+C$
4. $\\int \\sin x\\,dx=-\\cos x+C$
5. $\\int \\cos x\\,dx=\\sin x+C$
6. $\\int u\\,dv=uv-\\int v\\,du$
`;
const simulado4 = `# Simulado curto

Responda no espaço indicado.

## Questão 1 (2,5 pontos)

Resolva $3x+2=11$.

## Questão 2 (2,5 pontos)

Calcule $\\frac{2}{3}+\\frac{1}{4}$.

## Questão 3 (2,5 pontos)

Fatore $x^2-9$.

## Questão 4 (2,5 pontos)

Determine $f(2)$ para $f(x)=x^3-1$.
`;
module.exports = {simulado4, lista, listaLonga, apostila, resumo, simulado, formulario};
