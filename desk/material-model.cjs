'use strict';

/* Modelos de PDF do tutor para os hosts CJS: o mesmo módulo que o renderer e a
   janela de impressão usam (`src/materials/model.mjs`, que só converte fatos
   para o núcleo `core/materialmodel.bend`). `require` de ESM síncrono — o
   Electron do app e o Node dos testes o suportam. */
module.exports = require('./src/materials/model.mjs');
