import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { TransportManager } from '../transport/TransportManager';
import { WebRtcTransport } from '../transport/WebRtcTransport';
import { LanTransport } from '../transport/LanTransport';
import { WebBluetoothTransport } from '../transport/WebBluetoothTransport';
import { RoomPeerStore } from './RoomPeerStore';
import { SecurityPipeline, MembershipList } from '../security/SecurityPipeline';
import { SecurityManager, CryptoIdentity, SymmetricKey } from '../security/SecurityManager';
import { OpLogManager } from '../crdt/OpLogManager';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';
import { OperationLogStore } from '../security/OperationLogStore';
import { Frame } from '@decentraide/shared';
import { SessionStatusStore } from './SessionStatusStore';
import { OverlapConflictDetector } from '../merge/OverlapConflictDetector';
import { ConvergenceVerifier } from './ConvergenceVerifier';
import { HackingSafetyStore } from '../security/HackingSafetyStore';
import { CodeSafetyAnalyzer } from '../security/CodeSafetyAnalyzer';
import { OllamaLocalProvider } from '../ai/AIProvider';

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

export class CollaborationManager {
  private static instance: CollaborationManager;

  private crdtEngine: YjsCrdtEngine;
  private transportManager: TransportManager;
  private peerStore: RoomPeerStore;
  private persistenceManager: LocalPersistenceManager;
  private opLogManager: OpLogManager;
  private securityPipeline: SecurityPipeline;
  private convergenceVerifier: ConvergenceVerifier;
  private identity: CryptoIdentity;
  private projectKey: SymmetricKey;
  private membership: MembershipList;
  private unsubCrdt?: () => void;

  private isStarted = false;
  private currentRoomId: string | null = null;
  private isHost = false;
  private hasRoomKey = false;
  private pendingRemoteFrames: Array<{ peerId: string; frameObj: unknown }> = [];
  private activeFilePath: string = 'src/main/java/Main.java';
  private webrtcTransport: WebRtcTransport | null = null;

