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

  it('preserves user editor selection/cursor position on remote updates', () => {
    const engineA = new YjsCrdtEngine();
    const engineB = new YjsCrdtEngine();

    const bindingB = new CrdtMonacoBinding(engineB, 'CursorTest.java');
    let editorValB = 'line 1\nline 2\nline 3';
    const setEditorValB = vi.fn((val: string) => {
      editorValB = val;
    });

    const fakeSelections = [{ startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 3 }];
    const fakePosition = { lineNumber: 2, column: 3 };

    const fakeEditor = {
      getSelections: vi.fn(() => fakeSelections),
      getPosition: vi.fn(() => fakePosition),
      setSelections: vi.fn(),
      setPosition: vi.fn(),
    };

    bindingB.setEditorInstance(fakeEditor);
    bindingB.bind(() => editorValB, setEditorValB);

    // Initial state
    engineA.getText('CursorTest.java').insert(0, 'line 1\nline 2\nline 3');
    engineB.applyUpdate(engineA.encodeStateAsUpdate());

    // Remote edit on A at line 1
    engineA.getText('CursorTest.java').insert(0, '// Header comment\n');
    engineB.applyUpdate(engineA.encodeStateAsUpdate());

    expect(fakeEditor.getSelections).toHaveBeenCalled();
  });
});
