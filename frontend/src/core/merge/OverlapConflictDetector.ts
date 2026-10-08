import { Conflict } from '@decentraide/shared';
import { JavaAstParser, SemanticASTConflict } from '../ast/JavaAstParser';

export interface OverlapEvent {
  conflict: Conflict;
}

const WINDOW_MS = 60000;

export class OverlapConflictDetector {
  private static instance: OverlapConflictDetector;
  private lastLocal?: { peerId: string; filePath: string; snippet: string; at: number };
  private lastRemote?: { peerId: string; filePath: string; snippet: string; at: number };
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

  getLatest(): Conflict | null {
    return this.latest;
  }

  getLatestAstConflict(): SemanticASTConflict | null {
    return this.latestAstConflict;
  }

  clear(): void {
    this.latest = null;
    this.latestAstConflict = null;
    this.notify();
  }

  noteLocalEdit(peerId: string, filePath: string, snippet: string): void {
    this.lastLocal = { peerId, filePath, snippet, at: Date.now() };
    this.maybeDetect();
  }

  noteRemoteEdit(peerId: string, filePath: string, snippet: string): void {
    this.lastRemote = { peerId, filePath, snippet, at: Date.now() };
    this.maybeDetect();
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
