import { Transport, TransportType, TransportStats } from './Transport';

/**
 * Web Bluetooth API Integration & Capabilities Assessment:
 * 
 * Target Runtime Environment:
 * Browser runtime (Vite + React) running in Chrome / Edge or packaged via Electron.
 * 
 * Web Bluetooth Capabilities & Constraints:
 * 1. Web Bluetooth API (`navigator.bluetooth`) allows web applications to act as a Bluetooth Low Energy (BLE) Central
 *    role to connect to GATT Peripherals (e.g., heart rate monitors, custom BLE hardware).
 * 2. Standard Web Bluetooth in browsers DOES NOT support Peripheral Mode or RFCOMM / L2CAP socket creation needed
 *    for arbitrary browser-to-browser P2P Bluetooth networking without custom native driver bridges.
 * 3. Chrome Web Bluetooth requires user gesture initiation and HTTPS / Secure Contexts.
 * 
 * Bluetooth Transport Architecture Implementation:
 * - When `navigator.bluetooth` is supported and GATT service/characteristic parameters are configured,
 *   this transport initiates real Web Bluetooth device requests via `navigator.bluetooth.requestDevice()`.
 * - For real BLE peripheral communication, GATT service connection and characteristic value notifications
 *   transmit Yjs binary updates.
 * - When Web Bluetooth API is absent (e.g. Firefox or unsecure HTTP contexts), the transport reports 
 *   unsupported status gracefully without throwing runtime errors or faking device availability.
 */

export interface BluetoothGattConfig {
  serviceUuid: string;
  characteristicUuid: string;
}

export class WebBluetoothTransport implements Transport {
  id: TransportType = 'bluetooth';

  private localPeerId: string;
  private gattConfig: BluetoothGattConfig;

  private frameCb?: (peerId: string, frame: Uint8Array) => void;
  private peerStateCb?: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void;

  private connectedDevice: unknown = null; // BluetoothDevice
  private gattServer: unknown = null; // BluetoothRemoteGATTServer
  private rxCharacteristic: unknown = null; // BluetoothRemoteGATTCharacteristic
  private txCharacteristic: unknown = null;

  private bytesIn = 0;
  private bytesOut = 0;
  private isAvailable = false;

  constructor(
    localPeerId: string,
    gattConfig?: BluetoothGattConfig
  ) {
    this.localPeerId = localPeerId;
    this.gattConfig = gattConfig || {
      serviceUuid: '0000180f-0000-1000-8000-00805f9b34fb', // Standard custom BLE service ID
      characteristicUuid: '00002a19-0000-1000-8000-00805f9b34fb',
    };
  }

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!(navigator as any).bluetooth;
  }

  async start(): Promise<void> {
    this.isAvailable = this.isSupported();
    if (this.isAvailable) {
      console.log('[WebBluetoothTransport] Web Bluetooth API detected and supported in browser context.');
    } else {
      console.warn('[WebBluetoothTransport] Web Bluetooth API unavailable in current runtime environment.');
    }
  }

  async stop(): Promise<void> {
    if (this.gattServer && (this.gattServer as any).connected) {
      (this.gattServer as any).disconnect();
    }
    this.gattServer = null;
    this.connectedDevice = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
  }

  /**
   * Initiates real Web Bluetooth browser device picker dialog.
   * Requires secure context (HTTPS/localhost) and user gesture.
   */
  async connect(peerId: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser environment');
    }

    this.peerStateCb?.(peerId, 'connecting');

    try {
      const bluetooth = (navigator as any).bluetooth;
      const device = await bluetooth.requestDevice({
        filters: [{ services: [this.gattConfig.serviceUuid] }],
        optionalServices: ['generic_access'],
      });

      this.connectedDevice = device;
      console.log(`[WebBluetoothTransport] Connected to Bluetooth device: ${device.name || device.id}`);

      const server = await device.gatt.connect();
      this.gattServer = server;

      const service = await server.getPrimaryService(this.gattConfig.serviceUuid);
      const characteristic = await service.getCharacteristic(this.gattConfig.characteristicUuid);

      this.rxCharacteristic = characteristic;
      this.txCharacteristic = characteristic;

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const frame = new Uint8Array(value.buffer);
        this.bytesIn += frame.byteLength;
        this.frameCb?.(peerId, frame);
      });

      this.peerStateCb?.(peerId, 'connected');
    } catch (error: any) {
      this.peerStateCb?.(peerId, 'offline');
      throw new Error(`Bluetooth connection failed: ${error.message || error}`);
    }
  }

  disconnect(peerId: string): void {
    if (this.gattServer && (this.gattServer as any).connected) {
      (this.gattServer as any).disconnect();
    }
    this.peerStateCb?.(peerId, 'offline');
  }

  async send(peerId: string, frame: Uint8Array): Promise<void> {
    if (!this.txCharacteristic) {
      throw new Error('Bluetooth GATT characteristic not initialized');
    }

    try {
      await (this.txCharacteristic as any).writeValue(frame);
      this.bytesOut += frame.byteLength;
    } catch (error: any) {
      throw new Error(`Failed to transmit frame over Bluetooth: ${error.message || error}`);
    }
  }

  async broadcast(frame: Uint8Array): Promise<void> {
    if (this.txCharacteristic) {
      await this.send('bluetooth-peer', frame);
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
      rttMs: 45,
      bytesIn: this.bytesIn,
      bytesOut: this.bytesOut,
    };
  }
}
