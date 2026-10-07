import * as Y from 'yjs';
import { CrdtEngine } from './CrdtEngine';

/** Apply a character-level diff instead of wiping the whole Y.Text. */
function applyTextDiff(yText: Y.Text, next: string): void {
  const prev = yText.toString();
  if (prev === next) return;

  let start = 0;
  const minLen = Math.min(prev.length, next.length);
  while (start < minLen && prev[start] === next[start]) {
    start += 1;
  }

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1;
    endNext -= 1;
  }

  const deleteLen = endPrev - start;
  const insertText = next.slice(start, endNext);

  if (deleteLen > 0) {
    yText.delete(start, deleteLen);
  }
  if (insertText.length > 0) {
    yText.insert(start, insertText);
  }
}

export interface EditorSelectionState {
  selection?: any;
  position?: any;
}

export class CrdtMonacoBinding {
  private engine: CrdtEngine;
  private path: string;
  private yText: Y.Text;
  private unsubscribe: (() => void) | null = null;
  private editorInstance: any = null;

  constructor(engine: CrdtEngine, path: string) {
    this.engine = engine;
    this.path = path;
    this.yText = engine.getText(path);
  }

  setEditorInstance(editor: any): void {
    this.editorInstance = editor;
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

      const editor = this.editorInstance;
      let savedSelections: any[] | null = null;
      let savedPosition: any = null;

      if (editor && typeof editor.getSelections === 'function') {
        try {
          savedSelections = editor.getSelections();
          savedPosition = editor.getPosition();
        } catch {
          // ignore
        }
      }

      const updatedValue = this.yText.toString();
      setValue(updatedValue);
      onYTextChange?.(updatedValue);

      if (editor) {
        setTimeout(() => {
          try {
            if (savedSelections && savedSelections.length > 0 && typeof editor.setSelections === 'function') {
              editor.setSelections(savedSelections);
            } else if (savedPosition && typeof editor.setPosition === 'function') {
              editor.setPosition(savedPosition);
            }
          } catch {
            // ignore
          }
        }, 0);
      }
    };

    this.yText.observe(observer);

    this.unsubscribe = () => {
      this.yText.unobserve(observer);
    };

    return this.unsubscribe;
  }

  // Local Editor -> Yjs (incremental character ops)
  handleEditorChange(newContent: string): void {
    const currentYContent = this.yText.toString();
    if (newContent === currentYContent) return;

    this.engine.getDoc().transact(() => {
      applyTextDiff(this.yText, newContent);
    }, 'monaco-local');
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
