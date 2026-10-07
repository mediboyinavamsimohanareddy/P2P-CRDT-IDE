import { describe, it, expect, beforeEach } from 'vitest';
import { CollaborationManager } from './CollaborationManager';
import { RoomPeerStore } from './RoomPeerStore';
import { TransportManager } from '../transport/TransportManager';
import { Transport, TransportStats, TransportType } from '../transport/Transport';
import { CrdtMonacoBinding } from '../crdt/CrdtMonacoBinding';
import { SecurityManager } from '../security/SecurityManager';

class MemoryTransport implements Transport {
  id: TransportType = 'webrtc';
  mate: MemoryTransport | null = null;
  private frameCb?: (peerId: string, frame: Uint8Array) => void;
  private peerStateCb?: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void;
  open = false;
  sent: Uint8Array[] = [];

  constructor(
    private localPeerId: string,
    private remotePeerId: string
  ) {}

  async start(): Promise<void> {}
  async stop(): Promise<void> {
    this.disconnect(this.remotePeerId);
  }
  async connect(_peerId: string): Promise<void> {
    this.open = true;
    this.peerStateCb?.(this.remotePeerId, 'connected');
  }
  disconnect(peerId: string): void {
    this.open = false;
    this.peerStateCb?.(peerId, 'offline');
  }
  async send(_peerId: string, frame: Uint8Array): Promise<void> {
    if (!this.open || !this.mate) {
      throw new Error('WebRTC DataChannel not open');
    }
    this.sent.push(frame);
    this.mate.frameCb?.(this.localPeerId, frame);
  }
  async broadcast(frame: Uint8Array): Promise<void> {
    await this.send(this.remotePeerId, frame);
  }
  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void {
    this.frameCb = cb;
  }
  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void {
    this.peerStateCb = cb;
  }
  stats(): TransportStats {
    return { rttMs: 1, bytesIn: 0, bytesOut: 0 };
  }
}

function pairTransports(idA: string, idB: string): { a: MemoryTransport; b: MemoryTransport } {
  const a = new MemoryTransport(idA, idB);
  const b = new MemoryTransport(idB, idA);
  a.mate = b;
  b.mate = a;
  return { a, b };
}

async function connectPair(a: MemoryTransport, b: MemoryTransport): Promise<void> {
  await a.connect(b['remotePeerId']);
  await b.connect(a['remotePeerId']);
  await Promise.resolve();
  await Promise.resolve();
}

function disconnectPair(a: MemoryTransport, b: MemoryTransport): void {
  // Notify each side that its remote peer went offline (same id connect() announced).
  a.disconnect(a['remotePeerId']);
  b.disconnect(b['remotePeerId']);
}

