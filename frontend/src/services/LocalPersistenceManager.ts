declare const __webpack_require__: unknown;
declare const __non_webpack_require__: (id: string) => any;

export interface WorkspaceMetadata {
  projectName: string;
  roomId?: string;
  lastOpened: number;
  openTabs: string[];
}

let nodeFsPromises: typeof import('fs').promises | null = null;
function getFsPromises(): typeof import('fs').promises | null {
  if (nodeFsPromises) return nodeFsPromises;
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const req = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : eval('require');
      nodeFsPromises = req('fs').promises;
      return nodeFsPromises;
    }
  } catch {
    // Web environment
  }
  return null;
}

function pathJoin(...parts: string[]): string {
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const req = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : eval('require');
      return req('path').join(...parts);
    }
  } catch {
    // Fallback for web
  }
  return parts.join('/').replace(/\/+/g, '/');
}

export class LocalPersistenceManager {
  private baseDir: string;

  constructor(workspacePath: string) {
    this.baseDir = pathJoin(workspacePath, '.decentraide');
  }

  private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && typeof window.localStorage.setItem === 'function';
  }

  async init(): Promise<void> {
    if (this.hasLocalStorage()) return;
    try {
      const fs = getFsPromises();
      if (fs) {
        await fs.mkdir(this.baseDir, { recursive: true });
      }
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
      const fs = getFsPromises();
      if (fs) {
        const metaPath = pathJoin(this.baseDir, 'metadata.json');
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
        return true;
      }
      return false;
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
      const fs = getFsPromises();
      if (fs) {
        const metaPath = pathJoin(this.baseDir, 'metadata.json');
        const data = await fs.readFile(metaPath, 'utf-8');
        return JSON.parse(data) as WorkspaceMetadata;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async saveCrdtSnapshot(snapshot: Uint8Array): Promise<boolean> {
    let base64 = '';
    for (let i = 0; i < snapshot.byteLength; i++) {
      base64 += String.fromCharCode(snapshot[i]);
    }
    base64 = btoa(base64);

    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:crdt-snapshot', base64);
      return true;
    }
    try {
      await this.init();
      const fs = getFsPromises();
      if (fs) {
        const snapshotPath = pathJoin(this.baseDir, 'crdt-snapshot.bin');
        await fs.writeFile(snapshotPath, snapshot);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to save CRDT snapshot:', e);
      return false;
    }
  }

  async getCrdtSnapshot(): Promise<Uint8Array | null> {
    if (this.hasLocalStorage()) {
      const base64 = window.localStorage.getItem('decentraide:crdt-snapshot');
      if (!base64) return null;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    try {
      const fs = getFsPromises();
      if (fs) {
        const snapshotPath = pathJoin(this.baseDir, 'crdt-snapshot.bin');
        const data = await fs.readFile(snapshotPath);
        return new Uint8Array(data);
      }
      return null;
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
      const fs = getFsPromises();
      if (fs) {
        const logPath = pathJoin(this.baseDir, 'oplog.db');
        await fs.appendFile(logPath, `${opId}:${opData}\n`, 'utf-8');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to append op log:', e);
      return false;
    }
  }
}
