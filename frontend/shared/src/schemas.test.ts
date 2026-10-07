import { describe, it, expect } from 'vitest';
import { FrameSchema, ProposalSchema, SecurityEventSchema } from './schemas.js';

describe('Zod Schemas Validation', () => {
  it('validates a correct Frame', () => {
    const validFrame = {
      v: 1,
      type: 'crdt.update',
      projectId: 'P-72A91',
      from: 'fingerprint123',
      opId: '018e9b5a-8b12-7a34-9c56-123456789abc', // valid uuid
      lamport: 184,
      ts: 1760000000000,
      payload: 'base64ciphertext==',
      sig: 'ed25519signature',
    };
    
    const result = FrameSchema.safeParse(validFrame);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid Frame (wrong version)', () => {
    const invalidFrame = {
      v: 2, // invalid
      type: 'crdt.update',
      projectId: 'P-72A91',
      from: 'fingerprint123',
      opId: '018e9b5a-8b12-7a34-9c56-123456789abc',
      lamport: 184,
      ts: 1760000000000,
      payload: 'base64ciphertext==',
      sig: 'ed25519signature',
    };
    
    const result = FrameSchema.safeParse(invalidFrame);
    expect(result.success).toBe(false);
  });

  it('validates a correct Proposal', () => {
    const validProposal = {
      id: 'prop-1',
      conflictId: 'conf-1',
      proposedCode: 'return pass != null && pass.length() > 8;',
      rationale: 'Merged length and null check.',
      confidence: 94,
      model: 'mistral:latest',
      contextHash: 'hash123',
      status: 'pending',
      generatedAt: Date.now(),
    };

    const result = ProposalSchema.safeParse(validProposal);
    expect(result.success).toBe(true);
  });

  it('rejects a Proposal with out-of-bounds confidence', () => {
    const invalidProposal = {
      id: 'prop-1',
      conflictId: 'conf-1',
      proposedCode: 'return true;',
      rationale: 'Test',
      confidence: 105, // invalid, max 100
      model: 'mistral:latest',
      contextHash: 'hash123',
      status: 'pending',
      generatedAt: Date.now(),
    };

    const result = ProposalSchema.safeParse(invalidProposal);
    expect(result.success).toBe(false);
  });

  it('validates a correct SecurityEvent', () => {
    const validEvent = {
      id: 'evt-1',
      timestamp: Date.now(),
      peerId: 'peer-1',
      reason: 'Invalid signature',
      status: 'REJECTED',
    };

    const result = SecurityEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });
});
