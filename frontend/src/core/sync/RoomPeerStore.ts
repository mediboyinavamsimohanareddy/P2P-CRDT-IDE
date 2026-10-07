import { WebRtcTransport } from '../transport/WebRtcTransport';

export interface ConnectedPeer {
  id: string;
  displayName: string;
  role: 'Host' | 'Peer';
  status: 'connected' | 'connecting' | 'offline';
  activity: string;
  color: string;
}

export class RoomPeerStore {
  private static instance: RoomPeerStore;
  private roomId: string | null = null;
  private localPeerId = 'peer-local-you';
  private peers: ConnectedPeer[] = [];
  private listeners: Array<() => void> = [];

  public static getInstance(): RoomPeerStore {
    if (!RoomPeerStore.instance) {
      RoomPeerStore.instance = new RoomPeerStore();
    }
    return RoomPeerStore.instance;
  }

  constructor() {
    // Generate a unique local peer ID per client tab/laptop instance
    this.localPeerId = 'peer-' + Math.random().toString(36).substring(2, 8);

    // Default initial state: Local peer only
    this.peers = [
      {
        id: this.localPeerId,
        displayName: `You (${this.localPeerId.substring(5)})`,
        role: 'Host',
        status: 'connected',
        activity: 'Editing active workspace',
        color: '#2EE6A6',
      },
    ];
  }

  setRoomId(roomId: string): void {
    this.roomId = roomId;

    // Automatically create WebRTC Transport instance for real P2P peer discovery if in browser environment
    if (typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined' && process.env.NODE_ENV !== 'test') {
      const transport = new WebRtcTransport(this.localPeerId, roomId);
      transport.onPeerState((peerId, state) => {
        if (state === 'connected') {
          this.addPeer({
            id: peerId,
            displayName: `Peer (${peerId.substring(0, 6)})`,
            role: 'Peer',
            status: 'connected',
            activity: 'Active in session',
            color: '#4D96FF',
          });
        } else if (state === 'offline') {
          this.removePeer(peerId);
        }
      });
      transport.start();
    }

    this.notify();
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  getLocalPeerId(): string {
    return this.localPeerId;
  }

  addPeer(peer: ConnectedPeer): void {
    const existingIndex = this.peers.findIndex((p) => p.id === peer.id);
    if (existingIndex >= 0) {
      this.peers[existingIndex] = peer;
    } else {
      this.peers.push(peer);
    }
    this.notify();
  }

  removePeer(peerId: string): void {
    this.peers = this.peers.filter((p) => p.id !== peerId);
    this.notify();
  }

  getPeers(): ConnectedPeer[] {
    return [...this.peers];
  }

  getConnectedPeerCount(): number {
    return this.peers.filter((p) => p.status === 'connected').length;
  }

  // Set connected room peers
  setRoomPeers(connectedPeers: ConnectedPeer[]): void {
    this.peers = connectedPeers.filter((p) => p.status === 'connected');
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}
