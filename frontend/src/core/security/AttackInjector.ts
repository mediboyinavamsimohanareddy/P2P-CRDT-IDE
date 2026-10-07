import { Frame } from '@decentraide/shared';
import { SecurityManager, CryptoIdentity, SymmetricKey } from './SecurityManager';
import { CollaborationManager } from '../sync/CollaborationManager';

function newOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '018e9b5a-8b12-7a34-9c56-123456789abc';
}

function buildSignedFrame(
  identity: CryptoIdentity,
  key: SymmetricKey,
  projectId: string,
  payloadText: string
): Frame {
  const encrypted = SecurityManager.encrypt(payloadText, key);
  const payloadStr = JSON.stringify(encrypted);
  const sig = SecurityManager.signData(payloadStr, identity.privateKeyPem);
  return {
    v: 1,
    type: 'crdt.update',
    projectId,
    from: identity.peerId,
    opId: newOpId(),
    lamport: Date.now(),
    ts: Date.now(),
    payload: payloadStr,
    sig,
  };
}

export type AttackKind = 'invalid-signature' | 'modified-payload' | 'duplicate' | 'unknown-peer';

export function injectAttack(kind: AttackKind): { success: boolean; reason?: string } {
  const collab = CollaborationManager.getInstance();
  const pipeline = collab.getSecurityPipeline();
  const identity = collab.getIdentity();
  const key = collab.getProjectKey();
  const roomId = collab.getPeerStore().getRoomId() || 'default-workspace';

  if (kind === 'unknown-peer') {
    const rogue = SecurityManager.generateIdentity();
    const frame = buildSignedFrame(rogue, key, roomId, '{"u":""}');
    return pipeline.processIncomingFrame(frame);
  }

  const valid = buildSignedFrame(identity, key, roomId, '{"u":""}');

  if (kind === 'invalid-signature') {
    valid.sig = 'invalid-forged-signature';
    return pipeline.processIncomingFrame(valid);
  }

  if (kind === 'modified-payload') {
    valid.payload = JSON.stringify({ ciphertext: 'modified', nonce: 'abc', authTag: 'xyz' });
    return pipeline.processIncomingFrame(valid);
  }

  if (kind === 'duplicate') {
    const first = pipeline.processIncomingFrame(valid);
    if (!first.success) return first;
    return pipeline.processIncomingFrame(valid);
  }

  return { success: false, reason: 'Unknown attack' };
}
