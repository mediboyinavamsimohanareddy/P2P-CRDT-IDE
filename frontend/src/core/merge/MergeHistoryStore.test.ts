import { describe, it, expect } from 'vitest';
import { MergeHistoryStore } from './MergeHistoryStore';

describe('MergeHistoryStore', () => {
  it('stores and retrieves real merge history records', () => {
    const store = MergeHistoryStore.getInstance();
    const initialCount = store.getRecords().length;

    store.addRecord({
      id: 'SYNC-#0043',
      file: 'AuthPolicy.java',
      operationType: 'P2P Synchronization',
      peerInvolved: 'Peer 1',
      syncStatus: 'SYNCED',
      conflictStatus: 'RESOLVED',
      verificationStatus: 'PASSED',
      timestamp: '12:50:00',
      stateHash: 'ABCD...1234',
    });

    const records = store.getRecords();
    expect(records.length).toBe(initialCount + 1);
    expect(records[0].id).toBe('SYNC-#0043');
    expect(records[0].file).toBe('AuthPolicy.java');
  });
});
