import * as Y from 'yjs';
import { createHash } from 'crypto';

export interface CrdtEngine {
  getDoc(): Y.Doc;
  getText(path: string): Y.Text;
  getMetadataMap(): Y.Map<unknown>;
  applyUpdate(update: Uint8Array, origin?: string): void;
  onUpdate(callback: (update: Uint8Array, origin: string) => void): () => void;
  encodeStateAsUpdate(targetStateVector?: Uint8Array): Uint8Array;
  encodeStateVector(): Uint8Array;
  computeFileHash(path: string): string;
  computeWorkspaceHash(): string;
  destroy(): void;
}

export class YjsCrdtEngine implements CrdtEngine {
  private doc: Y.Doc;

  constructor(doc?: Y.Doc) {
    this.doc = doc || new Y.Doc();
  }

  getDoc(): Y.Doc {
    return this.doc;
  }

  getText(path: string): Y.Text {
    return this.doc.getText(path);
  }

  getMetadataMap(): Y.Map<unknown> {
    return this.doc.getMap('metadata');
  }

  applyUpdate(update: Uint8Array, origin?: string): void {
    Y.applyUpdate(this.doc, update, origin);
  }

  onUpdate(callback: (update: Uint8Array, origin: string) => void): () => void {
    const handler = (update: Uint8Array, origin: string) => {
      callback(update, origin);
    };
    this.doc.on('update', handler);
    return () => {
      this.doc.off('update', handler);
    };
  }

  encodeStateAsUpdate(targetStateVector?: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, targetStateVector);
  }

  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  computeFileHash(path: string): string {
    const content = this.getText(path).toString();
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  computeWorkspaceHash(): string {
    const shareKeys = Array.from(this.doc.share.keys()).sort();
    const hashes: string[] = [];
    
    for (const key of shareKeys) {
      if (key === 'metadata') continue;
      const fileContent = this.doc.getText(key).toString();
      const fileHash = createHash('sha256').update(fileContent, 'utf-8').digest('hex');
      hashes.push(`${key}:${fileHash}`);
    }

    const canonicalData = hashes.join('\n');
    return createHash('sha256').update(canonicalData, 'utf-8').digest('hex');
  }

  destroy(): void {
    this.doc.destroy();
  }
}
