import { SecurityEvent } from '@decentraide/shared';

export interface LogEntry {
  opNumber: number;
  opId: string;
  peerId: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'RENAME' | 'SYNC' | 'UNKNOWN';
  filePath: string;
  timestamp: string;
  status: 'APPLIED' | 'REJECTED';
  reason?: string;
}

export class OperationLogStore {
  private static instance: OperationLogStore;
  private entries: LogEntry[] = [];
  private counter = 180; // Starting index for realistic demo logs
  private listeners: Array<() => void> = [];

  public static getInstance(): OperationLogStore {
    if (!OperationLogStore.instance) {
      OperationLogStore.instance = new OperationLogStore();
    }
    return OperationLogStore.instance;
  }

  logAppliedOp(peerId: string, type: LogEntry['type'], filePath: string, opId?: string): void {
    const entry: LogEntry = {
      opNumber: this.counter++,
      opId: opId || `op-${Date.now()}`,
      peerId,
      type,
      filePath,
      timestamp: new Date().toLocaleTimeString(),
      status: 'APPLIED',
    };
    this.entries.unshift(entry);
    this.notify();
  }

  logRejectedSecurityEvent(evt: SecurityEvent, filePath = 'Workspace'): void {
    const entry: LogEntry = {
      opNumber: this.counter++,
      opId: evt.id,
      peerId: evt.peerId,
      type: 'UNKNOWN',
      filePath,
      timestamp: new Date(evt.timestamp).toLocaleTimeString(),
      status: 'REJECTED',
      reason: evt.reason,
    };
    this.entries.unshift(entry);
    this.notify();
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}
