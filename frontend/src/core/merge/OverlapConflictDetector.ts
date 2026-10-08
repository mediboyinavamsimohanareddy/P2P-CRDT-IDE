import { Conflict } from '@decentraide/shared';
import { JavaAstParser, SemanticASTConflict } from '../ast/JavaAstParser';

export interface OverlapEvent {
  conflict: Conflict;
}

export interface PeerRecordedEdit {
  peerId: string;
  filePath: string;
  snippet: string;
  integerValue?: number;
  displayName?: string;
  at: number;
}

const WINDOW_MS = 60000;

export class OverlapConflictDetector {
  private static instance: OverlapConflictDetector;
  private lastLocal?: PeerRecordedEdit;
  private lastRemote?: PeerRecordedEdit;
  private peerEdits = new Map<string, PeerRecordedEdit>();
  private activeFilePath = 'Main.java';
  private latest: Conflict | null = null;
  private latestAstConflict: SemanticASTConflict | null = null;
  private listeners: Array<(c: Conflict, astConflict?: SemanticASTConflict | null) => void> = [];

  static getInstance(): OverlapConflictDetector {
    if (!OverlapConflictDetector.instance) {
      OverlapConflictDetector.instance = new OverlapConflictDetector();
    }
    return OverlapConflictDetector.instance;
  }

  setFilePath(path: string): void {
    this.activeFilePath = path;
  }

  getFilePath(): string {
    return this.activeFilePath;
  }

  getLatest(): Conflict | null {
    return this.latest;
  }

  getLatestAstConflict(): SemanticASTConflict | null {
    return this.latestAstConflict;
  }

  clear(): void {
    this.latest = null;
    this.latestAstConflict = null;
    this.peerEdits.clear();
    this.lastLocal = undefined;
    this.lastRemote = undefined;
    this.notify();
  }

  noteLocalEdit(peerId: string, filePath: string, snippet: string, integerValue?: number): void {
    const edit: PeerRecordedEdit = { peerId, filePath, snippet, integerValue, at: Date.now() };
    this.lastLocal = edit;
    this.peerEdits.set(peerId, edit);
    this.maybeDetect();
  }

  noteRemoteEdit(peerId: string, filePath: string, snippet: string, integerValue?: number, displayName?: string): void {
    const edit: PeerRecordedEdit = { peerId, filePath, snippet, integerValue, displayName, at: Date.now() };
    this.lastRemote = edit;
    this.peerEdits.set(peerId, edit);
    this.maybeDetect();
  }

  notePeerEdit(peerId: string, filePath: string, snippet: string, integerValue?: number, displayName?: string): void {
    const edit: PeerRecordedEdit = { peerId, filePath, snippet, integerValue, displayName, at: Date.now() };
    this.peerEdits.set(peerId, edit);
    if (!this.lastLocal) {
      this.lastLocal = edit;
    } else if (this.lastLocal.peerId !== peerId) {
      this.lastRemote = edit;
    }
    this.maybeDetect();
  }

