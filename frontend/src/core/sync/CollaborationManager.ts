import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { TransportManager } from '../transport/TransportManager';
import { WebRtcTransport } from '../transport/WebRtcTransport';
import { LanTransport } from '../transport/LanTransport';
import { WebBluetoothTransport } from '../transport/WebBluetoothTransport';
import { RoomPeerStore } from './RoomPeerStore';
import { SecurityPipeline, MembershipList } from '../security/SecurityPipeline';
import { SecurityManager, CryptoIdentity, SymmetricKey } from '../security/SecurityManager';
import { OpLogManager } from '../crdt/OpLogManager';
import { CrdtFsBinding } from '../crdt/CrdtFsBinding';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';
import { OperationLogStore } from '../security/OperationLogStore';
import { Frame } from '@decentraide/shared';
import { SessionStatusStore } from './SessionStatusStore';
import { OverlapConflictDetector } from '../merge/OverlapConflictDetector';
import { ConvergenceVerifier } from './ConvergenceVerifier';
import { Transport } from '../transport/Transport';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function newOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isEmptyYjsUpdate(update: Uint8Array): boolean {
  if (update.byteLength === 0) return true;
  if (update.byteLength <= 2) {
    for (let i = 0; i < update.byteLength; i++) {
      if (update[i] !== 0) return false;
    }
    return true;
  }
  return false;
}

function yDocHasFileContent(engine: YjsCrdtEngine): boolean {
  const keys = Array.from(engine.getDoc().share.keys());
  return keys.some((key) => key !== 'metadata' && engine.getText(key).length > 0);
}

type PendingRemoteFrame = { peerId: string; frameObj: unknown };

export class CollaborationManager {
  private static instance: CollaborationManager;

  private crdtEngine: YjsCrdtEngine;
  private transportManager: TransportManager;
  private peerStore: RoomPeerStore;
  private persistenceManager: LocalPersistenceManager;
  private opLogManager: OpLogManager;
  private fsBinding: CrdtFsBinding;
  private securityPipeline: SecurityPipeline;
  private verifier: ConvergenceVerifier;
  private identity: CryptoIdentity;
  private projectKey: SymmetricKey;
  private membership: MembershipList;
  private unsubCrdt?: () => void;

  private isStarted = false;
  private currentRoomId: string | null = null;
  private isHost = false;
  private hasRoomKey = false;
  private pendingRemoteFrames: PendingRemoteFrame[] = [];
  private activeFilePath: string = 'src/main/java/Main.java';
  private webrtcTransport: WebRtcTransport | null = null;
  private connectedPeers = new Set<string>();
  private syncStep1Sent = new Set<string>();

