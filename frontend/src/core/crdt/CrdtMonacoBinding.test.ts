import { describe, it, expect, vi } from 'vitest';
import { YjsCrdtEngine } from './CrdtEngine';
import { CrdtMonacoBinding } from './CrdtMonacoBinding';

describe('CrdtMonacoBinding', () => {
  it('synchronizes local editor changes into Yjs Text without echo loop', () => {
    const engine = new YjsCrdtEngine();
    const binding = new CrdtMonacoBinding(engine, 'Test.java');

    let editorVal = 'public class Test {}';
    const setEditorVal = vi.fn((val: string) => {
      editorVal = val;
    });

    binding.bind(() => editorVal, setEditorVal);

    expect(engine.getText('Test.java').toString()).toBe('public class Test {}');

    // Simulate local editor change
    binding.handleEditorChange('public class Test { int x = 5; }');

    expect(engine.getText('Test.java').toString()).toBe('public class Test { int x = 5; }');
  });

  it('synchronizes remote Yjs updates into editor', () => {
    const engineA = new YjsCrdtEngine();
    const engineB = new YjsCrdtEngine();

    const bindingB = new CrdtMonacoBinding(engineB, 'Test.java');
    let editorValB = '';
    const setEditorValB = vi.fn((val: string) => {
      editorValB = val;
    });

    bindingB.bind(() => editorValB, setEditorValB);

    // Edit on A
    engineA.getText('Test.java').insert(0, 'Remote edit from A');

    // Sync A -> B
    const update = engineA.encodeStateAsUpdate();
    engineB.applyUpdate(update);

    expect(editorValB).toBe('Remote edit from A');
    expect(setEditorValB).toHaveBeenCalledWith('Remote edit from A');
  });
});
