import { MergeHistoryRecord } from '../../components/RightPanel';

export class MergeHistoryStore {
  private static instance: MergeHistoryStore;
  private records: MergeHistoryRecord[] = [];

  private listeners: Array<() => void> = [];

  public static getInstance(): MergeHistoryStore {
    if (!MergeHistoryStore.instance) {
      MergeHistoryStore.instance = new MergeHistoryStore();
    }
    return MergeHistoryStore.instance;
  }

  addRecord(record: MergeHistoryRecord): void {
    this.records.unshift(record);
    this.notify();
  }

  getRecords(): MergeHistoryRecord[] {
    return [...this.records];
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
