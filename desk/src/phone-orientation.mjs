// @ts-check

/* Rotação da Foto do celular (#36). O host tira o EXIF e manda a tag
   Orientation (1 a 8) à parte; o renderer desenha a foto já girada ao
   comprimir para a bandeja. Aqui só a conta, sem DOM, para o teste de unidade.

   A matriz é a de `CanvasRenderingContext2D.setTransform(a, b, c, d, e, f)`:
   leva o ponto (x, y) da foto crua, de `w`×`h`, para (a·x + c·y + e, b·x + d·y + f)
   na foto em pé. */

/** @param {number} orientation */
const normalized = (orientation) => (Number.isInteger(orientation) && orientation >= 1 && orientation <= 8 ? orientation : 1);

/**
 * Tamanho da foto em pé.
 * @param {number} orientation  tag EXIF (fora de 1 a 8 vale como 1)
 * @param {number} w  largura da foto crua
 * @param {number} h  altura da foto crua
 * @returns {{width: number, height: number}}
 * @example orientationSize(6, 4000, 3000) // {width: 3000, height: 4000}
 */
export function orientationSize(orientation, w, h) {
  return normalized(orientation) >= 5 ? {width: h, height: w} : {width: w, height: h};
}

/**
 * Matriz de desenho da foto crua na foto em pé.
 * @param {number} orientation @param {number} w @param {number} h
 * @returns {[number, number, number, number, number, number]}
 * @example orientationMatrix(3, 10, 5) // [-1, 0, 0, -1, 10, 5]
 */
export function orientationMatrix(orientation, w, h) {
  switch (normalized(orientation)) {
    case 2: return [-1, 0, 0, 1, w, 0];
    case 3: return [-1, 0, 0, -1, w, h];
    case 4: return [1, 0, 0, -1, 0, h];
    case 5: return [0, 1, 1, 0, 0, 0];
    case 6: return [0, 1, -1, 0, h, 0];
    case 7: return [0, -1, -1, 0, h, w];
    case 8: return [0, -1, 1, 0, 0, w];
    default: return [1, 0, 0, 1, 0, 0];
  }
}
