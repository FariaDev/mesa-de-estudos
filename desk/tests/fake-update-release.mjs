import crypto from 'node:crypto';
import {createRequire} from 'node:module';

/* Release assinada falsa (#80): par Ed25519 gerado na hora, manifesto assinado
   e um `fetchBuffer` que responde às três URLs de asset (manifesto, assinatura
   e zip). Nenhum teste toca a rede; cenários de ataque trocam a chave, a
   assinatura ou os campos do manifesto de propósito. */
const require = createRequire(import.meta.url);
const {updateAssetUrls} = require('../updater-signature.cjs');

export const TEST_COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

/**
 * Par Ed25519 de teste, com a pública já em PEM SPKI.
 * @returns {{publicKey: string, privateKey: import('node:crypto').KeyObject}}
 * @example const {publicKey, privateKey} = generateSigningPair();
 */
export function generateSigningPair() {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  return {publicKey: publicKey.export({type: 'spki', format: 'pem'}), privateKey};
}

/**
 * Manifesto assinado + fetchBuffer com os três assets, pronto para `applyUpdate`.
 * @param {{version?: string, commit?: string, zip?: Buffer,
 *   pair?: {publicKey: string, privateKey: import('node:crypto').KeyObject},
 *   publicKey?: string, signingKey?: import('node:crypto').KeyObject,
 *   manifest?: object, signatureBytes?: Buffer|null, zipDownload?: Buffer}} [options]
 * @returns {{version: string, publicKey: string, privateKey: import('node:crypto').KeyObject,
 *   manifest: object, manifestBytes: Buffer, signatureBytes: Buffer|null,
 *   urls: {manifest: string, signature: string, zip: string},
 *   fetchBuffer: (url: string) => Promise<Buffer>, zip: Buffer}}
 * @example const release = makeSignedRelease({version: '0.4.1', commit: TEST_COMMIT, zip});
 */
export function makeSignedRelease(options = {}) {
  const {
    version = '0.4.1',
    commit = TEST_COMMIT,
    zip = Buffer.from('zip de teste'),
    pair = generateSigningPair(),
    publicKey = pair.publicKey,
    signingKey = pair.privateKey,
    manifest: manifestOverride = null,
    signatureBytes,
    zipDownload,
  } = options;
  const manifest = manifestOverride || {
    version,
    commit,
    zipSha256: crypto.createHash('sha256').update(zip).digest('hex'),
    zipBytes: zip.length,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const signature = signatureBytes !== undefined
    ? signatureBytes
    : Buffer.from(crypto.sign(null, manifestBytes, signingKey).toString('base64') + '\n');
  const urls = updateAssetUrls(version);
  const fetchBuffer = async (url) => {
    if (url === urls.manifest) return manifestBytes;
    if (url === urls.signature) return signature;
    if (url === urls.zip) return zipDownload || zip;
    throw Error(`HTTP 404 ${url}`);
  };
  return {
    version,
    publicKey,
    privateKey: pair.privateKey,
    manifest,
    manifestBytes,
    signatureBytes: signature,
    urls,
    fetchBuffer,
    zip: zipDownload || zip,
  };
}
