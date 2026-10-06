export type TransportType = 'webrtc' | 'lan' | 'bluetooth';

export interface TransportStats {
  rttMs: number;
  bytesIn: number;
  bytesOut: number;
}

export interface Transport {
  id: TransportType;
  start(): Promise<void>;
  stop(): Promise<void>;
  connect(peerId: string, hint?: unknown): Promise<void>;
  disconnect(peerId: string): void;
  send(peerId: string, frame: Uint8Array): Promise<void>;
  broadcast(frame: Uint8Array): Promise<void>;
  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void;
  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void;
  stats(): TransportStats;
}
