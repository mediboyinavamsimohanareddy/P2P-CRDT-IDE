import { Transport, TransportType, TransportStats } from './Transport';
import { RoomPeerStore } from '../sync/RoomPeerStore';

export type TransportPriority = 'webrtc' | 'lan' | 'bluetooth' | 'local';

export interface TransportManagerEvents {
  onActiveTransportChanged?: (type: TransportType | 'local', activeTransport: Transport | null) => void;
  onHandshakeCompleted?: (peerId: string, metadata: { workspaceId?: string; protocolVersion?: string }) => void;
  onSyncNeeded?: (peerId: string) => void;
}

export interface PeerHandshakeMessage {
  type: 'HANDSHAKE_HELLO' | 'HANDSHAKE_ACK';
  peerId: string;
  workspaceId: string;
  protocolVersion: string;
  capabilities: string[];
}

export class TransportManager {
  private transports = new Map<TransportType, Transport>();
  private activeTransportType: TransportType | 'local' = 'webrtc';
  private frameListeners: Array<(peerId: string, frame: Uint8Array) => void> = [];
  private peerStateListeners: Array<(peerId: string, state: 'connecting' | 'connected' | 'offline') => void> = [];
  private activeTransportListeners: Array<(type: TransportType | 'local') => void> = [];

  private connectedPeersByTransport = new Map<TransportType, Set<string>>();
  private knownPeers = new Map<string, { workspaceId?: string; protocolVersion?: string; activeTransport?: TransportType }>();
  
  private currentWorkspaceId: string = 'default-workspace';
  private protocolVersion: string = '1.0.0';

  constructor(workspaceId?: string) {
    if (workspaceId) {
      this.currentWorkspaceId = workspaceId;
    }
    this.connectedPeersByTransport.set('webrtc', new Set());
    this.connectedPeersByTransport.set('lan', new Set());
    this.connectedPeersByTransport.set('bluetooth', new Set());
  }

  setWorkspaceId(workspaceId: string): void {
    this.currentWorkspaceId = workspaceId;
  }

  getWorkspaceId(): string {
    return this.currentWorkspaceId;
  }

  registerTransport(transport: Transport): void {
    this.transports.set(transport.id, transport);
    if (!this.connectedPeersByTransport.has(transport.id)) {
      this.connectedPeersByTransport.set(transport.id, new Set());
    }

    transport.onFrame((peerId, frame) => {
      // Check if this frame is a handshake protocol message
      if (this.isHandshakeFrame(frame)) {
        this.handleHandshakeFrame(peerId, transport.id, frame);
        return;
      }
      this.frameListeners.forEach((cb) => cb(peerId, frame));
    });

      transport.onPeerState((peerId, state) => {
        const peerSet = this.connectedPeersByTransport.get(transport.id)!;
        if (state === 'connected') {
          peerSet.add(peerId);
          // Evaluate priority and activate this transport if it is higher priority or active
          this.evaluateFailoverPolicy();

          // Add to RoomPeerStore dynamic live peers list
          const store = this.getRoomPeerStore();
          if (store && store.addPeer) {
            store.addPeer({
              id: peerId,
              displayName: `Peer (${peerId.length > 8 ? peerId.substring(0, 6) : peerId})`,
              role: 'Peer',
              status: 'connected',
              activity: `Connected via ${transport.id.toUpperCase()}`,
              color: transport.id === 'lan' ? '#36B37E' : transport.id === 'bluetooth' ? '#FFAB00' : '#4D96FF',
            });
          }
          // Initiate Handshake
          this.sendHandshake(peerId, transport.id, 'HANDSHAKE_HELLO');
        } else if (state === 'offline') {
          peerSet.delete(peerId);
          this.knownPeers.delete(peerId);
          this.evaluateFailoverPolicy();

          const store = this.getRoomPeerStore();
          if (store && store.removePeer) {
            store.removePeer(peerId);
          }
        }

        this.peerStateListeners.forEach((cb) => cb(peerId, state));
      });
  }