describe('Yjs DataChannel synchronization', () => {
  let host: CollaborationManager;
  let joiner: CollaborationManager;
  let hostDc: MemoryTransport;
  let joinerDc: MemoryTransport;

  beforeEach(async () => {
    host = new CollaborationManager({
      peerStore: new RoomPeerStore(),
      transportManager: new TransportManager('SYNC-ROOM'),
    });
    joiner = new CollaborationManager({
      peerStore: new RoomPeerStore(),
      transportManager: new TransportManager('SYNC-ROOM'),
    });
    const pair = pairTransports(host.getIdentity().peerId, joiner.getIdentity().peerId);
    hostDc = pair.a;
    joinerDc = pair.b;
    host.registerSyncTransport(hostDc);
    joiner.registerSyncTransport(joinerDc);
    await host.startSession('SYNC-ROOM', { isHost: true, skipDefaultTransports: true });
    await joiner.startSession('SYNC-ROOM', { isHost: false, skipDefaultTransports: true });
  });

  it('late joiner receives existing project state via syncStep1/step2', async () => {
    host.getCrdtEngine().getText('Main.java').delete(0, host.getCrdtEngine().getText('Main.java').length);
    joiner.getCrdtEngine().getText('Main.java').delete(0, joiner.getCrdtEngine().getText('Main.java').length);
    host.getCrdtEngine().getText('Main.java').insert(0, 'class Host {}');

    await connectPair(hostDc, joinerDc);

    expect(joiner.getCrdtEngine().getText('Main.java').toString()).toBe('class Host {}');
    expect(host.getCrdtEngine().computeWorkspaceHash()).toBe(joiner.getCrdtEngine().computeWorkspaceHash());
    expect(host.getVerifier().hashesMatchPeers()).toBe(true);
  });

  it('verified merge broadcast travels through Yjs and DataChannel', async () => {
    host.getCrdtEngine().getText('Main.java').delete(0, host.getCrdtEngine().getText('Main.java').length);
    joiner.getCrdtEngine().getText('Main.java').delete(0, joiner.getCrdtEngine().getText('Main.java').length);
    await connectPair(hostDc, joinerDc);

    host.getCrdtEngine().getText('Main.java').insert(0, 'A');
    await host.broadcastVerifiedMerge();
    await Promise.resolve();
    expect(joiner.getCrdtEngine().getText('Main.java').toString()).toBe('A');

    joiner.getCrdtEngine().getText('Main.java').insert(1, 'B');
    await joiner.broadcastVerifiedMerge();
    await Promise.resolve();
    expect(host.getCrdtEngine().getText('Main.java').toString()).toBe('AB');
    expect(host.getCrdtEngine().computeWorkspaceHash()).toBe(joiner.getCrdtEngine().computeWorkspaceHash());
  });

  it('remote updates do not echo back as new local Yjs sends', async () => {
    host.getCrdtEngine().getText('Main.java').delete(0, host.getCrdtEngine().getText('Main.java').length);
    joiner.getCrdtEngine().getText('Main.java').delete(0, joiner.getCrdtEngine().getText('Main.java').length);
    await connectPair(hostDc, joinerDc);
    hostDc.sent = [];
    joinerDc.sent = [];

    const outboundBefore = hostDc.sent.length;
    joiner.getCrdtEngine().getText('Main.java').insert(0, 'from-joiner');
    await joiner.broadcastVerifiedMerge();
    await Promise.resolve();

    const hostAfterRemote = hostDc.sent.filter((bytes) => {
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      return obj.type === 'crdt.update';
    });
    expect(host.getCrdtEngine().getText('Main.java').toString()).toBe('from-joiner');
    expect(hostAfterRemote.length).toBe(outboundBefore);
  });

  it('offline edits converge on reconnect via state-vector diff, not full replay', async () => {
    await connectPair(hostDc, joinerDc);
    host.getCrdtEngine().getText('Main.java').insert(0, 'base');
    await Promise.resolve();

    disconnectPair(hostDc, joinerDc);

    host.getCrdtEngine().getText('Main.java').insert(4, '-A');
    joiner.getCrdtEngine().getText('Main.java').insert(4, '-B');
    expect(host.getOpLogManager().getPendingCount()).toBeGreaterThan(0);
    expect(joiner.getOpLogManager().getPendingCount()).toBeGreaterThan(0);

    await connectPair(hostDc, joinerDc);

    expect(host.getCrdtEngine().computeWorkspaceHash()).toBe(joiner.getCrdtEngine().computeWorkspaceHash());
    const text = host.getCrdtEngine().getText('Main.java').toString();
    expect(text.includes('A')).toBe(true);
    expect(text.includes('B')).toBe(true);
    expect(host.getOpLogManager().getPendingCount()).toBe(0);
    expect(joiner.getOpLogManager().getPendingCount()).toBe(0);
  });

  it('forged frames are rejected before applyUpdate', async () => {
    await connectPair(hostDc, joinerDc);
    const before = joiner.getCrdtEngine().getText('Main.java').toString();

    const rogue = SecurityManager.generateIdentity();
    const encrypted = SecurityManager.encrypt(JSON.stringify({ u: 'AAAA' }), host.getProjectKey());
    const payloadStr = JSON.stringify(encrypted);
    const fake = {
      v: 1,
      type: 'crdt.update',
      projectId: 'SYNC-ROOM',
      from: rogue.peerId,
      opId: '018e9b5a-8b12-7a34-9c56-aaaaaaaaaaaa',
      lamport: 1,
      ts: Date.now(),
      payload: payloadStr,
      sig: SecurityManager.signData(payloadStr, rogue.privateKeyPem),
    };

    const result = joiner.injectAttackFrame(fake);
    expect(result.success).toBe(false);
    expect(joiner.getCrdtEngine().getText('Main.java').toString()).toBe(before);
  });

  it('Monaco binding local origin does not loop remote apply', () => {
    const engine = host.getCrdtEngine();
    const binding = new CrdtMonacoBinding(engine, 'App.java');
    let view = '';
    binding.bind(
      () => view,
      (val) => {
        view = val;
      }
    );
    binding.handleEditorChange('int x = 1;');
    expect(engine.getText('App.java').toString()).toBe('int x = 1;');

    const peer = joiner.getCrdtEngine();
    peer.applyUpdate(engine.encodeStateAsUpdate(), 'remote-host');
    const bindingB = new CrdtMonacoBinding(peer, 'App.java');
    let viewB = '';
    let echoCount = 0;
    bindingB.bind(
      () => viewB,
      (val) => {
        viewB = val;
        echoCount += 1;
        bindingB.handleEditorChange(val);
      }
    );
    expect(viewB).toBe('int x = 1;');
    bindingB.handleEditorChange(viewB);
    expect(echoCount).toBeLessThanOrEqual(1);
  });
});
