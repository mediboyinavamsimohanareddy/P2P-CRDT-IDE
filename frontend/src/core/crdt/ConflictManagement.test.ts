import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { YjsCrdtEngine } from './CrdtEngine';
import { CrdtMonacoBinding } from './CrdtMonacoBinding';
import { ConvergenceVerifier } from '../sync/ConvergenceVerifier';

describe('CRDT Conflict Management Test Suite', () => {
  // TEST 1 — Single local edit
  it('TEST 1: Single local edit updates Y.Doc correctly', () => {
    const engine = new YjsCrdtEngine();
    const yText = engine.getText('src/index.ts');
    
    expect(yText.toString()).toBe('');
    
    yText.insert(0, 'console.log("Hello World");');
    
    expect(yText.toString()).toBe('console.log("Hello World");');
    expect(engine.computeFileHash('src/index.ts')).not.toBe('00000000');
  });

  // TEST 2 — Two-peer synchronization
  it('TEST 2: Two-peer synchronization converges when updates are exchanged', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    let updateFromA: Uint8Array | null = null;
    
    peerA.onUpdate((update, origin) => {
      if (origin === 'local-A') {
        updateFromA = update;
      }
    });

    peerA.getDoc().transact(() => {
      peerA.getText('file1.js').insert(0, 'Hello from Peer A');
    }, 'local-A');

    expect(updateFromA).not.toBeNull();

    // Peer B receives update from A
    if (updateFromA) {
      peerB.applyUpdate(updateFromA, 'remote-A');
    }

    expect(peerB.getText('file1.js').toString()).toBe('Hello from Peer A');
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
  });

  // TEST 3 — Concurrent independent edits
  it('TEST 3: Concurrent independent edits merge and converge across replicas', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    // Initial synchronized state
    const initialContent = 'Hello World';
    peerA.getText('doc.txt').insert(0, initialContent);
    const initialUpdate = peerA.encodeStateAsUpdate();
    peerB.applyUpdate(initialUpdate, 'sync-initial');

    expect(peerA.getText('doc.txt').toString()).toBe('Hello World');
    expect(peerB.getText('doc.txt').toString()).toBe('Hello World');

    let updateA: Uint8Array | null = null;
    peerA.onUpdate((u, origin) => {
      if (origin === 'local-A') updateA = u;
    });

    let updateB: Uint8Array | null = null;
    peerB.onUpdate((u, origin) => {
      if (origin === 'local-B') updateB = u;
    });

    // Peer A edits start of document
    peerA.getDoc().transact(() => {
      peerA.getText('doc.txt').insert(0, 'A says: ');
    }, 'local-A');

    // Peer B independently edits end of document (index 11 is end of 'Hello World')
    peerB.getDoc().transact(() => {
      peerB.getText('doc.txt').insert(11, ' - B signature');
    }, 'local-B');

    // Exchange updates
    expect(updateA).not.toBeNull();
    expect(updateB).not.toBeNull();

    peerA.applyUpdate(updateB!, 'remote-B');
    peerB.applyUpdate(updateA!, 'remote-A');

    // Both converge to identical text
    const textA = peerA.getText('doc.txt').toString();
    const textB = peerB.getText('doc.txt').toString();

    expect(textA).toBe('A says: Hello World - B signature');
    expect(textB).toBe('A says: Hello World - B signature');
    expect(textA).toBe(textB);
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
  });

  // TEST 4 — Concurrent same-region edits
  it('TEST 4: Concurrent same-region edits do not crash or corrupt document and converge deterministically', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    // Initial state: "function test() {}"
    peerA.getText('Code.java').insert(0, 'function test() {}');
    peerB.applyUpdate(peerA.encodeStateAsUpdate(), 'initial');

    let updateA: Uint8Array | null = null;
    peerA.onUpdate((u, origin) => {
      if (origin === 'local-A') updateA = u;
    });

    let updateB: Uint8Array | null = null;
    peerB.onUpdate((u, origin) => {
      if (origin === 'local-B') updateB = u;
    });

    // Concurrent edit at position 14 (inside params `()`)
    peerA.getDoc().transact(() => {
      peerA.getText('Code.java').insert(14, 'int x');
    }, 'local-A');

    peerB.getDoc().transact(() => {
      peerB.getText('Code.java').insert(14, 'String y');
    }, 'local-B');

    // Cross-apply
    peerA.applyUpdate(updateB!, 'remote-B');
    peerB.applyUpdate(updateA!, 'remote-A');

    const resultA = peerA.getText('Code.java').toString();
    const resultB = peerB.getText('Code.java').toString();

    // Replicas must converge to the exact same text state
    expect(resultA).toBe(resultB);
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
    
    // Both edits must be preserved
    expect(resultA).toContain('int x');
    expect(resultA).toContain('String y');
  });

  // TEST 5 — Duplicate update handling
  it('TEST 5: Applying duplicate updates is idempotent and does not produce duplicate content', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    let updateA: Uint8Array | null = null;
    peerA.onUpdate((u, origin) => {
      if (origin === 'local-A') updateA = u;
    });

    peerA.getDoc().transact(() => {
      peerA.getText('sample.ts').insert(0, 'Unique text entry');
    }, 'local-A');

    expect(updateA).not.toBeNull();

    // Apply updateA once
    peerB.applyUpdate(updateA!, 'remote-A');
    const contentFirstPass = peerB.getText('sample.ts').toString();
    expect(contentFirstPass).toBe('Unique text entry');

    // Apply updateA second time (duplicate delivery)
    peerB.applyUpdate(updateA!, 'remote-A');
    const contentSecondPass = peerB.getText('sample.ts').toString();

    expect(contentSecondPass).toBe('Unique text entry');
    expect(contentSecondPass).toBe(contentFirstPass);
  });

  // TEST 6 — Out-of-order updates
  it('TEST 6: Out-of-order update delivery converges to the correct deterministic state', () => {
    const peerSource = new YjsCrdtEngine();
    const peerTarget1 = new YjsCrdtEngine();
    const peerTarget2 = new YjsCrdtEngine();

    const updates: Uint8Array[] = [];
    peerSource.onUpdate((u, origin) => {
      if (origin.startsWith('step-')) {
        updates.push(u);
      }
    });

    // Step 1
    peerSource.getDoc().transact(() => {
      peerSource.getText('seq.txt').insert(0, 'First. ');
    }, 'step-1');

    // Step 2
    peerSource.getDoc().transact(() => {
      peerSource.getText('seq.txt').insert(7, 'Second. ');
    }, 'step-2');

    // Step 3
    peerSource.getDoc().transact(() => {
      peerSource.getText('seq.txt').insert(15, 'Third.');
    }, 'step-3');

    expect(updates.length).toBe(3);

    // Target 1 receives in order: U1, U2, U3
    peerTarget1.applyUpdate(updates[0], 'src');
    peerTarget1.applyUpdate(updates[1], 'src');
    peerTarget1.applyUpdate(updates[2], 'src');

    // Target 2 receives out of order: U3, U1, U2
    peerTarget2.applyUpdate(updates[2], 'src');
    peerTarget2.applyUpdate(updates[0], 'src');
    peerTarget2.applyUpdate(updates[1], 'src');

    const expectedText = 'First. Second. Third.';
    expect(peerTarget1.getText('seq.txt').toString()).toBe(expectedText);
    expect(peerTarget2.getText('seq.txt').toString()).toBe(expectedText);
    expect(peerTarget1.computeWorkspaceHash()).toBe(peerTarget2.computeWorkspaceHash());
  });

  // TEST 7 — Three peers convergence
  it('TEST 7: Three peers editing concurrently converge to State(A) == State(B) == State(C)', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();
    const peerC = new YjsCrdtEngine();

    // Base initial state
    peerA.getText('shared.py').insert(0, '# Base document\n');
    const baseUpdate = peerA.encodeStateAsUpdate();
    peerB.applyUpdate(baseUpdate, 'init');
    peerC.applyUpdate(baseUpdate, 'init');

    let updateA: Uint8Array | null = null;
    peerA.onUpdate((u, origin) => {
      if (origin === 'local-A') updateA = u;
    });

    let updateB: Uint8Array | null = null;
    peerB.onUpdate((u, origin) => {
      if (origin === 'local-B') updateB = u;
    });

    let updateC: Uint8Array | null = null;
    peerC.onUpdate((u, origin) => {
      if (origin === 'local-C') updateC = u;
    });

    // Independent edits at position 16 (end of '# Base document\n')
    peerA.getDoc().transact(() => {
      peerA.getText('shared.py').insert(16, 'import os\n');
    }, 'local-A');

    peerB.getDoc().transact(() => {
      peerB.getText('shared.py').insert(16, 'import sys\n');
    }, 'local-B');

    peerC.getDoc().transact(() => {
      peerC.getText('shared.py').insert(16, 'import math\n');
    }, 'local-C');

    expect(updateA).not.toBeNull();
    expect(updateB).not.toBeNull();
    expect(updateC).not.toBeNull();

    // Exchange updates in arbitrary/different orders
    // Peer A receives B then C
    peerA.applyUpdate(updateB!, 'remote-B');
    peerA.applyUpdate(updateC!, 'remote-C');

    // Peer B receives C then A
    peerB.applyUpdate(updateC!, 'remote-C');
    peerB.applyUpdate(updateA!, 'remote-A');

    // Peer C receives A then B
    peerC.applyUpdate(updateA!, 'remote-A');
    peerC.applyUpdate(updateB!, 'remote-B');

    const textA = peerA.getText('shared.py').toString();
    const textB = peerB.getText('shared.py').toString();
    const textC = peerC.getText('shared.py').toString();

    expect(textA).toBe(textB);
    expect(textB).toBe(textC);

    const hashA = peerA.computeWorkspaceHash();
    const hashB = peerB.computeWorkspaceHash();
    const hashC = peerC.computeWorkspaceHash();

    expect(hashA).toBe(hashB);
    expect(hashB).toBe(hashC);

    // Verify using ConvergenceVerifier
    const verifier = new ConvergenceVerifier(peerA, 'peer-A');
    verifier.recordRemoteHash('peer-B', hashB);
    verifier.recordRemoteHash('peer-C', hashC);
    expect(verifier.isConverged()).toBe(true);
  });

  // TEST 8 — Synchronization loop prevention
  it('TEST 8: Remote updates are applied with remote origin and do not trigger re-broadcast loops', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    const broadcastSpyA = vi.fn();
    const broadcastSpyB = vi.fn();

    peerA.onUpdate((update, origin) => {
      if (origin === 'monaco-local') {
        broadcastSpyA(update);
      }
    });

    peerB.onUpdate((update, origin) => {
      if (origin === 'monaco-local') {
        broadcastSpyB(update);
      }
    });

    // Monaco binding for Peer A
    const bindingA = new CrdtMonacoBinding(peerA, 'app.ts');
    let monacoValA = '';
    bindingA.bind(
      () => monacoValA,
      (val) => { monacoValA = val; }
    );

    // Monaco binding for Peer B
    const bindingB = new CrdtMonacoBinding(peerB, 'app.ts');
    let monacoValB = '';
    bindingB.bind(
      () => monacoValB,
      (val) => { monacoValB = val; }
    );

    // Local edit on Peer A
    bindingA.handleEditorChange('const x = 10;');
    expect(broadcastSpyA).toHaveBeenCalledTimes(1);

    // Peer B receives A's update with origin 'remote-peer-A'
    const updateFromA = broadcastSpyA.mock.calls[0][0];
    peerB.applyUpdate(updateFromA, 'remote-peer-A');

    // Peer B's editor updates to 'const x = 10;'
    expect(monacoValB).toBe('const x = 10;');

    // Crucially: Peer B must NOT trigger a local broadcast in response to the remote update
    expect(broadcastSpyB).not.toHaveBeenCalled();
  });

  // TEST 9 — Different documents isolation
  it('TEST 9: Updates for File A do not modify or corrupt File B', () => {
    const engine = new YjsCrdtEngine();
    
    engine.getText('FileA.txt').insert(0, 'Content of File A');
    engine.getText('FileB.txt').insert(0, 'Content of File B');

    expect(engine.getText('FileA.txt').toString()).toBe('Content of File A');
    expect(engine.getText('FileB.txt').toString()).toBe('Content of File B');

    // Edit File A at end
    const lenA = engine.getText('FileA.txt').length;
    engine.getText('FileA.txt').insert(lenA, ' - modified');

    expect(engine.getText('FileA.txt').toString()).toBe('Content of File A - modified');
    // File B must remain completely untouched
    expect(engine.getText('FileB.txt').toString()).toBe('Content of File B');
  });

  // TEST 10 — Application stability under rapid concurrent updates
  it('TEST 10: High-frequency rapid concurrent updates operate stably without crashing or corrupting state', () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    // Initial document setup
    peerA.getText('stress.log').insert(0, 'START\n');
    peerB.applyUpdate(peerA.encodeStateAsUpdate(), 'init');

    const iterations = 50;
    const updatesA: Uint8Array[] = [];
    const updatesB: Uint8Array[] = [];

    peerA.onUpdate((u, origin) => {
      if (origin === 'local-A') updatesA.push(u);
    });

    peerB.onUpdate((u, origin) => {
      if (origin === 'local-B') updatesB.push(u);
    });

    // Simulate 50 rapid interleaved edits
    for (let i = 0; i < iterations; i++) {
      peerA.getDoc().transact(() => {
        peerA.getText('stress.log').insert(peerA.getText('stress.log').length, `A-line-${i}\n`);
      }, 'local-A');

      peerB.getDoc().transact(() => {
        peerB.getText('stress.log').insert(peerB.getText('stress.log').length, `B-line-${i}\n`);
      }, 'local-B');
    }

    // Interleave and apply updates
    for (const u of updatesA) {
      peerB.applyUpdate(u, 'remote-A');
    }
    for (const u of updatesB) {
      peerA.applyUpdate(u, 'remote-B');
    }

    const finalTextA = peerA.getText('stress.log').toString();
    const finalTextB = peerB.getText('stress.log').toString();

    expect(finalTextA).toBe(finalTextB);
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
    expect(finalTextA.length).toBeGreaterThan(0);
  });
});
