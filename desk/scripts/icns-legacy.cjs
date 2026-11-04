/* Blocos clássicos de 16 e 32 px do .icns: is32+s8mk e il32+l8mk.
   O Mac de teste extraiu PNG em icp4/icp5 como ruído colorido pelo iconutil
   (#101); estes são os blocos que o próprio iconutil grava nesses tamanhos. */

const LEGACY_ICON_TYPES={16:['is32','s8mk'],32:['il32','l8mk']};
const RLE_MAX_LITERAL=128;
const RLE_MAX_REPEAT=130;
const RLE_MIN_REPEAT=3;

function repeatLength(channel,start){
  let length=1;
  while(start+length<channel.length&&length<RLE_MAX_REPEAT&&channel[start+length]===channel[start])length++;
  return length;
}

/**
 * Comprime um canal no RLE do .icns: n<128 traz n+1 bytes literais; n>=128
 * repete o byte seguinte n-125 vezes.
 * @param {Uint8Array} channel bytes de um canal, sem compressão
 * @returns {Buffer} canal comprimido
 * @example encodeIconRle(Uint8Array.of(9,9,9,1)) // <80 09 00 01>
 */
function encodeIconRle(channel){
  const output=[];
  let literal=[];
  const flushLiteral=()=>{
    if(!literal.length)return;
    output.push(literal.length-1,...literal);
    literal=[];
  };
  for(let index=0;index<channel.length;){
    const length=repeatLength(channel,index);
    if(length>=RLE_MIN_REPEAT){
      flushLiteral();
      output.push(length+125,channel[index]);
      index+=length;
      continue;
    }
    literal.push(channel[index]);
    index++;
    if(literal.length===RLE_MAX_LITERAL)flushLiteral();
  }
  flushLiteral();
  return Buffer.from(output);
}

/** Desfaz a alfa pré-multiplicada, que o .icns clássico não usa. */
function straightColor(value,alpha){
  return alpha?Math.min(255,Math.round(value*255/alpha)):0;
}

/**
 * Monta os dois blocos clássicos de um ícone a partir do bitmap do Electron.
 * @param {Uint8Array} bgra bitmap BGRA pré-multiplicado, de nativeImage.toBitmap
 * @param {16|32} size lado do ícone em px
 * @returns {{type:string,png:Buffer}[]} bloco de cor e bloco de máscara
 * @example legacyIconChunks(bitmap,16) // [{type:'is32',…},{type:'s8mk',…}]
 */
function legacyIconChunks(bgra,size){
  const types=LEGACY_ICON_TYPES[size];
  if(!types)throw new Error(`tamanho de ícone clássico inválido: ${size}; esperado 16 ou 32`);
  const pixels=size*size;
  if(bgra.length!==pixels*4)throw new Error(`bitmap com ${bgra.length} bytes; esperado ${pixels*4}`);
  const channels=[new Uint8Array(pixels),new Uint8Array(pixels),new Uint8Array(pixels)];
  const mask=Buffer.alloc(pixels);
  for(let pixel=0;pixel<pixels;pixel++){
    const alpha=bgra[pixel*4+3];
    mask[pixel]=alpha;
    channels[0][pixel]=straightColor(bgra[pixel*4+2],alpha);
    channels[1][pixel]=straightColor(bgra[pixel*4+1],alpha);
    channels[2][pixel]=straightColor(bgra[pixel*4],alpha);
  }
  return [{type:types[0],png:Buffer.concat(channels.map(encodeIconRle))},{type:types[1],png:mask}];
}

module.exports={encodeIconRle,legacyIconChunks};
