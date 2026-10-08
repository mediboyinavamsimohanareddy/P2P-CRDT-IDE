import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalPersistenceManager, OfflineSessionDraft } from '../../services/LocalPersistenceManager';
import { OverlapConflictDetector } from '../merge/OverlapConflictDetector';
import { SemanticConflictResolver } from '../merge/SemanticConflictResolver';
import { AIProvider } from '../ai/AIProvider';
import { AutoRejoinManager } from './AutoRejoinManager';

const MAIN = (b: number, extra = '') => `class Main {
    public static void main(String[] args) {
        int b = ${b};${extra ? `\n        ${extra}` : ''}
        int result = 50;
    }
}`;

function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
  return store;
}

describe('Check 1: offline draft in localStorage and automatic rejoin', () => {
  let store: Map<string, string>;
  let persistence: LocalPersistenceManager;

  beforeEach(() => {
    store = installLocalStorage();
    persistence = new LocalPersistenceManager('.');
  });

  const draft: OfflineSessionDraft = {
    roomId: 'DB-ROOM-42',
    peerId: 'laptop-3',
    displayName: 'Laptop 3',
    code: MAIN(30),
    filePath: 'Main.java',
    isHost: false,
    lastSavedAt: 1,
  };

  it('stores room id and code under the DevTools-visible keys', () => {
    persistence.saveOfflineDraft(draft);
    expect(store.get('decentraide:active-room-id')).toBe('DB-ROOM-42');
    expect(store.get('decentraide:cached-code')).toBe(MAIN(30));
    expect(JSON.parse(store.get('decentraide:offline-session')!).roomId).toBe('DB-ROOM-42');
    expect(persistence.getOfflineDraft()?.code).toBe(MAIN(30));
  });

  it('wifi off saves the draft; wifi on rejoins the stored room, forwards the code, then clears it', async () => {
    const manager = new AutoRejoinManager();
    manager.setDraftProvider(() => ({
      roomId: 'DB-ROOM-42',
      peerId: 'laptop-3',
      code: MAIN(30),
      filePath: 'Main.java',
      isHost: false,
    }));
    const rejoin = vi.fn().mockResolvedValue(undefined);
    const recovered = vi.fn();
    manager.setTriggerRejoinHandler(rejoin);
    manager.setOfflineCodeRecoveredHandler(recovered);

    manager.handleNetworkLoss();
    expect(store.get('decentraide:active-room-id')).toBe('DB-ROOM-42');
    expect(store.get('decentraide:cached-code')).toBe(MAIN(30));

    expect(await manager.attemptRejoin()).toBe(true);
    expect(rejoin).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'DB-ROOM-42' }));
    expect(recovered).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'DB-ROOM-42', code: MAIN(30) }));
    expect(store.has('decentraide:offline-session')).toBe(false);
    expect(store.has('decentraide:cached-code')).toBe(false);
    expect(store.get('decentraide:active-room-id')).toBe('DB-ROOM-42');
  });

  it('keeps the draft if forwarding it to the conflict manager throws', async () => {
    const manager = new AutoRejoinManager();
    persistence.saveOfflineDraft(draft);
    manager.setTriggerRejoinHandler(vi.fn().mockResolvedValue(undefined));
    manager.setOfflineCodeRecoveredHandler(() => {
      throw new Error('detector down');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await manager.attemptRejoin();
    expect(persistence.getOfflineDraft()?.code).toBe(MAIN(30));
  });
});

