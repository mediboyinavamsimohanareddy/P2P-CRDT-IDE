import { describe, it, expect, beforeEach } from 'vitest';
import { YjsCrdtEngine } from './CrdtEngine';
import * as Y from 'yjs';

describe('YjsCrdtEngine', () => {
  let engineA: YjsCrdtEngine;
  let engineB: YjsCrdtEngine;
  let engineC: YjsCrdtEngine;

  beforeEach(() => {
    engineA = new YjsCrdtEngine();
    engineB = new YjsCrdtEngine();
    engineC = new YjsCrdtEngine();
  });

  it('inserts and reads text cleanly', () => {
    const textA = engineA.getText('LoginService.java');
    textA.insert(0, 'public class LoginService {}');
    expect(textA.toString()).toBe('public class LoginService {}');
  });

  it('syncs updates between engineA and engineB', () => {
    const textA = engineA.getText('LoginService.java');
    textA.insert(0, 'Hello World');

    const updateFromA = engineA.encodeStateAsUpdate();
    engineB.applyUpdate(updateFromA);

    expect(engineB.getText('LoginService.java').toString()).toBe('Hello World');
  });

  it('converges 3 replicas with concurrent edits to identical workspace state hash', () => {
    const textA = engineA.getText('LoginService.java');
    const textB = engineB.getText('LoginService.java');
    const textC = engineC.getText('LoginService.java');

    // Concurrent edits
    textA.insert(0, 'A: start\n');
    textB.insert(0, 'B: middle\n');
    textC.insert(0, 'C: end\n');

    // Exchange state between A, B, C
    const updateA = engineA.encodeStateAsUpdate();
    const updateB = engineB.encodeStateAsUpdate();
    const updateC = engineC.encodeStateAsUpdate();

    engineA.applyUpdate(updateB);
    engineA.applyUpdate(updateC);

    engineB.applyUpdate(updateA);
    engineB.applyUpdate(updateC);

    engineC.applyUpdate(updateA);
    engineC.applyUpdate(updateB);

    // Verify all 3 texts are identical
    const contentA = textA.toString();
    const contentB = textB.toString();
    const contentC = textC.toString();

    expect(contentA).toBe(contentB);
    expect(contentB).toBe(contentC);

    // Verify state hashes match
    const hashA = engineA.computeWorkspaceHash();
    const hashB = engineB.computeWorkspaceHash();
    const hashC = engineC.computeWorkspaceHash();

    expect(hashA).toBe(hashB);
    expect(hashB).toBe(hashC);
  });
});
