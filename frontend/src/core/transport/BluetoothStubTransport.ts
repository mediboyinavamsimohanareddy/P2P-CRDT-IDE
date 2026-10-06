import { Transport, TransportType, TransportStats } from './Transport';

export class BluetoothStubTransport implements Transport {
  id: TransportType = 'bluetooth';
  private frameCb?: (peerId: string, frame: Uint8Array) => void;
  private stateCb?: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void;

  async start(): Promise<void> {
    console.log('[BluetoothStub] Bluetooth transport initialized (stub)');
  }

  async stop(): Promise<void> {}

  async connect(_peerId: string): Promise<void> {
    throw new Error('Bluetooth transport is a stub and not implemented');
  }

  disconnect(_peerId: string): void {}

  async send(_peerId: string, _frame: Uint8Array): Promise<void> {
    throw new Error('Bluetooth transport is a stub and not implemented');
  }

  async broadcast(_frame: Uint8Array): Promise<void> {}

  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void {
    this.frameCb = cb;
  }

  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void {
    this.stateCb = cb;
  }

  stats(): TransportStats {
    return { rttMs: 0, bytesIn: 0, bytesOut: 0 };
  }
}
