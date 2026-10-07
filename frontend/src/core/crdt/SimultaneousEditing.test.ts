import { describe, it, expect, vi } from 'vitest';
import { YjsCrdtEngine } from './CrdtEngine';
import { CrdtMonacoBinding } from './CrdtMonacoBinding';

describe('Simultaneous Two-User Real-Time Editing Regression Test', () => {
  it('allows simultaneous two-user editing in the same file and merges deterministically', () => {
    // User A and User B replicas
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();

    // Initial synced state: template header
    const initialText = 'public class Main {\n\n}\n';
    peerA.getText('Main.java').insert(0, initialText);
    const initialUpdate = peerA.encodeStateAsUpdate();
    peerB.applyUpdate(initialUpdate, 'sync-initial');

    let editorValA = initialText;
    let editorValB = initialText;

    const setEditorValA = vi.fn((val: string) => {
      editorValA = val;
    });

    const setEditorValB = vi.fn((val: string) => {
      editorValB = val;
    });

    // Wire bindings
    const bindingA = new CrdtMonacoBinding(peerA, 'Main.java');
    const bindingB = new CrdtMonacoBinding(peerB, 'Main.java');

    bindingA.bind(() => editorValA, setEditorValA);
    bindingB.bind(() => editorValB, setEditorValB);

    let pendingUpdatesForB: Uint8Array[] = [];
    let pendingUpdatesForA: Uint8Array[] = [];

    peerA.onUpdate((update, origin) => {
      if (origin === 'monaco-local') {
        pendingUpdatesForB.push(update);
      }
    });

    peerB.onUpdate((update, origin) => {
      if (origin === 'monaco-local') {
        pendingUpdatesForA.push(update);
      }
    });

    // SIMULTANEOUS EDITING AT THE EXACT SAME TIME:
    // User A types 'int a = 10;' at line 2
    const nextContentA = 'public class Main {\n  int a = 10;\n}\n';
    // User B types 'int b = 20;' at line 2
    const nextContentB = 'public class Main {\n  int b = 20;\n}\n';

    // User A and User B both submit changes before receiving each other's frames
    bindingA.handleEditorChange(nextContentA);
    bindingB.handleEditorChange(nextContentB);

    // Cross-apply network updates
    for (const update of pendingUpdatesForB) {
      peerB.applyUpdate(update, 'remote-peerA');
    }
    for (const update of pendingUpdatesForA) {
      peerA.applyUpdate(update, 'remote-peerB');
    }

    // Both editors must receive converged content containing both insertions
    const finalTextA = editorValA;
    const finalTextB = editorValB;

    expect(finalTextA).toBe(finalTextB);
    expect(finalTextA).toContain('int a = 10;');
    expect(finalTextA).toContain('int b = 20;');
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
  });
});