describe('Check 2: conflict detector sees every laptop', () => {
  it('raises one conflict containing all three laptops and keeps identical copies for the vote', () => {
    const detector = new OverlapConflictDetector(0);
    const seen = vi.fn();
    detector.subscribe(seen);

    detector.noteLocalEdit('laptop-1', 'Main.java', MAIN(30));
    detector.noteRemoteEdit('laptop-2', 'Main.java', MAIN(30));
    expect(detector.getLatest()).toBeNull();

    detector.noteRemoteEdit('laptop-3', 'Main.java', MAIN(80));

    const conflict = detector.getLatest()!;
    expect(conflict.versions.map((v) => v.authorId).sort()).toEqual(['laptop-1', 'laptop-2', 'laptop-3']);
    expect(conflict.baseSnippet).toBe(MAIN(30));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('does not truncate long files', () => {
    const detector = new OverlapConflictDetector(0);
    const long = MAIN(1, `// ${'x'.repeat(5000)}`);
    detector.noteLocalEdit('a', 'Main.java', long);
    detector.noteRemoteEdit('b', 'Main.java', MAIN(2));
    expect(detector.getLatest()!.versions[0].codeSnippet).toBe(long);
  });
});

describe('Check 3: merge follows the laptops\' vote', () => {
  const conflictFor = (bs: number[], extras: Record<number, string> = {}) => {
    const detector = new OverlapConflictDetector(0);
    bs.forEach((b, i) => detector.noteVersion(`laptop-${i + 1}`, 'Main.java', MAIN(b, extras[i])));
    detector.noteLocalEdit('laptop-1', 'Main.java', MAIN(bs[0], extras[0]));
    return detector.getLatest()!;
  };

  const ai = (resolvedCode: string, model = 'llama-3.3-70b-versatile'): AIProvider => ({
    id: 'fake',
    name: 'fake',
    isLocal: true,
    generateCompletion: async () => ({
      result: JSON.stringify({ resolvedCode, explanation: 'merged', confidence: 97 }),
      confidence: 95,
      model,
      isLocal: true,
    }),
  });

  it('2-of-3 majority beats the lone value even when that value is nearer the result', async () => {
    const conflict = conflictFor([10, 10, 49]);
    const proposal = await new SemanticConflictResolver(ai(MAIN(10))).resolveConflict(conflict);
    expect(proposal.proposedCode).toContain('int b = 10;');
    expect(proposal.confidence).toBeLessThanOrEqual(97);
  });

  it('no majority: the value nearest to result=50 is chosen from the three submitted values', async () => {
    const conflict = conflictFor([5, 48, 200]);
    const resolver = new SemanticConflictResolver(ai(MAIN(48)));
    const plan = resolver.planConsensus(conflict);
    expect(plan.contested[0].result.winner.codeLine).toBe('int b = 48;');
    expect(['int b = 5;', 'int b = 48;', 'int b = 200;']).toContain(plan.contested[0].result.winner.codeLine);

    const proposal = await resolver.resolveConflict(conflict);
    expect(proposal.proposedCode).toContain('int b = 48;');
  });

  it('overrides a model answer that ignores the vote with the vote-based merge', async () => {
    const conflict = conflictFor([30, 30, 80]);
    const proposal = await new SemanticConflictResolver(ai(MAIN(77))).resolveConflict(conflict);
    expect(proposal.proposedCode).toContain('int b = 30;');
    expect(proposal.proposedCode).not.toContain('int b = 77;');
    expect(proposal.model).toContain('overridden');
  });

  it('still produces a vote-based merge when the model is unreachable', async () => {
    const conflict = conflictFor([30, 30, 80]);
    const proposal = await new SemanticConflictResolver(
      ai('// echoed prompt', 'llama-3.3-70b-versatile (Offline Fallback)')
    ).resolveConflict(conflict);
    expect(proposal.proposedCode).toContain('int b = 30;');
    expect(proposal.rationale).toContain('unreachable');
  });

  it('keeps a variable only one laptop added', async () => {
    const conflict = conflictFor([30, 30, 80], { 1: 'int c = 7;' });
    const proposal = await new SemanticConflictResolver(
      ai('x', 'm (Offline Fallback)')
    ).resolveConflict(conflict);
    expect(proposal.proposedCode).toContain('int c = 7;');
    expect(proposal.proposedCode).toContain('int b = 30;');
  });
});