  public static getInstance(): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager();
      if (typeof window !== 'undefined') {
        (window as any).__collaborationManager = CollaborationManager.instance;
      }
    }
    return CollaborationManager.instance;
  }

  constructor(options?: { peerStore?: RoomPeerStore; transportManager?: TransportManager }) {
    this.crdtEngine = new YjsCrdtEngine();
    this.peerStore = options?.peerStore ?? RoomPeerStore.getInstance();
    this.identity = SecurityManager.generateIdentity();
    this.peerStore.setLocalPeerId(this.identity.peerId);
    this.projectKey = SecurityManager.generateSymmetricKey();
    this.verifier = new ConvergenceVerifier(this.crdtEngine, this.identity.peerId);

    this.membership = {
      projectId: 'decentraide-workspace',
      ownerPeerId: this.identity.peerId,
      members: new Map([
        [this.identity.peerId, { role: 'Owner', publicKeyPem: this.identity.publicKeyPem }],
      ]),
      ownerSignature: 'sig-owner',
    };

    this.persistenceManager = new LocalPersistenceManager('workspace');
    this.opLogManager = new OpLogManager(this.crdtEngine, this.persistenceManager);
    this.fsBinding = new CrdtFsBinding(this.crdtEngine);

    this.securityPipeline = new SecurityPipeline(this.membership, this.projectKey, (evt) => {
      if (evt.status === 'REJECTED') {
        OperationLogStore.getInstance().logRejectedSecurityEvent(evt, this.activeFilePath);
      }
    });

    this.transportManager = options?.transportManager ?? new TransportManager('default-workspace');
    this.setupTransportListeners();
    this.setupCrdtListeners();
  }

  public getCrdtEngine(): YjsCrdtEngine {
    return this.crdtEngine;
  }

  public getTransportManager(): TransportManager {
    return this.transportManager;
  }

  public getPeerStore(): RoomPeerStore {
    return this.peerStore;
  }

  public getOpLogManager(): OpLogManager {
    return this.opLogManager;
  }

  public getFsBinding(): CrdtFsBinding {
    return this.fsBinding;
  }

  public getPersistenceManager(): LocalPersistenceManager {
    return this.persistenceManager;
  }

  public getIdentity(): CryptoIdentity {
    return this.identity;
  }

  public getSecurityPipeline(): SecurityPipeline {
    return this.securityPipeline;
  }

  public getProjectKey(): SymmetricKey {
    return this.projectKey;
  }

  public getVerifier(): ConvergenceVerifier {
    return this.verifier;
  }

  public getConvergenceVerifier(): ConvergenceVerifier {
    return this.verifier;
  }

  public setActiveFilePath(filePath: string): void {
    this.activeFilePath = filePath;
    OverlapConflictDetector.getInstance().setFilePath(filePath);
  }

  public registerSyncTransport(transport: Transport): void {
    this.transportManager.registerTransport(transport);
    this.isStarted = true;
  }

  public async startSession(
    roomId: string,
    options?: { isHost?: boolean; skipDefaultTransports?: boolean }
  ): Promise<void> {
    const previousRoomId = this.currentRoomId;
    const switchingRoom = previousRoomId !== null && previousRoomId !== roomId;

    if (switchingRoom && this.isStarted) {
      await this.transportManager.stopAll();
      this.isStarted = false;
      this.connectedPeers.clear();
      this.syncStep1Sent.clear();
    }

    this.isHost = !!options?.isHost;
    this.hasRoomKey = this.isHost;
    this.currentRoomId = roomId;
    this.peerStore.setRoomId(roomId);
    this.peerStore.setLocalRole(this.isHost ? 'Host' : 'Peer');
    this.transportManager.setWorkspaceId(roomId);
    this.membership.projectId = roomId;

    if (this.isHost) {
      this.securityPipeline.setProjectKey(this.projectKey);
    }

    SessionStatusStore.getInstance().patch({
      phase: 'signaling',
      roomId,
      isHost: this.isHost,
      iceFailedReason: null,
      converged: false,
      localHash: this.crdtEngine.computeWorkspaceHash(),
      remoteHash: null,
    });

    if (switchingRoom) {
      this.crdtEngine.reset();
      this.fsBinding = new CrdtFsBinding(this.crdtEngine);
      this.setupCrdtListeners();
      this.opLogManager.clearPending();
      this.verifier = new ConvergenceVerifier(this.crdtEngine, this.identity.peerId);
    }

    if (!this.isStarted) {
      if (!options?.skipDefaultTransports) {
        const localId = this.peerStore.getLocalPeerId();

        const webrtc = new WebRtcTransport(localId, roomId);
        this.webrtcTransport = webrtc;
        webrtc.onIceFailed((_peerId, reason) => {
          SessionStatusStore.getInstance().patch({ phase: 'ice-failed', iceFailedReason: reason });
        });
        this.transportManager.registerTransport(webrtc);

        const lan = new LanTransport(localId, roomId, `Peer (${localId.substring(0, 6)})`);
        this.transportManager.registerTransport(lan);

        const bt = new WebBluetoothTransport(localId);
        this.transportManager.registerTransport(bt);
      }

      await this.transportManager.startAll();
      this.isStarted = true;
    }

    SessionStatusStore.getInstance().patch({ phase: 'connecting' });

    if (!yDocHasFileContent(this.crdtEngine)) {
      const savedSnapshot = await this.persistenceManager.getCrdtSnapshot(roomId);
      if (savedSnapshot && savedSnapshot.length > 0) {
        try {
          this.crdtEngine.applyUpdate(savedSnapshot, 'local-persistence');
        } catch (e) {
          console.warn('[CollaborationManager] Could not load saved snapshot:', e);
        }
      }
    }
  }

  public injectAttackFrame(rawFrame: unknown): { success: boolean; reason?: string } {
    return this.securityPipeline.processIncomingFrame(rawFrame);
  }

  private setupTransportListeners(): void {
    this.transportManager.onFrame((peerId, frameBytes) => {
      try {
        const frameStr = new TextDecoder().decode(frameBytes);
        let frameObj: unknown;
        try {
          frameObj = JSON.parse(frameStr);
        } catch {
          OperationLogStore.getInstance().logRejectedSecurityEvent(
            {
              id: `sec-raw-${Date.now()}`,
              timestamp: Date.now(),
              peerId,
              reason: 'Malformed payload',
              status: 'REJECTED',
              details: 'Unsigned binary discarded',
            },
            this.activeFilePath
          );
          return;
        }

        if (this.handleControlMessage(peerId, frameObj)) {
          return;
        }

        if (!this.hasRoomKey) {
          this.pendingRemoteFrames.push({ peerId, frameObj });
          return;
        }

        this.applySecuredFrame(peerId, frameObj);
      } catch (e) {
        console.warn('[CollaborationManager] Frame processing error:', e);
      }
    });

    this.transportManager.onPeerState((peerId, state) => {
      if (state === 'connecting') {
        SessionStatusStore.getInstance().patch({ phase: 'connecting', converged: false });
      }
      if (state === 'connected') {
        this.connectedPeers.add(peerId);
        this.syncStep1Sent.delete(peerId);
        const phase = this.transportManager.getActiveTransportType() === 'lan' ? 'lan-relay' : 'connected';
        SessionStatusStore.getInstance().patch({ phase, converged: false });
        this.sendHello(peerId);
        if (this.hasRoomKey) {
          this.sendSyncStep1(peerId);
          this.flushPendingOps();
        }
      }
      if (state === 'offline') {
        this.connectedPeers.delete(peerId);
        this.syncStep1Sent.delete(peerId);
        SessionStatusStore.getInstance().patch({
          converged: false,
          phase: this.connectedPeers.size === 0 ? 'local' : SessionStatusStore.getInstance().get().phase,
        });
      }
    });

    this.transportManager.onActiveTransportChanged((type) => {
      if (type === 'lan') {
        SessionStatusStore.getInstance().patch({ phase: 'lan-relay' });
      } else if (type === 'local') {
        SessionStatusStore.getInstance().patch({ phase: 'local', converged: false });
      }
    });
  }

  private handleControlMessage(peerId: string, obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const msg = obj as Record<string, unknown>;
    if (typeof msg.type !== 'string') return false;

    if (msg.type === 'P2P_PING' || msg.type === 'P2P_PONG') return true;

    if (msg.type === 'PEER_HELLO' && typeof msg.peerId === 'string' && typeof msg.publicKeyPem === 'string') {
      this.securityPipeline.addMember(msg.peerId, msg.publicKeyPem, 'Developer');
      if (this.hasRoomKey) {
        this.flushPendingFramesForPeer(peerId);
      }
      if (this.isHost && this.hasRoomKey) {
        this.sendKeyDistribute(peerId);
      }
      if (this.hasRoomKey) {
        this.sendSyncStep1(peerId);
        this.flushPendingOps();
      }
      return true;
    }

    if (msg.type === 'KEY_DISTRIBUTE' && typeof msg.keyB64 === 'string') {
      this.projectKey = SecurityManager.keyFromBase64(msg.keyB64);
      this.securityPipeline.setProjectKey(this.projectKey);
      this.hasRoomKey = true;

      const buffered = [...this.pendingRemoteFrames];
      this.pendingRemoteFrames = [];
      for (const item of buffered) {
        this.applySecuredFrame(item.peerId, item.frameObj);
      }

      this.sendSyncStep1(peerId);
      this.flushPendingOps();
      return true;
    }

    if (msg.type === 'HASH_ANNOUNCE' && typeof msg.hash === 'string') {
      const from = typeof msg.from === 'string' ? msg.from : peerId;
      this.verifier.recordRemoteHash(from, msg.hash);
      this.publishConvergence();
      return true;
    }

    return false;
  }

  private flushPendingFramesForPeer(peerId: string): void {
    const remaining: PendingRemoteFrame[] = [];
    for (const pending of this.pendingRemoteFrames) {
      if (pending.peerId !== peerId && peerId !== '*') {
        remaining.push(pending);
        continue;
      }
      this.applySecuredFrame(pending.peerId, pending.frameObj);
    }
    this.pendingRemoteFrames = remaining;
  }

  private applySecuredFrame(peerId: string, frameObj: unknown): void {
    const result = this.securityPipeline.processIncomingFrame(frameObj);
    if (!result.success) {
      if (result.reason === 'Not a member') {
        this.pendingRemoteFrames.push({ peerId, frameObj });
      }
      return;
    }
    if (!result.decryptedPayload) return;

    let payloadObj: Record<string, unknown>;
    try {
      payloadObj = JSON.parse(result.decryptedPayload) as Record<string, unknown>;
    } catch {
      return;
    }

    if (result.type === 'crdt.syncStep1' && typeof payloadObj.sv === 'string') {
      this.replySyncStep2(peerId, base64ToUint8Array(payloadObj.sv));
      if (!this.syncStep1Sent.has(peerId)) {
        this.sendSyncStep1(peerId);
      }
      return;
    }

    if (
      (result.type === 'crdt.syncStep2' || result.type === 'crdt.update') &&
      typeof payloadObj.u === 'string'
    ) {
      const updateBytes = base64ToUint8Array(payloadObj.u);
      if (isEmptyYjsUpdate(updateBytes)) return;

      this.crdtEngine.applyUpdate(updateBytes, `remote-${peerId}`);
      OperationLogStore.getInstance().logAppliedOp(
        peerId,
        'UPDATE',
        (typeof payloadObj.filePath === 'string' ? payloadObj.filePath : null) || this.activeFilePath
      );

      if (result.type === 'crdt.update') {
        const filePath =
          (typeof payloadObj.filePath === 'string' ? payloadObj.filePath : null) || this.activeFilePath;
        OverlapConflictDetector.getInstance().noteRemoteEdit(
          peerId,
          filePath,
          this.crdtEngine.getText(filePath).toString()
        );
      }

      this.saveSnapshotDebounced();
      this.announceHash();
    }
  }

  private setupCrdtListeners(): void {
    this.unsubCrdt?.();
    this.unsubCrdt = this.crdtEngine.onUpdate((update, origin) => {
      const originTag = typeof origin === 'string' ? origin : '';
      if (originTag.startsWith('remote') || originTag === 'local-persistence') return;

      this.saveSnapshotDebounced();
      OverlapConflictDetector.getInstance().noteLocalEdit(
        this.identity.peerId,
        this.activeFilePath,
        this.crdtEngine.getText(this.activeFilePath).toString()
      );

      if (!this.hasRoomKey || this.connectedPeers.size === 0) {
        this.opLogManager.enqueueLocalUpdate(update);
        this.announceHash();
        return;
      }

      const payloadObj = {
        u: uint8ArrayToBase64(update),
        filePath: this.activeFilePath,
      };
      const frameBytes = this.sealFrame('crdt.update', payloadObj);
      void this.transportManager.broadcast(frameBytes).then(
        () => undefined,
        () => {
          this.opLogManager.enqueueLocalUpdate(update);
        }
      );
      this.announceHash();
    });
  }

  private flushPendingOps(): void {
    if (!this.hasRoomKey || this.connectedPeers.size === 0) {
      return;
    }

    this.opLogManager.flushQueue((op) => {
      try {
        if (isEmptyYjsUpdate(op.update)) return true;
        const payloadObj = {
          u: uint8ArrayToBase64(op.update),
          filePath: this.activeFilePath,
        };
        const frameBytes = this.sealFrame('crdt.update', payloadObj);
        this.transportManager.broadcast(frameBytes).catch(() => {});
        return true;
      } catch {
        return false;
      }
    });
  }

  private sendHello(peerId: string): void {
    const hello = {
      type: 'PEER_HELLO',
      peerId: this.identity.peerId,
      publicKeyPem: this.identity.publicKeyPem,
      roomId: this.currentRoomId,
      isHost: this.isHost,
    };
    this.transportManager.send(peerId, new TextEncoder().encode(JSON.stringify(hello))).catch(() => {});
  }

  private sendKeyDistribute(peerId: string): void {
    const msg = {
      type: 'KEY_DISTRIBUTE',
      keyB64: SecurityManager.keyToBase64(this.projectKey),
      from: this.identity.peerId,
    };
    this.transportManager.send(peerId, new TextEncoder().encode(JSON.stringify(msg))).catch(() => {});
  }

  private sendSyncStep1(peerId: string): void {
    if (!this.hasRoomKey) return;
    try {
      const sv = this.crdtEngine.encodeStateVector();
      const payloadObj = { sv: uint8ArrayToBase64(sv) };
      const frameBytes = this.sealFrame('crdt.syncStep1', payloadObj);
      this.transportManager.send(peerId, frameBytes).catch(() => {});
      this.syncStep1Sent.add(peerId);
    } catch (e) {
      console.warn('[CollaborationManager] Failed to send syncStep1 to peer:', peerId, e);
    }
  }

  private replySyncStep2(peerId: string, remoteStateVector: Uint8Array): void {
    if (!this.hasRoomKey) return;
    try {
      const diff = this.crdtEngine.encodeStateAsUpdate(remoteStateVector);
      if (isEmptyYjsUpdate(diff)) return;
      const payloadObj = {
        u: uint8ArrayToBase64(diff),
        filePath: this.activeFilePath,
      };
      const frameBytes = this.sealFrame('crdt.syncStep2', payloadObj);
      this.transportManager.send(peerId, frameBytes).catch(() => {});
    } catch (e) {
      console.warn('[CollaborationManager] Failed to send syncStep2 to peer:', peerId, e);
    }
  }

  public announceHash(): void {
    const hash = this.verifier.getLocalHash();
    SessionStatusStore.getInstance().patch({ localHash: hash });
    this.publishConvergence();
    const msg = { type: 'HASH_ANNOUNCE', hash, from: this.identity.peerId };
    this.transportManager.broadcast(new TextEncoder().encode(JSON.stringify(msg))).catch(() => {});
  }

  private publishConvergence(): void {
    const localHash = this.verifier.getLocalHash();
    const hashes = this.verifier.getPeerHashes();
    const remote = hashes.find((h) => !h.peerId.includes('(You)'));
    const hashesMatch = this.verifier.hashesMatchPeers();
    const connected = this.connectedPeers.size > 0;
    SessionStatusStore.getInstance().patch({
      localHash,
      remoteHash: remote?.hash ?? SessionStatusStore.getInstance().get().remoteHash,
      converged: connected && hashesMatch,
      phase: connected && hashesMatch ? 'verified' : SessionStatusStore.getInstance().get().phase,
    });
  }

  private sealFrame(type: Frame['type'], payloadObj: unknown): Uint8Array {
    const payloadStr = JSON.stringify(payloadObj);
    const encrypted = SecurityManager.encrypt(payloadStr, this.projectKey);
    const encryptedPayloadStr = JSON.stringify(encrypted);
    const signature = SecurityManager.signData(encryptedPayloadStr, this.identity.privateKeyPem);
    const frame: Frame = {
      v: 1,
      type,
      projectId: this.currentRoomId || 'default-workspace',
      from: this.peerStore.getLocalPeerId(),
      opId: newOpId(),
      lamport: Date.now(),
      ts: Date.now(),
      payload: encryptedPayloadStr,
      sig: signature,
    };
    return new TextEncoder().encode(JSON.stringify(frame));
  }

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private saveSnapshotDebounced(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      const snapshot = this.crdtEngine.encodeStateAsUpdate();
      this.persistenceManager.saveCrdtSnapshot(snapshot, this.currentRoomId || undefined);
    }, 1000);
  }
}
