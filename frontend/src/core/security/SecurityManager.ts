import { generateKeyPairSync, sign, verify, createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface CryptoIdentity {
  peerId: string; // SHA-256 fingerprint of public key
  publicKeyPem: string;
  privateKeyPem: string;
}

export class SecurityManager {
  static generateIdentity(): CryptoIdentity {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const peerId = createHash('sha256').update(publicKey).digest('hex').substring(0, 16);

    return {
      peerId,
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
    };
  }

  static signData(data: string, privateKeyPem: string): string {
    const signature = sign(null, Buffer.from(data, 'utf-8'), privateKeyPem);
    return signature.toString('base64');
  }

  static verifySignature(data: string, signatureBase64: string, publicKeyPem: string): boolean {
    try {
      return verify(null, Buffer.from(data, 'utf-8'), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
    } catch {
      return false;
    }
  }

  static generateSymmetricKey(): Buffer {
    return randomBytes(32); // 256-bit project key
  }

  static encrypt(plaintext: string, key: Buffer): { ciphertext: string; nonce: string; authTag: string } {
    const nonce = randomBytes(12); // 96-bit nonce for AES-GCM
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return {
      ciphertext: encrypted,
      nonce: nonce.toString('base64'),
      authTag,
    };
  }

  static decrypt(ciphertext: string, nonceBase64: string, authTagBase64: string, key: Buffer): string {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonceBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
    let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
