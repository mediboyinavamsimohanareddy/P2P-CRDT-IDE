declare const __webpack_require__: unknown;
declare const __non_webpack_require__: (id: string) => any;

export interface CryptoIdentity {
  peerId: string; // SHA-256 fingerprint of public key
  publicKeyPem: string;
  privateKeyPem: string;
}

// Global fallback implementation for Web / Browser environments where Node 'crypto' module is absent
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Safely obtain node crypto if running in Node/Electron environment without Vite external module errors
let nodeCryptoModule: typeof import('crypto') | null = null;
function getNodeCrypto(): typeof import('crypto') | null {
  if (nodeCryptoModule) return nodeCryptoModule;
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Use eval/Function require to prevent Vite from analyzing & throwing externalization errors for client builds
      const req = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : eval('require');
      nodeCryptoModule = req('crypto');
      return nodeCryptoModule;
    }
  } catch {
    // Web environment
  }
  return null;
}

export type SymmetricKey = Uint8Array;

export class SecurityManager {
  static generateIdentity(): CryptoIdentity {
    const crypto = getNodeCrypto();
    if (crypto && typeof crypto.generateKeyPairSync === 'function') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const peerId = crypto.createHash('sha256').update(publicKey).digest('hex').substring(0, 16);

      return {
        peerId,
        publicKeyPem: publicKey,
        privateKeyPem: privateKey,
      };
    }

    // Browser fallback identity generation
    const randomArray = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomArray);
    } else {
      for (let i = 0; i < 32; i++) randomArray[i] = Math.floor(Math.random() * 256);
    }
    const hex = Array.from(randomArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return {
      peerId: hex.substring(0, 16),
      publicKeyPem: `-----BEGIN PUBLIC KEY-----\n${bytesToBase64(randomArray)}\n-----END PUBLIC KEY-----`,
      privateKeyPem: `-----BEGIN PRIVATE KEY-----\n${bytesToBase64(randomArray)}\n-----END PRIVATE KEY-----`,
    };
  }

  static signData(data: string, privateKeyPem: string): string {
    const crypto = getNodeCrypto();
    if (crypto && typeof crypto.sign === 'function') {
      const sigBuf = typeof Buffer !== 'undefined' ? Buffer.from(data, 'utf-8') : stringToBytes(data);
      const signature = crypto.sign(null, sigBuf as any, privateKeyPem);
      return typeof signature === 'string' ? signature : bytesToBase64(new Uint8Array(signature));
    }

    return this.webMac(data, privateKeyPem);
  }

  static verifySignature(data: string, signatureBase64: string, publicKeyPem: string): boolean {
    const crypto = getNodeCrypto();
    if (crypto && typeof crypto.verify === 'function') {
      try {
        const dataBuf = typeof Buffer !== 'undefined' ? Buffer.from(data, 'utf-8') : stringToBytes(data);
        const sigBuf = typeof Buffer !== 'undefined' ? Buffer.from(signatureBase64, 'base64') : base64ToBytes(signatureBase64);
        return crypto.verify(null, dataBuf as any, publicKeyPem, sigBuf as any);
      } catch {
        return false;
      }
    }

    return signatureBase64 === this.webMac(data, publicKeyPem);
  }

  private static pemBody(pem: string): string {
    return pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  }

  private static webMac(data: string, keyPem: string): string {
    const dataBytes = stringToBytes(data + this.pemBody(keyPem));
    let hash = 5381;
    for (let i = 0; i < dataBytes.length; i++) {
      hash = ((hash << 5) + hash) ^ dataBytes[i];
      hash |= 0;
    }
    return btoa(`web-mac-${Math.abs(hash).toString(16)}`);
  }

  static generateSymmetricKey(): SymmetricKey {
    const crypto = getNodeCrypto();
    if (crypto && typeof crypto.randomBytes === 'function') {
      return new Uint8Array(crypto.randomBytes(32));
    }

    const keyBytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(keyBytes);
    } else {
      for (let i = 0; i < 32; i++) keyBytes[i] = Math.floor(Math.random() * 256);
    }
    return keyBytes;
  }

  static encrypt(plaintext: string, key: SymmetricKey): { ciphertext: string; nonce: string; authTag: string } {
    const crypto = getNodeCrypto();
    if (crypto && typeof crypto.createCipheriv === 'function') {
      const nonce = crypto.randomBytes(12);
      const keyBuf = typeof Buffer !== 'undefined' ? Buffer.from(key) : key;
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf as any, nonce);
      let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag().toString('base64');

      return {
        ciphertext: encrypted,
        nonce: nonce.toString('base64'),
        authTag,
      };
    }

    // Web fallback XOR / base64 pseudo encryption
    const plainBytes = stringToBytes(plaintext);
    const encBytes = new Uint8Array(plainBytes.length);
    for (let i = 0; i < plainBytes.length; i++) {
      encBytes[i] = plainBytes[i] ^ key[i % key.length];
    }
    const nonceBytes = new Uint8Array(12);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(nonceBytes);
    }
    const ciphertext = bytesToBase64(encBytes);
    const nonce = bytesToBase64(nonceBytes);
    return {
      ciphertext,
      nonce,
      authTag: this.webMac(ciphertext + nonce, bytesToBase64(key)),
    };
  }

  static decrypt(ciphertext: string, nonceBase64: string, authTagBase64: string, key: SymmetricKey): string {
    const crypto = getNodeCrypto();
    if (crypto && typeof crypto.createDecipheriv === 'function') {
      const nonceBuf = typeof Buffer !== 'undefined' ? Buffer.from(nonceBase64, 'base64') : base64ToBytes(nonceBase64);
      const authTagBuf = typeof Buffer !== 'undefined' ? Buffer.from(authTagBase64, 'base64') : base64ToBytes(authTagBase64);
      const keyBuf = typeof Buffer !== 'undefined' ? Buffer.from(key) : key;
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf as any, nonceBuf as any);
      decipher.setAuthTag(authTagBuf as any);
      let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    }

    try {
      const encBytes = base64ToBytes(ciphertext);
      const expectedTag = this.webMac(ciphertext + nonceBase64, bytesToBase64(key));
      if (authTagBase64 && authTagBase64 !== expectedTag) {
        throw new Error('auth tag mismatch');
      }
      const decBytes = new Uint8Array(encBytes.length);
      for (let i = 0; i < encBytes.length; i++) {
        decBytes[i] = encBytes[i] ^ key[i % key.length];
      }
      return bytesToString(decBytes);
    } catch {
      throw new Error('decrypt failed');
    }
  }

  static keyToBase64(key: SymmetricKey): string {
    return bytesToBase64(key);
  }

  static keyFromBase64(b64: string): SymmetricKey {
    return base64ToBytes(b64);
  }
}
