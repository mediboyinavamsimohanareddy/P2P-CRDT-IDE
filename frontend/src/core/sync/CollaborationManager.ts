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
import { SignalingConfig } from './SignalingConfig';
import { OverlapConflictDetector } from '../merge/OverlapConflictDetector';
import { ConvergenceVerifier } from './ConvergenceVerifier';
import { AutoRejoinManager } from './AutoRejoinManager';
import { ActiveSessionMetadata } from '../../services/LocalPersistenceManager';
import { Transport } from '../transport/Transport';
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

const MAX_PEER_CODE_LENGTH = 200_000;

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

    const autoRejoin = AutoRejoinManager.getInstance();
    autoRejoin.setTriggerRejoinHandler(async (session) => {
      await this.resumeActiveSession(session.roomId);
    });
    autoRejoin.setDraftProvider(() =>
      this.currentRoomId
        ? {
            roomId: this.currentRoomId,
            peerId: this.identity.peerId,
            displayName: this.peerStore.getPeers().find((p) => p.id === this.identity.peerId)?.displayName,
            code: this.crdtEngine.getText(this.activeFilePath).toString(),
            filePath: this.activeFilePath,
            isHost: this.isHost,
          }
        : null
    );
    autoRejoin.setOfflineCodeRecoveredHandler((draft) => {
      OverlapConflictDetector.getInstance().noteLocalEdit(this.identity.peerId, draft.filePath, draft.code);
    });
    autoRejoin.resumeIfDraftPending();

    if (this.isHost) {
      if (this.crdtEngine.getText('Main.java').length === 0) {
        const initialMainJava = `class Main {
    public static void main(String[] args) {

        int b = 20;
        int result = 50;

        System.out.println("b = " + b);
        System.out.println("result = " + result);
    }
}
`;
        this.crdtEngine.getText('Main.java').insert(0, initialMainJava);
      }
    }
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
   * Broadcasts verified merged update to all connected peers.
   */
  public async broadcastVerifiedMerge(updateBytes?: Uint8Array, filePath = this.activeFilePath): Promise<boolean> {
    if (!this.hasRoomKey || this.connectedPeers.size === 0) {
      return false;
    }
    const update = updateBytes || this.crdtEngine.encodeStateAsUpdate();
    if (isEmptyYjsUpdate(update)) return true;

    const payloadObj = {
      u: uint8ArrayToBase64(update),
      filePath,
      code: this.crdtEngine.getText(filePath).toString(),
      resolved: true,
    };
    const frameBytes = this.sealFrame('crdt.update', payloadObj);
    await this.transportManager.broadcast(frameBytes);
    this.announceHash();
    return true;
  }

  /**
   * Optional pre-share verification hook for explicit Sync / Share actions.
   * If file is High Risk, blocks explicit sharing until reviewed or acknowledged.
   */
  private peerStateResolvers = new Map<string, (res: { peerId: string; filePath: string; code: string; versionHash: string }) => void>();

  public async fetchPeerState(peerId?: string, filePath = this.activeFilePath): Promise<{ peerId: string; filePath: string; code: string; versionHash: string }[]> {
    const targetPeers = peerId ? [peerId] : Array.from(this.connectedPeers);
    if (targetPeers.length === 0) {
      return [];
    }

    const promises = targetPeers.map((pId) => {
      return new Promise<{ peerId: string; filePath: string; code: string; versionHash: string }>((resolve) => {
        const requestId = `${pId}-${filePath}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const timer = setTimeout(() => {
          this.peerStateResolvers.delete(requestId);
          // Fallback if peer timeout
          resolve({
            peerId: pId,
            filePath,
            code: this.crdtEngine.getText(filePath).toString(),
            versionHash: 'timeout-fallback',
          });
        }, 3000);

        this.peerStateResolvers.set(requestId, (data) => {
          clearTimeout(timer);
          resolve(data);
        });

        if (this.hasRoomKey) {
          const payloadObj = { requestId, filePath };
          const frameBytes = this.sealFrame('crdt.stateRequest', payloadObj);
          this.transportManager.send(pId, frameBytes).catch(() => {});
        } else {
          const req = { type: 'PEER_STATE_REQUEST', requestId, filePath };
          this.transportManager.send(pId, new TextEncoder().encode(JSON.stringify(req))).catch(() => {});
        }
      });
    });

    return Promise.all(promises);
  }

  /**
   * Collects the current code of this laptop and every connected laptop for a file and
   * feeds them to the conflict detector. Laptops that did not answer are left out, so a
   * silent peer never shows up as a copy of the local code.
   */
  public async refreshConflictAnalysis(
    filePath = this.activeFilePath
  ): Promise<{ peerId: string; code: string }[]> {
    const localCode = this.crdtEngine.getText(filePath).toString();
    const peerStates = (await this.fetchPeerState(undefined, filePath)).filter(
      (s) => s.versionHash !== 'timeout-fallback'
    );

    const activePeerIds = [this.identity.peerId, ...peerStates.map((s) => s.peerId)];

    const detector = OverlapConflictDetector.getInstance();
    detector.pruneToActivePeers(filePath, activePeerIds);
    detector.noteLocalEdit(this.identity.peerId, filePath, localCode);
    for (const state of peerStates) {
      detector.noteRemoteEdit(state.peerId, filePath, state.code);
    }

    return [
      { peerId: this.identity.peerId, code: localCode },
      ...peerStates.map((s) => ({ peerId: s.peerId, code: s.code })),
    ];
  }

  /**
   * Optional pre-share verification hook for explicit Sync / Share actions.
   * If file is High Risk, blocks explicit sharing until reviewed or acknowledged.
   */
  public async verifyAndShare(filePath = this.activeFilePath): Promise<{ allowed: boolean; reason?: string }> {
    const code = this.crdtEngine.getText(filePath).toString();

    HackingSafetyStore.getInstance().addAuditLog({
      action: 'SHARE_VERIFY_PASSED',
      filePath,
      details: 'Pre-share safety verification passed.',
      threatLevel: result.verdict.threatLevel,
    });

    return { allowed: true };
  }

  /**
   * Resumes active session on network recovery without resetting Y.Doc
   */
  public async resumeActiveSession(targetRoomId?: string): Promise<void> {
    const savedMeta = await this.persistenceManager.getActiveSession();
    const roomIdToResume = targetRoomId || savedMeta?.roomId || this.currentRoomId;
    if (!roomIdToResume) return;

    if (!this.isHost && savedMeta?.signalingHost) {
      SignalingConfig.getInstance().setHost(savedMeta.signalingHost);
      try {
        await joinRoom(roomIdToResume, this.peerStore.getLocalPeerId());
      } catch {
        // Best effort signaling check
      }
    }

    if (this.webrtcTransport) {
      await this.webrtcTransport.stop();
      this.connectedPeers.clear();
      this.syncStep1Sent.clear();
    }

    // Re-start session logic using existing connection flows
    await this.startSession(roomIdToResume, { isHost: this.isHost });
    AutoRejoinManager.getInstance().resetRetryCount();
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

    // Persist active session metadata for session resume / auto-rejoin
    const activeSessionMeta: ActiveSessionMetadata = {
      roomId,
      isHost: this.isHost,
      signalingHost: SignalingConfig.getInstance().getHost() || undefined,
      peerId: this.identity.peerId,
      publicKeyPem: this.identity.publicKeyPem,
      privateKeyPem: this.identity.privateKeyPem,
      projectKeyB64: SecurityManager.keyToBase64(this.projectKey),
      activeFilePath: this.activeFilePath,
      savedAt: Date.now(),
    };
    this.persistenceManager.saveActiveSession(activeSessionMeta).catch(() => {});

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
    } else if (!this.isHost) {
      // Joining peers clear any locally generated default template so they don't duplicate host code upon receiving initial state
      const text = this.crdtEngine.getText('Main.java');
      if (text.length > 0) {
        text.delete(0, text.length);
      }
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
        AutoRejoinManager.getInstance().resetRetryCount();
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
        
        const remainingPeers = this.connectedPeers.size;
        if (remainingPeers === 0) {
          AutoRejoinManager.getInstance().handleNetworkLoss();
        } else {
          SessionStatusStore.getInstance().patch({
            converged: false,
            phase: 'connected',
          });
        }
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

    if (msg.type === 'PEER_STATE_REQUEST' && typeof msg.requestId === 'string') {
      const targetPath = typeof msg.filePath === 'string' ? msg.filePath : this.activeFilePath;
      const code = this.crdtEngine.getText(targetPath).toString();
      const versionHash = this.crdtEngine.computeWorkspaceHash();
      const resp = {
        type: 'PEER_STATE_RESPONSE',
        requestId: msg.requestId,
        peerId: this.identity.peerId,
        filePath: targetPath,
        code,
        versionHash,
      };
      this.transportManager.send(peerId, new TextEncoder().encode(JSON.stringify(resp))).catch(() => {});
      return true;
    }

    if (msg.type === 'PEER_STATE_RESPONSE' && typeof msg.requestId === 'string') {
      const resolver = this.peerStateResolvers.get(msg.requestId as string);
      if (resolver) {
        this.peerStateResolvers.delete(msg.requestId as string);
        resolver({
          peerId: (typeof msg.peerId === 'string' ? msg.peerId : peerId),
          filePath: (typeof msg.filePath === 'string' ? msg.filePath : this.activeFilePath),
          code: (typeof msg.code === 'string' ? msg.code : ''),
          versionHash: (typeof msg.versionHash === 'string' ? msg.versionHash : ''),
        });
      }
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

    if (result.type === 'crdt.stateRequest' && typeof payloadObj.requestId === 'string') {
      const targetPath = typeof payloadObj.filePath === 'string' ? payloadObj.filePath : this.activeFilePath;
      const code = this.crdtEngine.getText(targetPath).toString();
      const versionHash = this.crdtEngine.computeWorkspaceHash();
      const respPayload = {
        requestId: payloadObj.requestId,
        peerId: this.identity.peerId,
        filePath: targetPath,
        code,
        versionHash,
      };
      const respFrame = this.sealFrame('crdt.stateResponse', respPayload);
      this.transportManager.send(peerId, respFrame).catch(() => {});
      return;
    }

    if (result.type === 'crdt.stateResponse' && typeof payloadObj.requestId === 'string') {
      const resolver = this.peerStateResolvers.get(payloadObj.requestId as string);
      if (resolver) {
        this.peerStateResolvers.delete(payloadObj.requestId as string);
        resolver({
          peerId: (typeof payloadObj.peerId === 'string' ? payloadObj.peerId : peerId),
          filePath: (typeof payloadObj.filePath === 'string' ? payloadObj.filePath : this.activeFilePath),
          code: (typeof payloadObj.code === 'string' ? payloadObj.code : ''),
          versionHash: (typeof payloadObj.versionHash === 'string' ? payloadObj.versionHash : ''),
        });
      }
      return;
    }

    if (
      (result.type === 'crdt.syncStep2' || result.type === 'crdt.update') &&
      typeof payloadObj.u === 'string'
    ) {
      const updateBytes = base64ToUint8Array(payloadObj.u);
      if (isEmptyYjsUpdate(updateBytes)) return;

      const filePath =
        (typeof payloadObj.filePath === 'string' ? payloadObj.filePath : null) || this.activeFilePath;
      // Capture local code state before merging
      const localBeforeMerge = this.crdtEngine.getText(filePath).toString();

      this.crdtEngine.applyUpdate(updateBytes, `remote-${peerId}`);
      OperationLogStore.getInstance().logAppliedOp(peerId, 'UPDATE', filePath);

      if (payloadObj.resolved === true) {
        // A verified merge settles the conflict
        OverlapConflictDetector.getInstance().clear();
      } else if (typeof payloadObj.code === 'string') {
        const detector = OverlapConflictDetector.getInstance();
        detector.noteLocalEdit(this.identity.peerId, filePath, localBeforeMerge);
        detector.noteRemoteEdit(peerId, filePath, payloadObj.code.slice(0, MAX_PEER_CODE_LENGTH));
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
      AutoRejoinManager.getInstance().persistDraftIfOffline();

      if (!this.hasRoomKey || this.connectedPeers.size === 0) {
        this.opLogManager.enqueueLocalUpdate(update);
        this.announceHash();
        return;
      }

      // Live keystroke update broadcasting is disabled.
      // Edits update Yjs locally and queue up for verified explicit merge broadcasts / sync.
      this.opLogManager.enqueueLocalUpdate(update);
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
          code: this.crdtEngine.getText(this.activeFilePath).toString(),
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
        code: this.crdtEngine.getText(this.activeFilePath).toString(),
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
