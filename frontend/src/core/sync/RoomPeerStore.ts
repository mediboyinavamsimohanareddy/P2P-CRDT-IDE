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
    // Default initial state: Local peer only (1 peer connected) until room joining/connecting
    this.peers = [
      {
        id: this.localPeerId,
        displayName: 'You (Local Host)',
        role: 'Host',
        status: 'connected',
        activity: 'Editing active workspace',
        color: '#2EE6A6',
      },
    ];
  }

  setRoomId(roomId: string): void {
    this.roomId = roomId;
    this.notify();
  }

  getRoomId(): string | null {
    return this.roomId;
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

  // Helper for demo/multi-peer room simulation
  connectDemoRoomPeers(roomId: string): void {
    this.roomId = roomId;
    this.peers = [
      {
        id: 'peer-local-you',
        displayName: 'Arjun (You)',
        role: 'Host',
        status: 'connected',
        activity: 'Editing LoginService.java',
        color: '#2EE6A6',
      },
      {
        id: 'peer-rahul',
        displayName: 'Rahul',
        role: 'Peer',
        status: 'connected',
        activity: 'Reviewing auth policy',
        color: '#4D96FF',
      },
      {
        id: 'peer-mohammed',
        displayName: 'Mohammed',
        role: 'Peer',
        status: 'connected',
        activity: 'Running verification',
        color: '#6BCB77',
      },
    ];
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
