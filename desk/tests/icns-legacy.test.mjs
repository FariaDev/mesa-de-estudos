import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

/* #101: PNG em icp4/icp5 saiu como ruído pelo iconutil no Mac; 16 e 32 px
   agora vão nos blocos clássicos. O último teste abre o .icns de verdade. */
const require=createRequire(import.meta.url);
const {encodeIconRle,legacyIconChunks}=require('../scripts/icns-legacy.cjs');
const ICNS_PATH=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','assets','mesa.icns');

function decodeIconRle(encoded,expected){
  const output=[];
  for(let index=0;index<encoded.length;){
    const control=encoded[index++];
    if(control<128){
      output.push(...encoded.subarray(index,index+control+1));
      index+=control+1;
      continue;
    }
    output.push(...new Array(control-125).fill(encoded[index++]));
  }
  assert.equal(output.length,expected);
  return Uint8Array.from(output);
}

function readIcnsChunks(file){
  const icns=fs.readFileSync(file);
  const chunks=new Map();
  for(let offset=8;offset<icns.length;){
    const length=icns.readUInt32BE(offset+4);
    chunks.set(icns.toString('latin1',offset,offset+4),icns.subarray(offset+8,offset+length));
    offset+=length;
  }
  return chunks;
}

test('RLE do icns ida e volta em repetição, literal e limites',()=>{
  const longRepeat=new Uint8Array(300).fill(7);
  const longLiteral=Uint8Array.from({length:300},(_,index)=>index%2);
  for(const channel of [Uint8Array.of(9,9,9,1),Uint8Array.of(1,2,2,3),longRepeat,longLiteral]){
    assert.deepEqual(decodeIconRle(encodeIconRle(channel),channel.length),channel);
  }
  assert.deepEqual([...encodeIconRle(Uint8Array.of(9,9,9,1))],[0x80,9,0,1]);
});

test('bloco clássico separa os canais e desfaz a alfa pré-multiplicada',()=>{
  const bgra=new Uint8Array(16*16*4);
  bgra.set([10,20,50,128],0);
  const [color,mask]=legacyIconChunks(bgra,16);
  assert.equal(color.type,'is32');
  assert.equal(mask.type,'s8mk');
  assert.equal(mask.png[0],128);
  const channels=decodeIconRle(color.png,16*16*3);
  assert.deepEqual([channels[0],channels[256],channels[512]],[100,40,20]);
  assert.equal(channels[1],0,'pixel transparente fica sem cor');
});

test('bloco clássico recusa tamanho ou bitmap fora do formato',()=>{
  assert.throws(()=>legacyIconChunks(new Uint8Array(4),48),/inválido: 48/);
  assert.throws(()=>legacyIconChunks(new Uint8Array(4),16),/esperado 1024/);
});

test('mesa.icns gerado traz 16 e 32 px clássicos, sem icp4 nem icp5',()=>{
  const chunks=readIcnsChunks(ICNS_PATH);
  assert.equal(chunks.has('icp4'),false);
  assert.equal(chunks.has('icp5'),false);
  assert.equal(decodeIconRle(chunks.get('is32'),16*16*3).length,768);
  assert.equal(decodeIconRle(chunks.get('il32'),32*32*3).length,3072);
  assert.equal(chunks.get('s8mk').length,16*16);
  assert.equal(chunks.get('l8mk').length,32*32);
  assert.ok(chunks.get('l8mk').some(alpha=>alpha>0),'máscara de 32 px vazia');
});