  public static getInstance(): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager();
      if (typeof window !== 'undefined') {
        (window as any).__collaborationManager = CollaborationManager.instance;
      }
    }
    return CollaborationManager.instance;
  }

  constructor() {
    this.crdtEngine = new YjsCrdtEngine();
    this.peerStore = RoomPeerStore.getInstance();
    this.identity = SecurityManager.generateIdentity();
    this.peerStore.setLocalPeerId(this.identity.peerId);
    this.projectKey = SecurityManager.generateSymmetricKey();

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
    this.convergenceVerifier = new ConvergenceVerifier(this.crdtEngine, this.identity.peerId);

    this.securityPipeline = new SecurityPipeline(this.membership, this.projectKey, (evt) => {
      if (evt.status === 'REJECTED') {
        OperationLogStore.getInstance().logRejectedSecurityEvent(evt, this.activeFilePath);
      }
    });

    this.transportManager = new TransportManager('default-workspace');
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

  public getConvergenceVerifier(): ConvergenceVerifier {
    return this.convergenceVerifier;
  }

  public setActiveFilePath(filePath: string): void {
    this.activeFilePath = filePath;
    OverlapConflictDetector.getInstance().setFilePath(filePath);
  }

  /**
   * Syncs security verdict metadata onto Y.Doc annotation map for peer visibility
   */
  public syncSecurityAnnotation(filePath: string): void {
    const verdict = HackingSafetyStore.getInstance().getVerdict(filePath);
    const annotationMap = this.crdtEngine.getDoc().getMap('security-annotations');
    annotationMap.set(filePath, {
      threatLevel: verdict.threatLevel,
      securityScore: verdict.securityScore,
      findingsCount: verdict.findings.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Optional pre-share verification hook for explicit Sync / Share actions.
   * If file is High Risk, blocks explicit sharing until reviewed or acknowledged.
   */
  public async verifyAndShare(filePath = this.activeFilePath): Promise<{ allowed: boolean; reason?: string }> {
    const code = this.crdtEngine.getText(filePath).toString();
    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const result = await analyzer.analyzeCode(code, filePath);

    this.syncSecurityAnnotation(filePath);

    if (result.verdict.threatLevel === 'High Risk' && !result.verdict.isExecutionAllowed) {
      HackingSafetyStore.getInstance().addAuditLog({
        action: 'SHARE_VERIFY_BLOCKED',
        filePath,
        details: 'Explicit share/sync blocked due to un-reviewed High Risk security findings.',
        threatLevel: 'High Risk',
      });
      return {
        allowed: false,
        reason: 'Explicit share blocked: High-risk security vulnerability detected. Please review in Security Dashboard.',
      };
    }

    HackingSafetyStore.getInstance().addAuditLog({
      action: 'SHARE_VERIFY_PASSED',
      filePath,
      details: 'Pre-share safety verification passed.',
      threatLevel: result.verdict.threatLevel,
    });

    return { allowed: true };
  }

  public async startSession(roomId: string, options?: { isHost?: boolean }): Promise<void> {
    const isSameRoom = this.currentRoomId === roomId;

    if (this.currentRoomId && !isSameRoom && this.isStarted) {
      await this.transportManager.stopAll();
      this.isStarted = false;
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
    });

    if (!isSameRoom) {
      this.crdtEngine.reset();
    }
    this.setupCrdtListeners();

    if (!this.isStarted) {
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

      await this.transportManager.startAll();
      this.isStarted = true;
    }

    SessionStatusStore.getInstance().patch({ phase: 'connecting' });

    if (!isSameRoom) {
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
        SessionStatusStore.getInstance().patch({ phase: 'connecting' });
      }
      if (state === 'connected') {
        const phase = this.transportManager.getActiveTransportType() === 'lan' ? 'lan-relay' : 'connected';
        SessionStatusStore.getInstance().patch({ phase });
        this.sendHello(peerId);
        if (this.hasRoomKey && this.membership.members.has(peerId)) {
          this.sendSyncStep1(peerId);
        }
      }
    });

    this.transportManager.onActiveTransportChanged((type) => {
      if (type === 'lan') {
        SessionStatusStore.getInstance().patch({ phase: 'lan-relay' });
      } else if (type === 'local') {
        SessionStatusStore.getInstance().patch({ phase: 'local' });
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
      if (this.isHost && this.hasRoomKey) {
        this.sendKeyDistribute(peerId);
      }
      if (this.hasRoomKey) {
        this.sendSyncStep1(peerId);
      }

      // Process buffered frames that were waiting for membership
      const buffered = [...this.pendingRemoteFrames];
      this.pendingRemoteFrames = [];
      for (const item of buffered) {
        if (!this.hasRoomKey) {
          this.pendingRemoteFrames.push(item);
        } else {
          this.applySecuredFrame(item.peerId, item.frameObj);
        }
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
      return true;
    }

    if (msg.type === 'HASH_ANNOUNCE' && typeof msg.hash === 'string') {
      this.convergenceVerifier.recordRemoteHash(peerId, msg.hash);
      const localHash = this.convergenceVerifier.getLocalHash();
      const converged = this.convergenceVerifier.isConverged();
      SessionStatusStore.getInstance().patch({
        remoteHash: msg.hash,
        localHash,
        converged,
        phase: converged ? 'verified' : SessionStatusStore.getInstance().get().phase,
      });
      return true;
    }

    return false;
  }

  private applySecuredFrame(peerId: string, frameObj: unknown): void {
    const result = this.securityPipeline.processIncomingFrame(frameObj);
    if (!result.success) {
      if (result.reason === 'Not a member') {
        this.pendingRemoteFrames.push({ peerId, frameObj });
      }
      return;
    }

    if (result.decryptedPayload) {
      const payloadObj = JSON.parse(result.decryptedPayload);
      const frameType = result.type;
      const senderPeerId = result.from || peerId;

      if (frameType === 'crdt.syncStep1') {
        if (payloadObj.sv) {
          const remoteSv = base64ToUint8Array(payloadObj.sv);
          const diffUpdate = this.crdtEngine.encodeStateAsUpdate(remoteSv);
          if (diffUpdate.length > 0) {
            const step2Payload = { u: uint8ArrayToBase64(diffUpdate), filePath: this.activeFilePath };
            const frameBytes = this.sealFrame('crdt.syncStep2', step2Payload);
            this.transportManager.send(senderPeerId, frameBytes).catch(() => {});
          }
        }
      } else if (frameType === 'crdt.syncStep2' || frameType === 'crdt.update') {
        if (payloadObj.u) {
          const updateBytes = base64ToUint8Array(payloadObj.u);
          this.crdtEngine.applyUpdate(updateBytes, `remote-${senderPeerId}`);
          this.opLogManager.clearQueue();

          OperationLogStore.getInstance().logAppliedOp(senderPeerId, 'UPDATE', payloadObj.filePath || this.activeFilePath);

          const isConverged = this.convergenceVerifier.isConverged();
          if (isConverged) {
            OverlapConflictDetector.getInstance().noteRemoteEdit(
              senderPeerId,
              payloadObj.filePath || this.activeFilePath,
              this.crdtEngine.getText(payloadObj.filePath || this.activeFilePath).toString()
            );
          }

          this.saveSnapshotDebounced();
          this.announceHash();
        }
      }
    }
  }

  private setupCrdtListeners(): void {
    this.unsubCrdt?.();
    this.unsubCrdt = this.crdtEngine.onUpdate((update, origin) => {
      if (origin && (origin.startsWith('remote') || origin === 'local-persistence')) return;

      const payloadObj = {
        u: uint8ArrayToBase64(update),
        filePath: this.activeFilePath,
      };
      const frameBytes = this.sealFrame('crdt.update', payloadObj);

      if (this.hasRoomKey) {
        this.transportManager.broadcast(frameBytes).catch(() => {
          this.opLogManager.enqueueLocalUpdate(update);
        });
      } else {
        this.opLogManager.enqueueLocalUpdate(update);
      }

      this.saveSnapshotDebounced();

      const isConverged = this.convergenceVerifier.isConverged();
      if (isConverged) {
        OverlapConflictDetector.getInstance().noteLocalEdit(
          this.identity.peerId,
          this.activeFilePath,
          this.crdtEngine.getText(this.activeFilePath).toString()
        );
      }

      this.announceHash();
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
    if (!this.hasRoomKey || !this.membership.members.has(peerId)) return;
    try {
      const sv = this.crdtEngine.encodeStateVector();
      const payloadObj = { sv: uint8ArrayToBase64(sv) };
      const frameBytes = this.sealFrame('crdt.syncStep1', payloadObj);
      this.transportManager.send(peerId, frameBytes).catch(() => {});
    } catch (e) {
      console.warn('[CollaborationManager] Failed to send syncStep1 to peer:', peerId, e);
    }
  }

  public announceHash(): void {
    const hash = this.convergenceVerifier.getLocalHash();
    SessionStatusStore.getInstance().patch({ localHash: hash, converged: this.convergenceVerifier.isConverged() });
    const msg = { type: 'HASH_ANNOUNCE', hash, from: this.identity.peerId };
    this.transportManager.broadcast(new TextEncoder().encode(JSON.stringify(msg))).catch(() => {});
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
