import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollaborationManager } from './CollaborationManager';
import { AutoRejoinManager } from './AutoRejoinManager';
import { SessionStatusStore } from './SessionStatusStore';
import { Transport, PeerStateCallback, FrameCallback } from '../transport/Transport';
import { SecurityManager } from '../security/SecurityManager';
import { Frame } from '@decentraide/shared';

class FakeTransport implements Transport {
  public id: 'webrtc' | 'lan' | 'bluetooth' = 'webrtc';
  public type: 'webrtc' | 'lan' | 'bluetooth' | 'local' = 'webrtc';
  public onFrameCb?: FrameCallback;
  public onPeerStateCb?: PeerStateCallback;
  public sentFrames: Array<{ peerId: string; bytes: Uint8Array }> = [];
  public broadcastFrames: Uint8Array[] = [];

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  onFrame(callback: FrameCallback): void {
    this.onFrameCb = callback;
  }

  onPeerState(callback: PeerStateCallback): void {
    this.onPeerStateCb = callback;
  }

  async send(peerId: string, data: Uint8Array): Promise<void> {
    this.sentFrames.push({ peerId, bytes: data });
  }

  async broadcast(data: Uint8Array): Promise<void> {
    this.broadcastFrames.push(data);
  }

  getStats() {
    return { bytesIn: 0, bytesOut: 0, rttMs: 10 };
  }

  simulateIncomingFrame(peerId: string, data: Uint8Array): void {
    this.onFrameCb?.(peerId, data);
  }

  simulatePeerState(peerId: string, state: 'connected' | 'connecting' | 'offline'): void {
    this.onPeerStateCb?.(peerId, state);
  }
}

describe('Session Resume & Auto-Rejoin Pipeline', () => {
  let cm: CollaborationManager;
  let fakeTransport: FakeTransport;
  let roomId: string;

  beforeEach(async () => {
    cm = CollaborationManager.getInstance();
    roomId = 'test-room-resume-' + Math.random().toString(36).substring(2, 7);
    await cm.startSession(roomId, { isHost: true });

    fakeTransport = new FakeTransport();
    cm.getTransportManager().registerTransport(fakeTransport);
  });

  it('persists session metadata and transitions phase on network loss and auto-rejoin', async () => {
    const remotePeerId = 'peer-disconnect-1';
    fakeTransport.simulatePeerState(remotePeerId, 'connected');

    expect(SessionStatusStore.getInstance().get().phase).toBe('connected');

    // Edit locally to trigger active session persistence
    cm.getCrdtEngine().getText('src/main/java/Main.java').insert(0, '// Local edit before loss\n');

    // Simulate network loss (all peers go offline)
    fakeTransport.simulatePeerState(remotePeerId, 'offline');

    expect(SessionStatusStore.getInstance().get().phase).toBe('disconnected');

    // Trigger auto-rejoin attempt
    const autoRejoin = AutoRejoinManager.getInstance();
    const rejoinSpy = vi.fn().mockResolvedValue(true);
    autoRejoin.setTriggerRejoinHandler(rejoinSpy);

    autoRejoin.handleNetworkRecovery();
    await new Promise((res) => setTimeout(res, 50));

    expect(rejoinSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId,
        isHost: true,
      })
    );
  });

  it('performs exponential backoff on repeated rejoin failures', async () => {
    const autoRejoin = new AutoRejoinManager({ maxRetries: 3, initialBackoffMs: 10 });
    const failingHandler = vi.fn().mockRejectedValue(new Error('Signaling server down'));
    autoRejoin.setTriggerRejoinHandler(failingHandler);

    autoRejoin.scheduleRejoin(0);
    await new Promise((res) => setTimeout(res, 20));

    expect(failingHandler).toHaveBeenCalled();
    expect(autoRejoin.getRetryCount()).toBeGreaterThan(0);
  });

  it('synchronizes offline edits upon successful session resume and reconnect', async () => {
    const remotePeerId = 'peer-resume-2';
    const remoteIdentity = SecurityManager.generateIdentity();
    cm.getSecurityPipeline().addMember(remotePeerId, remoteIdentity.publicKeyPem, 'Developer');

    fakeTransport.simulatePeerState(remotePeerId, 'connected');

    // Host offline edit
    cm.getCrdtEngine().getText('src/main/java/Main.java').insert(0, '// Host offline edit\n');

    // Simulate reconnect
    fakeTransport.sentFrames = [];
    fakeTransport.simulatePeerState(remotePeerId, 'connected');

    // Peer announces hash matching host hash
    const hostHash = cm.getCrdtEngine().computeWorkspaceHash();
    fakeTransport.simulateIncomingFrame(
      remotePeerId,
      new TextEncoder().encode(JSON.stringify({ type: 'HASH_ANNOUNCE', hash: hostHash, from: remotePeerId }))
    );

    expect(SessionStatusStore.getInstance().get().converged).toBe(true);
    expect(SessionStatusStore.getInstance().get().localHash).toBe(hostHash);
  });
});
