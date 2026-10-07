import { describe, it, expect } from 'vitest';
import { MergeHistoryStore } from './MergeHistoryStore';

describe('MergeHistoryStore', () => {
  it('stores and retrieves real merge history records', () => {
    const store = MergeHistoryStore.getInstance();
    const initialCount = store.getRecords().length;

    store.addRecord({
      id: 'MERGE #0043',
      file: 'AuthPolicy.java',
      functionName: 'checkRole()',
      participants: ['Peer 1'],
      aiModel: 'Llama 3.1 8B Instant (Groq)',
      confidence: 96,
      status: 'ACCEPTED',
      timestamp: '12:50:00',
      stateHash: 'ABCD...1234',
      verificationDetails: {
        syntax: true,
        ast: true,
        staticAnalysis: true,
        typeCheck: true,
        compilation: true,
        tests: '42/42 PASS',
      },
    });

    const records = store.getRecords();
    expect(records.length).toBe(initialCount + 1);
    expect(records[0].id).toBe('MERGE #0043');
    expect(records[0].file).toBe('AuthPolicy.java');
  });
});
