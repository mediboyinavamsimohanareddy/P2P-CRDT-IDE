import { CrdtEngine } from './CrdtEngine';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';

export interface PendingOp {
  id: string;
  update: Uint8Array;
  timestamp: number;
}

export class OpLogManager {
  private engine: CrdtEngine;
  private persistence: LocalPersistenceManager;
  private pendingQueue: PendingOp[] = [];

  constructor(engine: CrdtEngine, persistence: LocalPersistenceManager) {
    this.engine = engine;
    this.persistence = persistence;
  }

  enqueueLocalUpdate(update: Uint8Array): void {
    const op: PendingOp = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      update,
      timestamp: Date.now(),
    };
    this.pendingQueue.push(op);
    this.persistence.appendOpLog(op.id, Buffer.from(update).toString('base64'));
  }

  getPendingQueue(): PendingOp[] {
    return [...this.pendingQueue];
  }

  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  flushQueue(onSend: (op: PendingOp) => boolean): void {
    const remaining: PendingOp[] = [];
    for (const op of this.pendingQueue) {
      const sent = onSend(op);
      if (!sent) {
        remaining.push(op);
      }
    }
    this.pendingQueue = remaining;
  }
}
