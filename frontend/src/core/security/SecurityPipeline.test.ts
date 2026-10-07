import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityPipeline, MembershipList } from './SecurityPipeline';
import { SecurityManager } from './SecurityManager';
import { Frame } from '@decentraide/shared';

describe('SecurityPipeline (threat model defenses)', () => {
  let ownerIdentity: ReturnType<typeof SecurityManager.generateIdentity>;
  let devIdentity: ReturnType<typeof SecurityManager.generateIdentity>;
  let projectKey: ReturnType<typeof SecurityManager.generateSymmetricKey>;
  let membership: MembershipList;
  let pipeline: SecurityPipeline;

  beforeEach(() => {
    ownerIdentity = SecurityManager.generateIdentity();
    devIdentity = SecurityManager.generateIdentity();
    projectKey = SecurityManager.generateSymmetricKey();

    membership = {
      projectId: 'proj-101',
      ownerPeerId: ownerIdentity.peerId,
      members: new Map([
        [devIdentity.peerId, { role: 'Developer', publicKeyPem: devIdentity.publicKeyPem }],
      ]),
      ownerSignature: 'valid-sig',
    };

    pipeline = new SecurityPipeline(membership, projectKey);
  });

  function createValidFrame(payloadText: string): Frame {
    const encrypted = SecurityManager.encrypt(payloadText, projectKey);
    const payloadStr = JSON.stringify(encrypted);
    const sig = SecurityManager.signData(payloadStr, devIdentity.privateKeyPem);

    return {
      v: 1,
      type: 'crdt.update',
      projectId: 'proj-101',
      from: devIdentity.peerId,
      opId: '018e9b5a-8b12-7a34-9c56-123456789abc',
      lamport: 1,
      ts: Date.now(),
      payload: payloadStr,
      sig,
    };
  }

  it('accepts valid signed and encrypted frame', () => {
    const frame = createValidFrame('valid-crdt-op');
    const res = pipeline.processIncomingFrame(frame);

    expect(res.success).toBe(true);
    expect(res.decryptedPayload).toBe('valid-crdt-op');
  });

  it('rejects forged frame (invalid signature)', () => {
    const frame = createValidFrame('valid-crdt-op');
    frame.sig = 'invalid-forged-signature';

    const res = pipeline.processIncomingFrame(frame);
    expect(res.success).toBe(false);
    expect(res.reason).toBe('Invalid signature');
  });

  it('rejects modified payload in transit', () => {
    const frame = createValidFrame('valid-crdt-op');
    frame.payload = JSON.stringify({ ciphertext: 'modified', nonce: 'abc', authTag: 'xyz' });

    const res = pipeline.processIncomingFrame(frame);
    expect(res.success).toBe(false);
    expect(res.reason).toBe('Invalid signature');
  });

  it('rejects duplicate operation replay attack', () => {
    const frame = createValidFrame('valid-crdt-op');

    const first = pipeline.processIncomingFrame(frame);
    expect(first.success).toBe(true);

    const second = pipeline.processIncomingFrame(frame);
    expect(second.success).toBe(false);
    expect(second.reason).toBe('Duplicate operation');
  });

  it('rejects unauthorized non-member peer frame', () => {
    const rogueIdentity = SecurityManager.generateIdentity();
    const encrypted = SecurityManager.encrypt('rogue-op', projectKey);
    const payloadStr = JSON.stringify(encrypted);
    const sig = SecurityManager.signData(payloadStr, rogueIdentity.privateKeyPem);

    const frame: Frame = {
      v: 1,
      type: 'crdt.update',
      projectId: 'proj-101',
      from: rogueIdentity.peerId,
      opId: '018e9b5a-8b12-7a34-9c56-999999999999',
      lamport: 1,
      ts: Date.now(),
      payload: payloadStr,
      sig,
    };

    const res = pipeline.processIncomingFrame(frame);
    expect(res.success).toBe(false);
    expect(res.reason).toBe('Not a member');
  });
});
