declare const __webpack_require__: unknown;
declare const __non_webpack_require__: (id: string) => any;

export interface WorkspaceMetadata {
  projectName: string;
  roomId?: string;
  lastOpened: number;
  openTabs: string[];
  sessionInfo?: ActiveSessionMetadata;
}

export interface ActiveSessionMetadata {
  roomId: string;
  isHost: boolean;
  signalingHost?: string;
  peerId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  projectKeyB64?: string;
  activeFilePath?: string;
  savedAt: number;
}

export interface OfflineSessionDraft {
  roomId: string;
  peerId: string;
  displayName?: string;
  code: string;
  integerValue?: number;
  filePath: string;
  isHost: boolean;
  lastSavedAt: number;
  isOffline: boolean;
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

  snapshotKey(roomId?: string): string {
    return roomId ? `decentraide:crdt-snapshot:${roomId}` : 'decentraide:crdt-snapshot';
  }

  async saveCrdtSnapshot(snapshot: Uint8Array, roomId?: string): Promise<boolean> {
    let base64 = '';
    for (let i = 0; i < snapshot.byteLength; i++) {
      base64 += String.fromCharCode(snapshot[i]);
    }
    base64 = btoa(base64);

    if (this.hasLocalStorage()) {
      window.localStorage.setItem(this.snapshotKey(roomId), base64);
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

  async getCrdtSnapshot(roomId?: string): Promise<Uint8Array | null> {
    if (this.hasLocalStorage()) {
      const base64 = window.localStorage.getItem(this.snapshotKey(roomId));
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

  async saveActiveSession(session: ActiveSessionMetadata): Promise<boolean> {
    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:active-session', JSON.stringify(session));
      return true;
    }
    try {
      await this.init();
      const fs = getFsPromises();
      if (fs) {
        const sessionPath = pathJoin(this.baseDir, 'active-session.json');
        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to save active session:', e);
      return false;
    }
  }

  async getActiveSession(): Promise<ActiveSessionMetadata | null> {
    if (this.hasLocalStorage()) {
      const data = window.localStorage.getItem('decentraide:active-session');
      return data ? JSON.parse(data) : null;
    }
    try {
      const fs = getFsPromises();
      if (fs) {
        const sessionPath = pathJoin(this.baseDir, 'active-session.json');
        const data = await fs.readFile(sessionPath, 'utf-8');
        return JSON.parse(data) as ActiveSessionMetadata;
      }
      return null;
    } catch {
      return null;
    }
  }

  async clearActiveSession(): Promise<boolean> {
    if (this.hasLocalStorage()) {
      window.localStorage.removeItem('decentraide:active-session');
      return true;
    }
    try {
      const fs = getFsPromises();
      if (fs) {
        const sessionPath = pathJoin(this.baseDir, 'active-session.json');
        await fs.unlink(sessionPath);
        return true;
      }
      return false;
    } catch {
      return false;
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

  /**
   * Saves offline draft into DevTools-visible localStorage keys:
   * - decentraide:offline-session
   * - decentraide:active-room-id
   * - decentraide:cached-code
   * - decentraide:user-integer-val
   */
  saveDevToolsOfflineDraft(draft: OfflineSessionDraft): void {
    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:offline-session', JSON.stringify(draft));
      window.localStorage.setItem('decentraide:active-room-id', draft.roomId || '');
      window.localStorage.setItem('decentraide:cached-code', draft.code || '');
      if (typeof draft.integerValue === 'number') {
        window.localStorage.setItem('decentraide:user-integer-val', draft.integerValue.toString());
      }
    }
  }

  /**
   * Retrieves offline session draft from DevTools-visible localStorage.
   */
  getDevToolsOfflineDraft(): OfflineSessionDraft | null {
    if (this.hasLocalStorage()) {
      const raw = window.localStorage.getItem('decentraide:offline-session');
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // ignore corrupted JSON
        }
      }
      const roomId = window.localStorage.getItem('decentraide:active-room-id');
      const code = window.localStorage.getItem('decentraide:cached-code');
      const intVal = window.localStorage.getItem('decentraide:user-integer-val');
      if (roomId || code) {
        return {
          roomId: roomId || '',
          peerId: 'peer-offline',
          code: code || '',
          integerValue: intVal ? parseInt(intVal, 10) : 0,
          filePath: 'Main.java',
          isHost: false,
          lastSavedAt: Date.now(),
          isOffline: true,
        };
      }
    }
    return null;
  }

  /**
   * Clears DevTools-visible offline draft keys upon successful sync.
   */
  clearDevToolsOfflineDraft(): void {
    if (this.hasLocalStorage()) {
      window.localStorage.removeItem('decentraide:offline-session');
      window.localStorage.removeItem('decentraide:cached-code');
      window.localStorage.removeItem('decentraide:user-integer-val');
    }
  }

  saveActiveRoomId(roomId: string): void {
    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:active-room-id', roomId);
    }
  }

  getActiveRoomId(): string | null {
    if (this.hasLocalStorage()) {
      return window.localStorage.getItem('decentraide:active-room-id');
    }
    return null;
  }

  saveCachedCode(code: string): void {
    if (this.hasLocalStorage()) {
      window.localStorage.setItem('decentraide:cached-code', code);
    }
  }

  getCachedCode(): string | null {
    if (this.hasLocalStorage()) {
      return window.localStorage.getItem('decentraide:cached-code');
    }
    return null;
  }
}
