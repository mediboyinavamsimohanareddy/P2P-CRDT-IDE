import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalPersistenceManager } from './LocalPersistenceManager';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LocalPersistenceManager', () => {
  let testDir: string;
  let manager: LocalPersistenceManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'decentraide-test-'));
    manager = new LocalPersistenceManager(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {}
  });

  it('saves and reads workspace metadata in .decentraide', async () => {
    const meta = {
      projectName: 'test-project',
      lastOpened: Date.now(),
      openTabs: ['src/App.java'],
    };

    const saved = await manager.saveMetadata(meta);
    expect(saved).toBe(true);

    const readMeta = await manager.getMetadata();
    expect(readMeta).not.toBeNull();
    expect(readMeta?.projectName).toBe('test-project');
    expect(readMeta?.openTabs).toEqual(['src/App.java']);
  });

  it('saves and restores CRDT binary snapshot', async () => {
    const binaryData = new Uint8Array([1, 2, 3, 4, 5, 255]);
    const saved = await manager.saveCrdtSnapshot(binaryData);
    expect(saved).toBe(true);

    const restored = await manager.getCrdtSnapshot();
    expect(restored).not.toBeNull();
    expect(Array.from(restored!)).toEqual([1, 2, 3, 4, 5, 255]);
  });
});
