import { YjsCrdtEngine, CrdtEngine } from '../crdt/CrdtEngine';
import { TransportManager } from '../transport/TransportManager';
import { WebRtcTransport } from '../transport/WebRtcTransport';
import { LanTransport } from '../transport/LanTransport';
import { WebBluetoothTransport } from '../transport/WebBluetoothTransport';
import { RoomPeerStore } from './RoomPeerStore';
import { SecurityPipeline, MembershipList } from '../security/SecurityPipeline';
import { SecurityManager, CryptoIdentity } from '../security/SecurityManager';
import { OpLogManager } from '../crdt/OpLogManager';
import { LocalPersistenceManager } from '../../services/LocalPersistenceManager';
import { OperationLogStore } from '../security/OperationLogStore';
import { Frame } from '@decentraide/shared';

export class CollaborationManager {
  private static instance: CollaborationManager;

  private crdtEngine: YjsCrdtEngine;
  private transportManager: TransportManager;
  private peerStore: RoomPeerStore;
  private persistenceManager: LocalPersistenceManager;
  private opLogManager: OpLogManager;
  private securityPipeline: SecurityPipeline;
  private identity: CryptoIdentity;
  private projectKey: Buffer;
  private membership: MembershipList;

  private isStarted = false;
  private currentRoomId: string | null = null;
  private activeFilePath: string = 'src/main/java/Main.java';

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
    this.projectKey = SecurityManager.generateSymmetricKey();

    this.membership = {
      projectId: 'decentraide-workspace',
      ownerPeerId: this.peerStore.getLocalPeerId(),
      members: new Map([
        [
          this.peerStore.getLocalPeerId(),
          { role: 'Owner', publicKeyPem: this.identity.publicKeyPem },
        ],
      ]),
      ownerSignature: 'sig-owner',
    };

    this.persistenceManager = new LocalPersistenceManager('workspace');
    this.opLogManager = new OpLogManager(this.crdtEngine, this.persistenceManager);

    this.securityPipeline = new SecurityPipeline(
      this.membership,
      this.projectKey,
      (evt) => {
        OperationLogStore.getInstance().logRejectedSecurityEvent(evt, this.activeFilePath);
      }
    );

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

  public setActiveFilePath(filePath: string): void {
    this.activeFilePath = filePath;
  }

  public async startSession(roomId: string): Promise<void> {
    this.currentRoomId = roomId;
    this.peerStore.setRoomId(roomId);
    this.transportManager.setWorkspaceId(roomId);

    if (!this.isStarted) {
      const localId = this.peerStore.getLocalPeerId();

      // 1. WebRTC Transport
      const webrtc = new WebRtcTransport(localId, roomId);
      this.transportManager.registerTransport(webrtc);

      // 2. LAN Transport (BroadcastChannel / Local Subnet)
      const lan = new LanTransport(localId, roomId, `Peer (${localId.substring(5)})`);
      this.transportManager.registerTransport(lan);

      // 3. Web Bluetooth Transport
      const bt = new WebBluetoothTransport(localId);
      this.transportManager.registerTransport(bt);

      await this.transportManager.startAll();
      this.isStarted = true;
    }

    // Load any saved CRDT snapshot from local persistence
    const savedSnapshot = await this.persistenceManager.getCrdtSnapshot();
    if (savedSnapshot && savedSnapshot.length > 0) {
      try {
        this.crdtEngine.applyUpdate(savedSnapshot, 'local-persistence');
      } catch (e) {
        console.warn('[CollaborationManager] Could not load saved snapshot:', e);
      }
    }
  }

  private setupTransportListeners(): void {
    // Process incoming raw transport frames through Security Pipeline
    this.transportManager.onFrame((peerId, frameBytes) => {
      try {
        // Automatically add dynamic peer to membership list if not present (Open room membership)
        if (!this.membership.members.has(peerId)) {
          this.membership.members.set(peerId, {
            role: 'Developer',
            publicKeyPem: this.identity.publicKeyPem, // Trust in peer room
          });
        }

        let frameObj: unknown;
        try {
          const frameStr = new TextDecoder().decode(frameBytes);
          frameObj = JSON.parse(frameStr);
        } catch {
          // Raw Yjs update fallback or binary payload
          this.crdtEngine.applyUpdate(frameBytes, `remote-${peerId}`);
          OperationLogStore.getInstance().logAppliedOp(peerId, 'SYNC', this.activeFilePath);
          return;
        }

        // Pass through Security Pipeline
        const result = this.securityPipeline.processIncomingFrame(frameObj);
        if (result.success && result.decryptedPayload) {
          const payloadObj = JSON.parse(result.decryptedPayload);
          if (payloadObj.u) {
            const updateBytes = new Uint8Array(Buffer.from(payloadObj.u, 'base64'));
            this.crdtEngine.applyUpdate(updateBytes, `remote-${peerId}`);
            OperationLogStore.getInstance().logAppliedOp(peerId, 'UPDATE', this.activeFilePath);
            this.saveSnapshotDebounced();
          }
        }
      } catch (e) {
        console.warn('[CollaborationManager] Frame processing error:', e);
      }
    });

    // On handshake completed / sync needed, exchange Yjs state vector updates
    this.transportManager.onPeerState((peerId, state) => {
      if (state === 'connected') {
        this.sendStateVectorToPeer(peerId);
        this.flushPendingOfflineOps();
      }
    });
  }

