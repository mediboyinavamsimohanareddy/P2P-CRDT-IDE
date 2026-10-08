import { Transport, TransportType, TransportStats } from './Transport';
import { SignalingConfig } from '../sync/SignalingConfig';

export interface LanDiscoveryAnnouncement {
  type: 'LAN_DISCOVERY_ANNOUNCE' | 'LAN_DISCOVERY_RESPONSE';
  peerId: string;
  displayName: string;
  workspaceId: string;
  port: number;
  protocolVersion: string;
}

export interface LanTransportOptions {
  /** BroadcastChannel is same-origin only. Jury path must use the host LAN relay WebSocket. */
  testBroadcast?: boolean;
}

interface RelayEnvelope {
  from: string;
  target?: string;
  workspaceId: string;
  payloadB64: string;
}

export class LanTransport implements Transport {
  id: TransportType = 'lan';

  private localPeerId: string;
  private workspaceId: string;
  private displayName: string;
  private testBroadcast: boolean;

  private frameCb?: (peerId: string, frame: Uint8Array) => void;
  private peerStateCb?: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void;

  private connectedPeers = new Map<string, { connectionType: 'relay' | 'broadcast' }>();
  private activeLocalChannel: BroadcastChannel | null = null;
  private relayWs: WebSocket | null = null;

  private bytesIn = 0;
  private bytesOut = 0;
  private lastRttMs = 5;

  constructor(localPeerId: string, workspaceId: string, displayName?: string, options?: LanTransportOptions) {
    this.localPeerId = localPeerId;
    this.workspaceId = workspaceId;
    this.displayName = displayName || `LAN-Peer-${localPeerId.substring(0, 4)}`;
    this.testBroadcast = !!options?.testBroadcast;
  }

  async start(): Promise<void> {
    if (this.testBroadcast && typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      this.startBroadcastChannel();
      return;
    }
    await this.startRelay();
  }

  async stop(): Promise<void> {
    if (this.activeLocalChannel) {
      this.activeLocalChannel.close();
      this.activeLocalChannel = null;
    }
    if (this.relayWs) {
      this.relayWs.close();
      this.relayWs = null;
    }
    for (const [peerId] of this.connectedPeers) {
      this.peerStateCb?.(peerId, 'offline');
    }
    this.connectedPeers.clear();
  }

  async connect(peerId: string): Promise<void> {
    if (this.connectedPeers.has(peerId)) return;
    this.peerStateCb?.(peerId, 'connecting');
    this.announcePresence();
  }

  disconnect(peerId: string): void {
    if (this.connectedPeers.has(peerId)) {
      this.connectedPeers.delete(peerId);
      this.peerStateCb?.(peerId, 'offline');
    }
  }

  async send(peerId: string, frame: Uint8Array): Promise<void> {
    this.postFrame(frame, peerId);
  }

  async broadcast(frame: Uint8Array): Promise<void> {
    this.postFrame(frame);
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

  private async startRelay(): Promise<void> {
    if (typeof WebSocket === 'undefined') {
      return;
    }
    return new Promise((resolve) => {
      try {
        const url = SignalingConfig.getInstance().lanRelayWsUrl(this.workspaceId);
        this.relayWs = new WebSocket(url);
        this.relayWs.onopen = () => {
          this.announcePresence();
          resolve();
        };
        this.relayWs.onmessage = (evt) => {
          this.handleRelayMessage(typeof evt.data === 'string' ? evt.data : '');
        };
        this.relayWs.onerror = () => resolve();
        this.relayWs.onclose = () => {
          for (const [peerId] of this.connectedPeers) {
            this.peerStateCb?.(peerId, 'offline');
          }
          this.connectedPeers.clear();
        };
      } catch {
        resolve();
      }
    });
  }

  private startBroadcastChannel(): void {
    const channelName = `decentraide-lan-${this.workspaceId}`;
    this.activeLocalChannel = new BroadcastChannel(channelName);
    this.activeLocalChannel.onmessage = (evt) => {
      const data = evt.data;
      if (typeof data === 'string') {
        this.handleRelayMessage(data);
        return;
      }
    };
    this.announcePresence();
  }

  private handleRelayMessage(raw: string): void {
    try {
      const env = JSON.parse(raw) as RelayEnvelope | LanDiscoveryAnnouncement;
      if ('type' in env && (env.type === 'LAN_DISCOVERY_ANNOUNCE' || env.type === 'LAN_DISCOVERY_RESPONSE')) {
        if (env.peerId !== this.localPeerId && env.workspaceId === this.workspaceId) {
          if (!this.connectedPeers.has(env.peerId)) {
            this.connectedPeers.set(env.peerId, { connectionType: this.relayWs ? 'relay' : 'broadcast' });
            this.peerStateCb?.(env.peerId, 'connected');
            if (env.type === 'LAN_DISCOVERY_ANNOUNCE') {
              this.sendDiscoveryResponse(env.peerId);
            }
          }
        }
        return;
      }
      const envelope = env as RelayEnvelope;
      if (!envelope.from || envelope.from === this.localPeerId) return;
      if (envelope.workspaceId && envelope.workspaceId !== this.workspaceId) return;
      if (envelope.target && envelope.target !== this.localPeerId) return;

      if (!this.connectedPeers.has(envelope.from)) {
        this.connectedPeers.set(envelope.from, { connectionType: this.relayWs ? 'relay' : 'broadcast' });
        this.peerStateCb?.(envelope.from, 'connected');
      }

      const payload = this.b64ToBytes(envelope.payloadB64);
      this.bytesIn += payload.byteLength;
      this.frameCb?.(envelope.from, payload);
    } catch {
      // ignore malformed relay frames
    }
  }

  private postFrame(frame: Uint8Array, target?: string): void {
    const envelope: RelayEnvelope = {
      from: this.localPeerId,
      target,
      workspaceId: this.workspaceId,
      payloadB64: this.bytesToB64(frame),
    };
    const json = JSON.stringify(envelope);
    this.bytesOut += frame.byteLength;
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      this.relayWs.send(json);
    } else if (this.activeLocalChannel) {
      this.activeLocalChannel.postMessage(json);
    }
  }

  private announcePresence(): void {
    const announcement: LanDiscoveryAnnouncement = {
      type: 'LAN_DISCOVERY_ANNOUNCE',
      peerId: this.localPeerId,
      displayName: this.displayName,
      workspaceId: this.workspaceId,
      port: 8082,
      protocolVersion: '1.0.0',
    };
    const json = JSON.stringify(announcement);
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      this.relayWs.send(json);
    } else if (this.activeLocalChannel) {
      this.activeLocalChannel.postMessage(json);
    }
  }

  private sendDiscoveryResponse(targetPeerId: string): void {
    const response = {
      type: 'LAN_DISCOVERY_RESPONSE' as const,
      peerId: this.localPeerId,
      displayName: this.displayName,
      workspaceId: this.workspaceId,
      port: 8082,
      protocolVersion: '1.0.0',
      target: targetPeerId,
    };
    const json = JSON.stringify(response);
    if (this.relayWs && this.relayWs.readyState === WebSocket.OPEN) {
      this.relayWs.send(json);
    } else if (this.activeLocalChannel) {
      this.activeLocalChannel.postMessage(json);
    }
  }

  private bytesToB64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private b64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }
}
