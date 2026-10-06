import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsCrdtEngine } from './CrdtEngine';
import { OpLogManager } from './OpLogManager';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('OpLogManager', () => {
  let testDir: string;
  let engine: YjsCrdtEngine;
  let persistence: LocalPersistenceManager;
  let opLogManager: OpLogManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'decentraide-oplog-test-'));
    engine = new YjsCrdtEngine();
    persistence = new LocalPersistenceManager(testDir);
    opLogManager = new OpLogManager(engine, persistence);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {}
  });

  it('enqueues local ops and tracks pending count', () => {
    const update = engine.encodeStateAsUpdate();
    opLogManager.enqueueLocalUpdate(update);

    expect(opLogManager.getPendingCount()).toBe(1);
  });

  it('flushes queue when network is ready', () => {
    const update = engine.encodeStateAsUpdate();
    opLogManager.enqueueLocalUpdate(update);

    opLogManager.flushQueue(() => true); // successfully sent
    expect(opLogManager.getPendingCount()).toBe(0);
  });
});
