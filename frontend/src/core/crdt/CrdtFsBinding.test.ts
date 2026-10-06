import { describe, it, expect, beforeEach } from 'vitest';
import { YjsCrdtEngine } from './CrdtEngine';
import { CrdtFsBinding } from './CrdtFsBinding';

describe('CrdtFsBinding', () => {
  let engine: YjsCrdtEngine;
  let fsBinding: CrdtFsBinding;

  beforeEach(() => {
    engine = new YjsCrdtEngine();
    fsBinding = new CrdtFsBinding(engine);
  });

  it('tracks file creation in CRDT text and metadata map', () => {
    fsBinding.handleFileCreated('App.java', 'public class App {}');

    expect(engine.getText('App.java').toString()).toBe('public class App {}');
    const meta = engine.getMetadataMap().get('file:App.java') as { exists: boolean };
    expect(meta.exists).toBe(true);
  });

  it('tracks file rename by copying CRDT content and deleting old path', () => {
    fsBinding.handleFileCreated('Old.java', 'content');
    fsBinding.handleFileRenamed('Old.java', 'New.java');

    expect(engine.getText('Old.java').toString()).toBe('');
    expect(engine.getText('New.java').toString()).toBe('content');
  });
});
