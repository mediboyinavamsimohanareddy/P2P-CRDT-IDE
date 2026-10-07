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
      if (typeof window !== 'undefined') {
        (window as any).__roomPeerStore = RoomPeerStore.instance;
      }
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

    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      // Poll room endpoint so peers in room registered via backend are shown
      const pollRoomPeers = async () => {
        try {
          const res = await fetch(`/api/rooms/${roomId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.peers)) {
              data.peers.forEach((pId: string) => {
                if (pId !== this.localPeerId) {
                  this.addPeer({
                    id: pId,
                    displayName: `Peer (${pId.length > 8 ? pId.substring(0, 6) : pId})`,
                    role: 'Peer',
                    status: 'connected',
                    activity: 'Connected in room',
                    color: '#4D96FF',
                  });
                }
              });
            }
          }
        } catch {
          // Fallback
        }
      };

      pollRoomPeers();
      setInterval(pollRoomPeers, 3000);
    }

    this.notify();
  };

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
    const local = this.peers.find((p) => p.id === this.localPeerId);
    const remotePeers = connectedPeers.filter((p) => p.status === 'connected' && p.id !== this.localPeerId);
    this.peers = local ? [local, ...remotePeers] : connectedPeers.filter((p) => p.status === 'connected');
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
