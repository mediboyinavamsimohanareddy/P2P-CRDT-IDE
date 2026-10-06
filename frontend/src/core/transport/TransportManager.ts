import { Transport, TransportType, TransportStats } from './Transport';

export class TransportManager {
  private transports = new Map<TransportType, Transport>();
  private activeTransportType: TransportType = 'webrtc';
  private frameListeners: Array<(peerId: string, frame: Uint8Array) => void> = [];
  private peerStateListeners: Array<(peerId: string, state: 'connecting' | 'connected' | 'offline') => void> = [];

  registerTransport(transport: Transport): void {
    this.transports.set(transport.id, transport);

    transport.onFrame((peerId, frame) => {
      this.frameListeners.forEach((cb) => cb(peerId, frame));
    });

    transport.onPeerState((peerId, state) => {
      this.peerStateListeners.forEach((cb) => cb(peerId, state));
    });
  }

  async startAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      await transport.start();
    }
  }

  async stopAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      await transport.stop();
    }
  }

  selectTransport(type: TransportType): Transport | undefined {
    this.activeTransportType = type;
    return this.transports.get(type);
  }

  async send(peerId: string, frame: Uint8Array): Promise<void> {
    const transport = this.transports.get(this.activeTransportType);
    if (!transport) throw new Error(`Transport ${this.activeTransportType} not found`);
    await transport.send(peerId, frame);
  }

  async broadcast(frame: Uint8Array): Promise<void> {
    for (const transport of this.transports.values()) {
      await transport.broadcast(frame);
    }
  }

  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void {
    this.frameListeners.push(cb);
  }

  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void {
    this.peerStateListeners.push(cb);
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
}
