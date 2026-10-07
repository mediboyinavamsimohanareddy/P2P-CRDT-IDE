import { Transport, TransportType, TransportStats } from './Transport';

export interface LanDiscoveryAnnouncement {
  type: 'LAN_DISCOVERY_ANNOUNCE' | 'LAN_DISCOVERY_RESPONSE';
  peerId: string;
  displayName: string;
  workspaceId: string;
  port: number;
  protocolVersion: string;
}

export class LanTransport implements Transport {
  id: TransportType = 'lan';

  private localPeerId: string;
  private workspaceId: string;
  private displayName: string;

  private frameCb?: (peerId: string, frame: Uint8Array) => void;
  private peerStateCb?: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void;

  private connectedPeers = new Map<string, { socket?: WebSocket; connectionType: 'direct' | 'broadcast' }>();
  private activeLocalChannel: BroadcastChannel | null = null;

  private bytesIn = 0;
  private bytesOut = 0;
  private lastRttMs = 5;

  constructor(localPeerId: string, workspaceId: string, displayName?: string) {
    this.localPeerId = localPeerId;
    this.workspaceId = workspaceId;
    this.displayName = displayName || `LAN-Peer-${localPeerId.substring(0, 4)}`;
  }

  async start(): Promise<void> {
    // Setup local subnet broadcast channel using BroadcastChannel API
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      const channelName = `decentraide-lan-${this.workspaceId}`;
      this.activeLocalChannel = new BroadcastChannel(channelName);

      this.activeLocalChannel.onmessage = (evt) => {
        const data = evt.data;
        if (!data || !(data instanceof Uint8Array || data.buffer)) return;

        let frame: Uint8Array;
        if (data instanceof Uint8Array) {
          frame = data;
        } else {
          frame = new Uint8Array(data.buffer);
        }

        // Extract sender header if encoded
        const headerEnd = this.findHeaderEnd(frame);
        if (headerEnd !== -1) {
          const headerStr = new TextDecoder().decode(frame.slice(0, headerEnd));
          try {
            const header = JSON.parse(headerStr);
            if (header.from === this.localPeerId) return; // ignore self
            if (header.workspaceId && header.workspaceId !== this.workspaceId) return;

            const payload = frame.slice(headerEnd + 1);
            
            if (!this.connectedPeers.has(header.from)) {
              this.connectedPeers.set(header.from, { connectionType: 'broadcast' });
              this.peerStateCb?.(header.from, 'connected');
            }

            this.bytesIn += payload.byteLength;
            this.frameCb?.(header.from, payload);
          } catch (e) {
            // Raw frame without header
            this.frameCb?.('lan-peer-broadcast', frame);
          }
        }
      };

      console.log(`[LanTransport] Local LAN Broadcast Channel initialized for workspace: ${this.workspaceId}`);
    }

    // Announce presence on LAN
    this.announcePresence();
  }

  async stop(): Promise<void> {
    if (this.activeLocalChannel) {
      this.activeLocalChannel.close();
      this.activeLocalChannel = null;
    }

    for (const [peerId] of this.connectedPeers) {
      this.peerStateCb?.(peerId, 'offline');
    }
    this.connectedPeers.clear();
  }

  async connect(peerId: string): Promise<void> {
    if (this.connectedPeers.has(peerId)) return;

    this.peerStateCb?.(peerId, 'connecting');
    this.connectedPeers.set(peerId, { connectionType: 'broadcast' });
    this.peerStateCb?.(peerId, 'connected');

    // Send LAN Discovery Announce
    this.announcePresence();
  }

  disconnect(peerId: string): void {
    if (this.connectedPeers.has(peerId)) {
      this.connectedPeers.delete(peerId);
      this.peerStateCb?.(peerId, 'offline');
    }
  }

  async send(peerId: string, frame: Uint8Array): Promise<void> {
    if (this.activeLocalChannel) {
      const header = JSON.stringify({ from: this.localPeerId, target: peerId, workspaceId: this.workspaceId });
      const headerBytes = new TextEncoder().encode(header + '\n');
      const combined = new Uint8Array(headerBytes.length + frame.length);
      combined.set(headerBytes, 0);
      combined.set(frame, headerBytes.length);

      this.activeLocalChannel.postMessage(combined);
      this.bytesOut += combined.byteLength;
    }
  }

  async broadcast(frame: Uint8Array): Promise<void> {
    if (this.activeLocalChannel) {
      const header = JSON.stringify({ from: this.localPeerId, workspaceId: this.workspaceId });
      const headerBytes = new TextEncoder().encode(header + '\n');
      const combined = new Uint8Array(headerBytes.length + frame.length);
      combined.set(headerBytes, 0);
      combined.set(frame, headerBytes.length);

      this.activeLocalChannel.postMessage(combined);
      this.bytesOut += combined.byteLength;
    }
  }

  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void {
    this.frameCb = cb;
  }

  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void {
    this.peerStateCb = cb;
  }

  stats(): TransportStats {
    return {
      rttMs: this.lastRttMs,
      bytesIn: this.bytesIn,
      bytesOut: this.bytesOut,
    };
  }

  private announcePresence(): void {
    if (this.activeLocalChannel) {
      const announcement: LanDiscoveryAnnouncement = {
        type: 'LAN_DISCOVERY_ANNOUNCE',
        peerId: this.localPeerId,
        displayName: this.displayName,
        workspaceId: this.workspaceId,
        port: 8082,
        protocolVersion: '1.0.0',
      };

      const headerBytes = new TextEncoder().encode(JSON.stringify({ from: this.localPeerId, workspaceId: this.workspaceId }) + '\n');
      const payloadBytes = new TextEncoder().encode(JSON.stringify(announcement));
      const combined = new Uint8Array(headerBytes.length + payloadBytes.length);
      combined.set(headerBytes, 0);
      combined.set(payloadBytes, headerBytes.length);

      this.activeLocalChannel.postMessage(combined);
    }
  }

  private findHeaderEnd(frame: Uint8Array): number {
    for (let i = 0; i < frame.length; i++) {
      if (frame[i] === 10) return i; // '\n'
    }
    return -1;
  }
}