  /**
   * Triggers reconnected testing:
   * When an offline user restores internet, their local storage code is fetched,
   * rejoined to the room, and forwarded to the conflict detector to be tested
   * against the other laptops in the session.
   */
  triggerReconnectedTest(
    reconnectedPeerId: string,
    reconnectedCode: string,
    filePath = this.activeFilePath,
    integerValue?: number,
    displayName = 'Reconnected Laptop'
  ): Conflict {
    const reconnectedEdit: PeerRecordedEdit = {
      peerId: reconnectedPeerId,
      filePath,
      snippet: reconnectedCode,
      integerValue: integerValue ?? 20,
      displayName,
      at: Date.now(),
    };
    this.peerEdits.set(reconnectedPeerId, reconnectedEdit);

    // Build multi-peer conflict containing the reconnected laptop and existing peer drafts
    const versionsList: Array<{
      authorId: string;
      opHash: string;
      codeSnippet: string;
      line: number;
    }> = [];

    // Ensure we gather at least the other laptops in the session
    for (const [pId, edit] of this.peerEdits.entries()) {
      versionsList.push({
        authorId: pId,
        opHash: `peer-${pId.substring(0, 6)}-${edit.at}`,
        codeSnippet: edit.snippet.slice(0, 1000),
        line: 1,
      });
    }

    // If only 1 peer in map, create fallback mock versions for comparison
    if (versionsList.length === 1) {
      versionsList.push({
        authorId: 'laptop-other-1',
        opHash: 'remote-1',
        codeSnippet: 'int a = 10;',
        line: 1,
      });
      versionsList.push({
        authorId: 'laptop-other-2',
        opHash: 'remote-2',
        codeSnippet: 'int a = 20;',
        line: 1,
      });
    }

    const astConflict = JavaAstParser.compareAST(
      filePath,
      reconnectedCode,
      reconnectedCode,
      versionsList[1]?.codeSnippet || reconnectedCode
    );

    const conflict: Conflict = {
      id: `reconnect-test-${Date.now()}`,
      filePath,
      detectedAt: Date.now(),
      baseSnippet: reconnectedCode.slice(0, 1000),
      versions: versionsList,
    };

    this.latest = conflict;
    this.latestAstConflict = astConflict;
    this.notify();
    return conflict;
  }

  /**
   * Handles peer offline timeout:
   * Even after some time if the user can't bring back the internet,
   * only the other 2 laptops' code moves forward to the conflict detector.
   */
  handlePeerOfflineTimeout(offlinePeerId: string): Conflict | null {
    this.peerEdits.delete(offlinePeerId);

    if (this.lastRemote?.peerId === offlinePeerId) {
      this.lastRemote = undefined;
    }
    if (this.lastLocal?.peerId === offlinePeerId) {
      this.lastLocal = undefined;
    }

    if (!this.latest || !this.latest.versions) {
      return null;
    }

    // Filter out the timed-out offline peer's version
    const remainingVersions = this.latest.versions.filter((v) => v.authorId !== offlinePeerId);

    if (remainingVersions.length === 0) {
      this.clear();
      return null;
    }

    const updatedConflict: Conflict = {
      ...this.latest,
      id: `fallback-2-laptop-${Date.now()}`,
      detectedAt: Date.now(),
      versions: remainingVersions,
    };

    const astConflict = JavaAstParser.compareAST(
      updatedConflict.filePath,
      updatedConflict.baseSnippet,
      remainingVersions[0]?.codeSnippet || '',
      remainingVersions[1]?.codeSnippet || ''
    );

    this.latest = updatedConflict;
    this.latestAstConflict = astConflict;
    this.notify();
    return updatedConflict;
  }

  subscribe(listener: (c: Conflict, astConflict?: SemanticASTConflict | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private maybeDetect(): void {
    const a = this.lastLocal;
    const b = this.lastRemote;
    if (!a || !b) return;
    if (a.filePath !== b.filePath) return;
    if (Math.abs(a.at - b.at) > WINDOW_MS) return;
    if (a.snippet === b.snippet) return;

    const targetFile = a.filePath || this.activeFilePath;
    const astConflict = JavaAstParser.compareAST(targetFile, a.snippet, a.snippet, b.snippet);

    const conflict: Conflict = {
      id: `overlap-${a.at}-${b.at}`,
      filePath: targetFile,
      detectedAt: Date.now(),
      baseSnippet: a.snippet.slice(0, 1000),
      versions: [
        {
          authorId: a.peerId,
          opHash: `local-${a.at}`,
          codeSnippet: a.snippet.slice(0, 1000),
          line: astConflict?.affectedRegion.startLine || 1,
        },
        {
          authorId: b.peerId,
          opHash: `remote-${b.at}`,
          codeSnippet: b.snippet.slice(0, 1000),
          line: astConflict?.affectedRegion.startLine || 1,
        },
      ],
    };
    this.latest = conflict;
    this.latestAstConflict = astConflict;
    this.listeners.forEach((l) => l(conflict, astConflict));
  }

  private notify(): void {
    if (this.latest) {
      this.listeners.forEach((l) => l(this.latest!, this.latestAstConflict));
    }
  }
}
