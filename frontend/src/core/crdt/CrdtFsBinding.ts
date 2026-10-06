import { CrdtEngine } from './CrdtEngine';

export class CrdtFsBinding {
  private engine: CrdtEngine;

  constructor(engine: CrdtEngine) {
    this.engine = engine;
  }

  handleFileCreated(path: string, initialContent: string = ''): void {
    const yText = this.engine.getText(path);
    if (yText.length === 0 && initialContent) {
      yText.insert(0, initialContent);
    }
    const meta = this.engine.getMetadataMap();
    meta.set(`file:${path}`, { exists: true, createdAt: Date.now() });
  }

  handleFileDeleted(path: string): void {
    const yText = this.engine.getText(path);
    yText.delete(0, yText.length);
    const meta = this.engine.getMetadataMap();
    meta.set(`file:${path}`, { exists: false, deletedAt: Date.now() });
  }

  handleFileRenamed(oldPath: string, newPath: string): void {
    const oldText = this.engine.getText(oldPath).toString();
    this.handleFileDeleted(oldPath);
    this.handleFileCreated(newPath, oldText);
  }
}
