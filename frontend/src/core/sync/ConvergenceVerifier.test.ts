import { describe, it, expect, beforeEach } from 'vitest';
import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { ConvergenceVerifier } from './ConvergenceVerifier';

describe('ConvergenceVerifier', () => {
  let engineA: YjsCrdtEngine;
  let engineB: YjsCrdtEngine;
  let verifierA: ConvergenceVerifier;

  beforeEach(() => {
    engineA = new YjsCrdtEngine();
    engineB = new YjsCrdtEngine();
    verifierA = new ConvergenceVerifier(engineA, 'Laptop-A');
  });

  it('computes deterministic real SHA-256 hash and verifies convergence when hashes match', () => {
    engineA.getText('LoginService.java').insert(0, 'public class LoginService {}');
    engineB.getText('LoginService.java').insert(0, 'public class LoginService {}');

    const hashB = engineB.computeWorkspaceHash();
    verifierA.recordRemoteHash('Laptop-B', hashB);

    expect(verifierA.isConverged()).toBe(true);
    expect(verifierA.getLocalHash()).toBe(hashB);
  });

  it('detects state vector divergence when document contents differ', () => {
    engineA.getText('LoginService.java').insert(0, 'public class LoginService { int a = 1; }');
    engineB.getText('LoginService.java').insert(0, 'public class LoginService { int b = 2; }');

    const hashB = engineB.computeWorkspaceHash();
    verifierA.recordRemoteHash('Laptop-B', hashB);

    expect(verifierA.isConverged()).toBe(false);
  });
});