  async startAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      try {
        await transport.start();
      } catch (err) {
        console.warn(`[TransportManager] Transport ${transport.id} failed to start:`, err);
      }
    }
    this.evaluateFailoverPolicy();
  }

  async stopAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      await transport.stop();
    }
    this.connectedPeersByTransport.forEach((set) => set.clear());
    this.evaluateFailoverPolicy();
  }

  selectTransport(type: TransportType | 'local'): Transport | undefined {
    this.activeTransportType = type;
    this.activeTransportListeners.forEach((cb) => cb(type));
    if (type === 'local') return undefined;
    return this.transports.get(type);
  }

  getActiveTransportType(): TransportType | 'local' {
    return this.activeTransportType;
  }

  getTransport(type: TransportType): Transport | undefined {
    return this.transports.get(type);
  }

  /**
   * Transport Failover Policy:
   * Priority 1: WebRTC (Internet)
   * Priority 2: LAN / Wi-Fi
   * Priority 3: Bluetooth (when supported and connected)
   * Priority 4: Local-only mode
   */
  evaluateFailoverPolicy(): TransportType | 'local' {
    const webRtcPeers = this.connectedPeersByTransport.get('webrtc')?.size || 0;
    const lanPeers = this.connectedPeersByTransport.get('lan')?.size || 0;
    const btPeers = this.connectedPeersByTransport.get('bluetooth')?.size || 0;

    let selected: TransportType | 'local' = 'local';

    if (webRtcPeers > 0) {
      selected = 'webrtc';
    } else if (lanPeers > 0) {
      selected = 'lan';
    } else if (btPeers > 0) {
      selected = 'bluetooth';
    } else {
      selected = 'local';
    }

    if (selected !== this.activeTransportType) {
      this.selectTransport(selected);
    }

    return selected;
  }

  async send(peerId: string, frame: Uint8Array): Promise<void> {
    if (this.activeTransportType === 'local') {
      throw new Error('Cannot send frame in local-only mode');
    }
    const transport = this.transports.get(this.activeTransportType as TransportType);
    if (!transport) throw new Error(`Transport ${this.activeTransportType} not found or active`);
    await transport.send(peerId, frame);
  }

  async broadcast(frame: Uint8Array): Promise<void> {
    if (this.activeTransportType === 'local') {
      // In local mode, frame is queued/retained for later sync
      return;
    }
    const transport = this.transports.get(this.activeTransportType as TransportType);
    if (transport && this.connectedPeersByTransport.get(this.activeTransportType as TransportType)?.size! > 0) {
      await transport.broadcast(frame);
    } else {
      // Broadcast across all connected transports
      for (const [tType, t] of this.transports.entries()) {
        const connectedCount = this.connectedPeersByTransport.get(tType)?.size || 0;
        if (connectedCount > 0) {
          try {
            await t.broadcast(frame);
          } catch (e) {
            // ignore individual transport broadcast failures
          }
        }
      }
    }
  }

  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void {
    this.frameListeners.push(cb);
  }

  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void {
    this.peerStateListeners.push(cb);
  }

  onActiveTransportChanged(cb: (type: TransportType | 'local') => void): void {
    this.activeTransportListeners.push(cb);
  }

  getAggregateStats(): TransportStats {
    let rttMs = 0;
    let bytesIn = 0;
    let bytesOut = 0;

    for (const transport of this.transports.values()) {
      const s = transport.stats();
      rttMs = Math.max(rttMs, s.rttMs);
      bytesIn += s.bytesIn;
      bytesOut += s.bytesOut;
    }

    return { rttMs, bytesIn, bytesOut };
  }

  private isHandshakeFrame(frame: Uint8Array): boolean {
    if (frame.length < 12) return false;
    const header = new TextDecoder().decode(frame.slice(0, 12));
    return header === '{"type":"HAN';
  }

  private getRoomPeerStore() {
    return RoomPeerStore.getInstance();
  }

  private sendHandshake(peerId: string, transportType: TransportType, type: 'HANDSHAKE_HELLO' | 'HANDSHAKE_ACK'): void {
    const transport = this.transports.get(transportType);
    if (!transport) return;

    const payload: PeerHandshakeMessage = {
      type,
      peerId: this.getRoomPeerStore()?.getLocalPeerId() || 'local-peer',
      workspaceId: this.currentWorkspaceId,
      protocolVersion: this.protocolVersion,
      capabilities: ['crdt-yjs', 'lan-discovery'],
    };

    const encoder = new TextEncoder();
    const frame = encoder.encode(JSON.stringify(payload));
    transport.send(peerId, frame).catch(() => {});
  }

  private handleHandshakeFrame(peerId: string, transportType: TransportType, frame: Uint8Array): void {
    try {
      const text = new TextDecoder().decode(frame);
      const msg: PeerHandshakeMessage = JSON.parse(text);

      if (msg.workspaceId !== this.currentWorkspaceId) {
        console.warn(`[TransportManager] Rejecting peer ${peerId}: workspace mismatch (${msg.workspaceId} vs ${this.currentWorkspaceId})`);
        return;
      }

      this.knownPeers.set(peerId, {
        workspaceId: msg.workspaceId,
        protocolVersion: msg.protocolVersion,
        activeTransport: transportType,
      });

      if (msg.type === 'HANDSHAKE_HELLO') {
        this.sendHandshake(peerId, transportType, 'HANDSHAKE_ACK');
      }

      console.log(`[TransportManager] Handshake completed with peer ${peerId} via ${transportType}`);
    } catch (e) {
      console.error('[TransportManager] Invalid handshake payload:', e);
    }
  }
}
