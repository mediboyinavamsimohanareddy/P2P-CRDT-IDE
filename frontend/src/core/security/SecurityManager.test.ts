import { describe, it, expect } from 'vitest';
import { SecurityManager } from './SecurityManager';

describe('SecurityManager', () => {
  it('generates Ed25519 identity with valid peerId fingerprint', () => {
    const identity = SecurityManager.generateIdentity();
    expect(identity.peerId).toHaveLength(16);
    expect(identity.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(identity.privateKeyPem).toContain('BEGIN PRIVATE KEY');
  });

  it('signs and verifies data with Ed25519 key pair', () => {
    const identity = SecurityManager.generateIdentity();
    const message = 'crdt-update-payload-123';

    const sig = SecurityManager.signData(message, identity.privateKeyPem);
    const isValid = SecurityManager.verifySignature(message, sig, identity.publicKeyPem);

    expect(isValid).toBe(true);
  });

  it('rejects tampered data signature verification', () => {
    const identity = SecurityManager.generateIdentity();
    const message = 'crdt-update-payload-123';

    const sig = SecurityManager.signData(message, identity.privateKeyPem);
    const isValid = SecurityManager.verifySignature('tampered-payload', sig, identity.publicKeyPem);

    expect(isValid).toBe(false);
  });

  it('encrypts and decrypts payload with symmetric key', () => {
    const key = SecurityManager.generateSymmetricKey();
    const secret = 'sensitive source code content';

    const encrypted = SecurityManager.encrypt(secret, key);
    const decrypted = SecurityManager.decrypt(encrypted.ciphertext, encrypted.nonce, encrypted.authTag, key);

    expect(decrypted).toBe(secret);
  });
});
