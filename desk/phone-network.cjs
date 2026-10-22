// @ts-check
'use strict';

/* Em qual endereço a Foto do celular escuta (#36). O servidor escuta numa
   interface só, a da rede local que o celular também vê: Wi-Fi ou Ethernet,
   nunca VPN, ponte de máquina virtual, contêiner ou o próprio computador.

   Recebe `os.networkInterfaces()` (por parâmetro, para o teste) e devolve os
   candidatos já ordenados: o primeiro é o mais provável e a pessoa pode trocar
   no popover. */

/** @typedef {{name: string, address: string}} PhoneAddress */

/* Nomes de interface que nunca são a rede local de verdade: túneis e VPN
   (utun, tun, tap, ppp, ipsec, wg, tailscale, zerotier), pontes e máquinas
   virtuais (bridge, vmnet, vboxnet, docker, veth, virbr, vEthernet/Hyper-V) e
   os enlaces internos do macOS (awdl, llw, anpi, gif, stf). */
const VIRTUAL_NAME = /^(lo|utun|tun|tap|ppp|ipsec|wg|tailscale|zt|bridge|vmnet|vboxnet|docker|veth|br-|virbr|awdl|llw|anpi|gif|stf)|vpn|virtual|vethernet|hyper-v|vmware|virtualbox|loopback|tailscale|zerotier|wireguard|bluetooth/i;
/* Nomes de Wi-Fi e Ethernet de verdade em macOS (en0…), Linux (eth, enp, wlan,
   wlp) e Windows ("Wi-Fi", "Ethernet"). */
const LAN_NAME = /^(en\d|eth|enp|eno|ens|wlan|wlp|wl|wi-?fi|ethernet)/i;

/** Faixa privada da RFC 1918 (casa, escola, hotspot do celular). */
function privateRank(address) {
  const [a, b] = address.split('.').map(Number);
  if (a === 192 && b === 168) return 0;
  if (a === 10) return 1;
  if (a === 172 && b >= 16 && b <= 31) return 1;
  return 2;
}

/* 169.254/16 é o endereço de quando a rede não respondeu; 100.64/10 é o
   espaço das VPNs de malha (Tailscale) e do CGNAT: nenhum é a rede do celular. */
function unusableAddress(address) {
  const [a, b] = address.split('.').map(Number);
  return (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a === 127;
}

/**
 * Candidatos a endereço da Foto do celular, do mais provável ao menos.
 *
 * @param {Record<string, Array<{family: string|number, address: string, internal: boolean}>|undefined>} interfaces
 * @returns {PhoneAddress[]}
 * @example lanCandidates({en0: [{family: 'IPv4', address: '192.168.0.4', internal: false}]})
 *   // [{name: 'en0', address: '192.168.0.4'}]
 */
function lanCandidates(interfaces) {
  const found = [];
  for (const [name, entries] of Object.entries(interfaces || {})) {
    if (VIRTUAL_NAME.test(name)) continue;
    for (const entry of entries || []) {
      const ipv4 = entry && (entry.family === 'IPv4' || entry.family === 4);
      if (!ipv4 || entry.internal || unusableAddress(entry.address)) continue;
      found.push({name, address: entry.address, rank: (LAN_NAME.test(name) ? 0 : 10) + privateRank(entry.address)});
    }
  }
  return found
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'en', {numeric: true}))
    .map(({name, address}) => ({name, address}));
}

module.exports = {lanCandidates};
