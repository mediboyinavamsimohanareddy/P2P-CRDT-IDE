import * as Y from 'yjs';

// Simple JS FNV-1a non-cryptographic hash for browser environment compatibility
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

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
    return fnv1aHash(content);
  }

  computeWorkspaceHash(): string {
    const shareKeys = Array.from(this.doc.share.keys()).sort();
    const hashes: string[] = [];
    
    for (const key of shareKeys) {
      if (key === 'metadata') continue;
      const fileContent = this.doc.getText(key).toString();
      const fileHash = fnv1aHash(fileContent);
      hashes.push(`${key}:${fileHash}`);
    }

    const canonicalData = hashes.join('\n');
    return fnv1aHash(canonicalData);
  }

  reset(): void {
    this.doc.destroy();
    this.doc = new Y.Doc();
  }

  destroy(): void {
    this.doc.destroy();
  }
}
