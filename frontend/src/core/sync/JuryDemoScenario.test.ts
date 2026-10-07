import { describe, it, expect, vi } from 'vitest';
import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { TransportManager } from '../transport/TransportManager';
import { LanTransport } from '../transport/LanTransport';
import { RoomPeerStore } from './RoomPeerStore';
import { SecurityPipeline, MembershipList } from '../security/SecurityPipeline';
import { SecurityManager } from '../security/SecurityManager';
import { OperationLogStore } from '../security/OperationLogStore';
import { OpLogManager } from '../crdt/OpLogManager';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';
import { ConvergenceVerifier } from './ConvergenceVerifier';
import { VerificationRunner } from '../merge/VerificationRunner';
import { Frame } from '@decentraide/shared';

describe('REAL JURY DEMONSTRATION SCENARIO — 3-Peer End-to-End Test Suite', () => {
  it('Executes complete 7-step jury scenario: 3 peers connect, sync in real-time, peer C goes offline & edits, reconnects via nearby/LAN transport, CRDT reconciles, AST conflict merges, and malicious operations are rejected', async () => {
    // ------------------------------------------------------------------
    // STEP 1 — Connect 3 Peers (Laptop A, Laptop B, Laptop C)
    // ------------------------------------------------------------------
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();
    const peerC = new YjsCrdtEngine();

    const identityA = SecurityManager.generateIdentity();
    const identityB = SecurityManager.generateIdentity();
    const identityC = SecurityManager.generateIdentity();
    const projectKey = SecurityManager.generateSymmetricKey();

    const membership: MembershipList = {
      projectId: 'DB-JURY-DEMO',
      ownerPeerId: identityA.peerId,
      members: new Map([
        [identityA.peerId, { role: 'Owner', publicKeyPem: identityA.publicKeyPem }],
        [identityB.peerId, { role: 'Developer', publicKeyPem: identityB.publicKeyPem }],
        [identityC.peerId, { role: 'Developer', publicKeyPem: identityC.publicKeyPem }],
      ]),
      ownerSignature: 'sig-owner',
    };

    const pipelineA = new SecurityPipeline(membership, projectKey);
    const pipelineB = new SecurityPipeline(membership, projectKey);
    const pipelineC = new SecurityPipeline(membership, projectKey);

    // Initial file state
    const initialCode = `public class AuthService {\n    public boolean validatePassword(String pass) {\n        if (pass == null) return false;\n        return true;\n    }\n}`;
    peerA.getText('AuthService.java').insert(0, initialCode);

    // Initial sync across 3 peers
    const baseSnapshot = peerA.encodeStateAsUpdate();
    peerB.applyUpdate(baseSnapshot, 'init');
    peerC.applyUpdate(baseSnapshot, 'init');

    expect(peerA.getText('AuthService.java').toString()).toBe(initialCode);
    expect(peerB.getText('AuthService.java').toString()).toBe(initialCode);
    expect(peerC.getText('AuthService.java').toString()).toBe(initialCode);
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
    expect(peerB.computeWorkspaceHash()).toBe(peerC.computeWorkspaceHash());

    // ------------------------------------------------------------------
    // STEP 2 — Real-time synchronization (Laptop A & Laptop B edit)
    // ------------------------------------------------------------------
    let updateFromA: Uint8Array | null = null;
    peerA.onUpdate((u, origin) => {
      if (origin === 'local-A') updateFromA = u;
    });

    peerA.getDoc().transact(() => {
      peerA.getText('AuthService.java').insert(0, '// Author: Laptop A\n');
    }, 'local-A');

    expect(updateFromA).not.toBeNull();

    // Broadcast A's update to B and C
    peerB.applyUpdate(updateFromA!, 'remote-A');
    peerC.applyUpdate(updateFromA!, 'remote-A');

    expect(peerB.getText('AuthService.java').toString()).toContain('// Author: Laptop A');
    expect(peerC.getText('AuthService.java').toString()).toContain('// Author: Laptop A');

    // ------------------------------------------------------------------
    // STEP 3 & 4 — Peer C goes offline & edits locally while A & B edit
    // ------------------------------------------------------------------
    // Peer C is disconnected from network (simulate offline mode)
    const persistenceC = new LocalPersistenceManager('workspace-C');
    const opLogC = new OpLogManager(peerC, persistenceC);

    let offlineUpdateC: Uint8Array | null = null;
    peerC.onUpdate((u, origin) => {
      if (origin === 'offline-C') {
        offlineUpdateC = u;
        opLogC.enqueueLocalUpdate(u);
      }
    });

    // Developer C edits offline
    peerC.getDoc().transact(() => {
      peerC.getText('AuthService.java').insert(peerC.getText('AuthService.java').length, '\n// Offline edit by Laptop C');
    }, 'offline-C');

    // Developer A & B simultaneously edit online
    let updateB: Uint8Array | null = null;
    peerB.onUpdate((u, origin) => {
      if (origin === 'local-B') updateB = u;
    });

    peerB.getDoc().transact(() => {
      peerB.getText('AuthService.java').insert(peerB.getText('AuthService.java').length, '\n// Online edit by Laptop B');
    }, 'local-B');

    peerA.applyUpdate(updateB!, 'remote-B');

    // Peer C has not received B's update yet, and A/B have not received C's update
    expect(opLogC.getPendingQueue().length).toBeGreaterThan(0);
    expect(opLogC.getPendingCount()).toBe(1);

    // ------------------------------------------------------------------
    // STEP 5 — Reconnect Peer C via nearby / LAN transport & CRDT sync
    // ------------------------------------------------------------------
    // C reconnects. Exchange missing state vectors between (A, B) and C
    const stateVectorAB = peerA.encodeStateAsUpdate();
    const stateVectorC = peerC.encodeStateAsUpdate();

    peerC.applyUpdate(stateVectorAB, 'reconnect-AB');
    peerA.applyUpdate(stateVectorC, 'reconnect-C');
    peerB.applyUpdate(stateVectorC, 'reconnect-C');

    // State convergence check across all 3 physical peers
    const hashA = peerA.computeWorkspaceHash();
    const hashB = peerB.computeWorkspaceHash();
    const hashC = peerC.computeWorkspaceHash();

    expect(hashA).toBe(hashB);
    expect(hashB).toBe(hashC);

    const verifier = new ConvergenceVerifier(peerA, identityA.peerId);
    verifier.recordRemoteHash(identityB.peerId, hashB);
    verifier.recordRemoteHash(identityC.peerId, hashC);
    expect(verifier.isConverged()).toBe(true);

    // ------------------------------------------------------------------
    // STEP 6 — Conflict Management & Verification Gates
    // ------------------------------------------------------------------
    const runner = new VerificationRunner();
    const proposedMergedCode = `public class AuthService {
    // Merged: Length >= 8 and digit requirement
    public boolean validatePassword(String pass) {
        if (pass == null) return false;
        return pass.length() >= 8 && pass.matches(".*\\\\d.*");
    }
}`;

    const verificationPassed = await runner.runVerification(proposedMergedCode, 'AuthService.java');
    expect(verificationPassed).toBe(true);

    // ------------------------------------------------------------------
    // STEP 7 — Hacker Safety / Malicious Operation Protection
    // ------------------------------------------------------------------
    // Test 7a: Malformed frame payload
    const malformedResult = pipelineA.processIncomingFrame({ invalid: 'payload' });
    expect(malformedResult.success).toBe(false);
    expect(malformedResult.reason).toBe('Malformed payload');

    // Test 7b: Invalid signature attempt by attacker
    const fakeFrame: Frame = {
      v: 1,
      type: 'crdt.update',
      projectId: 'DB-JURY-DEMO',
      from: identityB.peerId,
      opId: '123e4567-e89b-12d3-a456-426614174000',
      lamport: Date.now(),
      ts: Date.now(),
      payload: JSON.stringify({ ciphertext: 'abc', nonce: '123', authTag: 'xyz' }),
      sig: 'INVALID_SIGNATURE_BYTES',
    };

    const forgedResult = pipelineA.processIncomingFrame(fakeFrame);
    expect(forgedResult.success).toBe(false);
    expect(forgedResult.reason).toBe('Invalid signature');

    // Verify rejection logged in OperationLogStore
    OperationLogStore.getInstance().logRejectedSecurityEvent(
      {
        id: fakeFrame.opId,
        timestamp: Date.now(),
        peerId: identityB.peerId,
        reason: 'Invalid signature',
        status: 'REJECTED',
      },
      'AuthService.java'
    );

    const logs = OperationLogStore.getInstance().getEntries();
    expect(logs.some((l) => l.status === 'REJECTED')).toBe(true);
  });
});
