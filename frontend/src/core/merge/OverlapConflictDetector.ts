import { Conflict } from '@decentraide/shared';
import { JavaAstParser, SemanticASTConflict } from '../ast/JavaAstParser';

export interface OverlapEvent {
  conflict: Conflict;
}

interface PeerVersion {
  peerId: string;
  filePath: string;
  code: string;
  at: number;
}

type ConflictListener = (c: Conflict, astConflict?: SemanticASTConflict | null) => void;

const WINDOW_MS = 60000;
const DEFAULT_NOTIFY_DELAY_MS = 600;

/**
 * Tracks the latest version of each file reported by every laptop (local and remote)
 * and raises a conflict as soon as two or more laptops hold different code for the
 * same file. All versions are kept, including identical ones, so the consensus vote
 * downstream can count laptops.
 */
export class OverlapConflictDetector {
  private static instance: OverlapConflictDetector;
  private versions = new Map<string, PeerVersion>();
  private localPeerId: string | null = null;
  private activeFilePath = 'Main.java';
  private latest: Conflict | null = null;
  private latestAstConflict: SemanticASTConflict | null = null;
  private listeners: ConflictListener[] = [];
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private notifyDelayMs = DEFAULT_NOTIFY_DELAY_MS) {}

  static getInstance(): OverlapConflictDetector {
    if (!OverlapConflictDetector.instance) {
      OverlapConflictDetector.instance = new OverlapConflictDetector();
    }
    return OverlapConflictDetector.instance;
  }

  setFilePath(path: string): void {
    this.activeFilePath = path;
  }

  getLatest(): Conflict | null {
    return this.latest;
  }

  getLatestAstConflict(): SemanticASTConflict | null {
    return this.latestAstConflict;
  }

  clear(): void {
    this.versions.clear();
    this.latest = null;
    this.latestAstConflict = null;
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
  }

  noteLocalEdit(peerId: string, filePath: string, snippet: string): void {
    this.localPeerId = peerId;
    this.noteVersion(peerId, filePath, snippet);
  }

  noteRemoteEdit(peerId: string, filePath: string, snippet: string): void {
    this.noteVersion(peerId, filePath, snippet);
  }

  noteVersion(peerId: string, filePath: string, code: string): void {
    this.versions.set(`${filePath}\u0000${peerId}`, { peerId, filePath, code, at: Date.now() });
    this.maybeDetect(filePath);
  }

  subscribe(listener: ConflictListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private maybeDetect(filePath: string): void {
    const forFile = [...this.versions.values()].filter((v) => v.filePath === filePath);
    if (forFile.length < 2) return;

    const newest = Math.max(...forFile.map((v) => v.at));
    const entries = forFile.filter((v) => newest - v.at <= WINDOW_MS);
    const first = entries[0];
    const differing = entries.find((v) => v.code !== first.code);
    if (!differing) return;

    const local = entries.find((v) => v.peerId === this.localPeerId);
    const base = (local ?? first).code;
    const astConflict = JavaAstParser.compareAST(filePath || this.activeFilePath, base, first.code, differing.code);
    const line = astConflict?.affectedRegion.startLine || 1;

    const conflict: Conflict = {
      id: `overlap-${newest}-${entries.length}`,
      filePath,
      detectedAt: Date.now(),
      baseSnippet: base,
      versions: entries.map((v) => ({
        authorId: v.peerId,
        opHash: `${v.peerId === this.localPeerId ? 'local' : 'remote'}-${v.at}`,
        codeSnippet: v.code,
        line,
      })),
    };

    this.latest = conflict;
    this.latestAstConflict = astConflict;
    this.scheduleNotify();
  }

  private scheduleNotify(): void {
    if (this.notifyDelayMs <= 0) {
      this.notify();
      return;
    }
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.notify();
    }, this.notifyDelayMs);
  }

  private notify(): void {
    if (!this.latest) return;
    const conflict = this.latest;
    const ast = this.latestAstConflict;
    this.listeners.forEach((l) => l(conflict, ast));
  }
}