  private setupCrdtListeners(): void {
    // Listen for local CRDT edits and broadcast to peers
    this.crdtEngine.onUpdate((update, origin) => {
      if (origin.startsWith('remote')) return; // Ignore updates that came from remote peers

      // Queue op for offline persistence
      this.opLogManager.enqueueLocalUpdate(update);
      this.saveSnapshotDebounced();

      // Package update into signed frame and broadcast
      const payloadObj = {
        u: Buffer.from(update).toString('base64'),
        filePath: this.activeFilePath,
      };
      const payloadStr = JSON.stringify(payloadObj);

      const encrypted = SecurityManager.encrypt(payloadStr, this.projectKey);
      const encryptedPayloadStr = JSON.stringify(encrypted);

      const signature = SecurityManager.signData(encryptedPayloadStr, this.identity.privateKeyPem);

      const frame: Frame = {
        v: 1,
        type: 'crdt.update',
        projectId: this.currentRoomId || 'default-workspace',
        from: this.peerStore.getLocalPeerId(),
        opId: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        lamport: Date.now(),
        ts: Date.now(),
        payload: encryptedPayloadStr,
        sig: signature,
      };

      const frameBytes = new TextEncoder().encode(JSON.stringify(frame));
      this.transportManager.broadcast(frameBytes).catch(() => {
        // Offline broadcast failure handled gracefully
      });
    });
  }

  private sendStateVectorToPeer(peerId: string): void {
    try {
      const stateUpdate = this.crdtEngine.encodeStateAsUpdate();
      const payloadObj = {
        u: Buffer.from(stateUpdate).toString('base64'),
        filePath: this.activeFilePath,
      };
      const payloadStr = JSON.stringify(payloadObj);

      const encrypted = SecurityManager.encrypt(payloadStr, this.projectKey);
      const encryptedPayloadStr = JSON.stringify(encrypted);

      const signature = SecurityManager.signData(encryptedPayloadStr, this.identity.privateKeyPem);

      const frame: Frame = {
        v: 1,
        type: 'crdt.syncStep2',
        projectId: this.currentRoomId || 'default-workspace',
        from: this.peerStore.getLocalPeerId(),
        opId: `op-sync-${Date.now()}`,
        lamport: Date.now(),
        ts: Date.now(),
        payload: encryptedPayloadStr,
        sig: signature,
      };

      const frameBytes = new TextEncoder().encode(JSON.stringify(frame));
      this.transportManager.send(peerId, frameBytes).catch(() => {});
    } catch (e) {
      console.warn('[CollaborationManager] Failed to send state vector to peer:', peerId, e);
    }
  }

  private flushPendingOfflineOps(): void {
    this.opLogManager.flushQueue((op) => {
      try {
        const payloadObj = {
          u: Buffer.from(op.update).toString('base64'),
          filePath: this.activeFilePath,
        };
        const payloadStr = JSON.stringify(payloadObj);
        const encrypted = SecurityManager.encrypt(payloadStr, this.projectKey);
        const encryptedPayloadStr = JSON.stringify(encrypted);
        const signature = SecurityManager.signData(encryptedPayloadStr, this.identity.privateKeyPem);

        const frame: Frame = {
          v: 1,
          type: 'crdt.update',
          projectId: this.currentRoomId || 'default-workspace',
          from: this.peerStore.getLocalPeerId(),
          opId: op.id,
          lamport: op.timestamp,
          ts: op.timestamp,
          payload: encryptedPayloadStr,
          sig: signature,
        };

        const frameBytes = new TextEncoder().encode(JSON.stringify(frame));
        this.transportManager.broadcast(frameBytes);
        return true;
      } catch {
        return false;
      }
    });
  }

  private saveTimeout: any = null;
  private saveSnapshotDebounced(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      const snapshot = this.crdtEngine.encodeStateAsUpdate();
      this.persistenceManager.saveCrdtSnapshot(snapshot);
    }, 1000);
  }
}
