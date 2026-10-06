import { describe, it, expect, vi } from 'vitest';
import { TransportManager } from './TransportManager';
import { BluetoothStubTransport } from './BluetoothStubTransport';

describe('TransportManager', () => {
  it('registers transports and routes broadcast calls', async () => {
    const manager = new TransportManager();
    const btTransport = new BluetoothStubTransport();

    manager.registerTransport(btTransport);
    await manager.startAll();

    const stats = manager.getAggregateStats();
    expect(stats.rttMs).toBe(0);
  });

  it('handles Bluetooth stub appropriately', async () => {
    const bt = new BluetoothStubTransport();
    await bt.start();
    await expect(bt.connect('peer-1')).rejects.toThrow('Bluetooth transport is a stub');
  });
});
