import { MergeHistoryRecord } from '../../components/RightPanel';

export class MergeHistoryStore {
  private static instance: MergeHistoryStore;
  private records: MergeHistoryRecord[] = [
    {
      id: 'MERGE #0042',
      file: 'LoginService.java',
      functionName: 'validatePassword()',
      participants: ['Arjun (You)', 'Rahul', 'Mohammed'],
      aiModel: 'Llama 3.1 8B Instant (Groq)',
      confidence: 94,
      status: 'ACCEPTED',
      timestamp: new Date().toLocaleTimeString(),
      stateHash: '8F3A...C21D',
      verificationDetails: {
        syntax: true,
        ast: true,
        staticAnalysis: true,
        typeCheck: true,
        compilation: true,
        tests: '42/42 PASS',
      },
    },
  ];

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
