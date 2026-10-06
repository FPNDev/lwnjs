import { fromBase64, toBase64 } from './encoding';

/**
 * End-to-end encryption on top of WebRTC's own DTLS: even a malicious
 * signaling server, which brokers the connection, cannot read or forge
 * messages without the peers noticing a changed key.
 *
 * Each device has a long-lived ECDH P-256 identity. Two peers derive the same
 * AES-GCM key from their identities; every message gets a fresh random IV.
 */
const ECDH: EcKeyImportParams = { name: 'ECDH', namedCurve: 'P-256' };

export function createKeys() {
  // The private key is not extractable: it never leaves WebCrypto, not even into IndexedDB as bytes.
  return crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
}

export async function exportPublicKey(key: CryptoKey) {
  return toBase64(await crypto.subtle.exportKey('raw', key));
}

export async function deriveSessionKey(
  privateKey: CryptoKey,
  peerPublicKey: string,
) {
  const publicKey = await crypto.subtle.importKey(
    'raw',
    fromBase64(peerPublicKey),
    ECDH,
    false,
    [],
  );

  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export type Sealed = {
  iv: string;
  data: string;
};

export async function encrypt(key: CryptoKey, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text),
  );

  return { iv: toBase64(iv), data: toBase64(data) };
}

/** Throws if the data was tampered with: AES-GCM authenticates it. */
export async function decrypt(key: CryptoKey, sealed: Sealed) {
  const data = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) },
    key,
    fromBase64(sealed.data),
  );

  return new TextDecoder().decode(data);
}

/**
 * A number both people see identically, to compare out of band (in person, on
 * a call). If it matches, nobody sits in the middle.
 */
export async function safetyNumber(publicKeyA: string, publicKeyB: string) {
  const [first, second] =
    publicKeyA < publicKeyB
      ? [publicKeyA, publicKeyB]
      : [publicKeyB, publicKeyA];
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(first + second),
    ),
  );
  const groups: string[] = [];
  for (let index = 0; index < 24; index += 2) {
    groups.push(
      String(((hash[index] << 8) | hash[index + 1]) % 100_000).padStart(5, '0'),
    );
  }

  return groups.join(' ');
}
