import { describe, it, expect } from 'vitest';
import { OperationLogStore } from './OperationLogStore';

describe('OperationLogStore', () => {
  it('logs applied operations with incremental operation numbers', () => {
    const store = OperationLogStore.getInstance();
    const initialCount = store.getEntries().length;

    store.logAppliedOp('Peer-B', 'INSERT', 'LoginService.java');

    const entries = store.getEntries();
    expect(entries.length).toBe(initialCount + 1);
    expect(entries[0].status).toBe('APPLIED');
    expect(entries[0].filePath).toBe('LoginService.java');
  });
});
