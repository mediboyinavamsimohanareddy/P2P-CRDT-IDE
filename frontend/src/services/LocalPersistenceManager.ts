import { promises as fs } from 'fs';
import { join } from 'path';

export interface WorkspaceMetadata {
  projectName: string;
  roomId?: string;
  lastOpened: number;
  openTabs: string[];
}

export class LocalPersistenceManager {
  private baseDir: string;

  constructor(workspacePath: string) {
    this.baseDir = join(workspacePath, '.decentraide');
  }

  private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && typeof window.localStorage.setItem === 'function';
  }

  async init(): Promise<void> {
    if (this.hasLocalStorage()) return;
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create .decentraide folder:', e);
    }
  }

  async saveMetadata(metadata: WorkspaceMetadata): Promise<boolean> {
    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:metadata', JSON.stringify(metadata));
      return true;
    }
    try {
      await this.init();
      const metaPath = join(this.baseDir, 'metadata.json');
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to save metadata:', e);
      return false;
    }
  }

  async getMetadata(): Promise<WorkspaceMetadata | null> {
    if (this.hasLocalStorage()) {
      const data = window.localStorage.getItem('decentraide:metadata');
      return data ? JSON.parse(data) : null;
    }
    try {
      const metaPath = join(this.baseDir, 'metadata.json');
      const data = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(data) as WorkspaceMetadata;
    } catch (e) {
      return null;
    }
  }

  async saveCrdtSnapshot(snapshot: Uint8Array): Promise<boolean> {
    const base64 = Buffer.from(snapshot).toString('base64');
    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:crdt-snapshot', base64);
      return true;
    }
    try {
      await this.init();
      const snapshotPath = join(this.baseDir, 'crdt-snapshot.bin');
      await fs.writeFile(snapshotPath, snapshot);
      return true;
    } catch (e) {
      console.error('Failed to save CRDT snapshot:', e);
      return false;
    }
  }

  async getCrdtSnapshot(): Promise<Uint8Array | null> {
    if (this.hasLocalStorage()) {
      const base64 = window.localStorage.getItem('decentraide:crdt-snapshot');
      return base64 ? new Uint8Array(Buffer.from(base64, 'base64')) : null;
    }
    try {
      const snapshotPath = join(this.baseDir, 'crdt-snapshot.bin');
      const data = await fs.readFile(snapshotPath);
      return new Uint8Array(data);
    } catch (e) {
      return null;
    }
  }

  async appendOpLog(opId: string, opData: string): Promise<boolean> {
    if (this.hasLocalStorage()) {
      const existing = window.localStorage.getItem('decentraide:oplog') || '';
      window.localStorage.setItem('decentraide:oplog', `${existing}${opId}:${opData}\n`);
      return true;
    }
    try {
      await this.init();
      const logPath = join(this.baseDir, 'oplog.db');
      await fs.appendFile(logPath, `${opId}:${opData}\n`, 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to append op log:', e);
      return false;
    }
  }
}
