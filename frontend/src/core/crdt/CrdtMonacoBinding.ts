import * as Y from 'yjs';
import { CrdtEngine } from './CrdtEngine';

export class CrdtMonacoBinding {
  private engine: CrdtEngine;
  private path: string;
  private yText: Y.Text;
  private unsubscribe: (() => void) | null = null;

  constructor(engine: CrdtEngine, path: string) {
    this.engine = engine;
    this.path = path;
    this.yText = engine.getText(path);
  }

  bind(
    getValue: () => string,
    setValue: (val: string) => void,
    onYTextChange?: (newVal: string) => void
  ): () => void {
    // Initial sync
    const currentYVal = this.yText.toString();
    if (currentYVal) {
      setValue(currentYVal);
    } else {
      const editorVal = getValue();
      if (editorVal) {
        this.yText.insert(0, editorVal);
      }
    }

    // Yjs -> Editor
    const observer = (event: Y.YTextEvent) => {
      if (event.transaction.origin === 'monaco-local') return;
      const updatedValue = this.yText.toString();
      setValue(updatedValue);
      onYTextChange?.(updatedValue);
    };

    this.yText.observe(observer);

    this.unsubscribe = () => {
      this.yText.unobserve(observer);
    };

    return this.unsubscribe;
  }

  // Local Editor -> Yjs
  handleEditorChange(newContent: string): void {
    const currentYContent = this.yText.toString();
    if (newContent === currentYContent) return;

    this.engine.getDoc().transact(() => {
      this.yText.delete(0, this.yText.length);
      this.yText.insert(0, newContent);
    }, 'monaco-local');
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
