// @ts-check
/* Marca dos envoltórios que a casa gera em `structure.mjs`. A prévia viva
   passa `stripModelAttrs` depois da estrutura; sem a marca, a faixa Allowlist
   tratava `class="pdf-q"` e `style="--ans:80mm"` como se fossem do modelo e
   os prefixava/removia (c94c0264).

   O nome é sorteado ao carregar o módulo e nunca sai no HTML final, porque um
   nome fixo era forjável: bastava outra caixa (`DATA-PDF-HOUSE`) ou um atributo
   aberto num bloco de HTML e fechado no seguinte, que só vira elemento quando
   os blocos se juntam. Filtrar o texto do modelo não fecha essa classe; o
   modelo não adivinhar o nome, sim. */
const NAME_SUFFIX = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');

export const HOUSE_MARK = `data-pdf-house-${NAME_SUFFIX}`;
