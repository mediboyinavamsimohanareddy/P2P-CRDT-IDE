import { describe, it, expect, vi } from 'vitest';
import { TransportManager } from './TransportManager';
import { BluetoothStubTransport } from './BluetoothStubTransport';
import { LanTransport } from './LanTransport';
import { RoomPeerStore } from '../sync/RoomPeerStore';

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

  it('updates RoomPeerStore and triggers peerStateListeners when peer connects via transport', () => {
    const store = RoomPeerStore.getInstance();
    const manager = new TransportManager('test-room');
    const lan = new LanTransport('peer-A', 'test-room', undefined, { testBroadcast: true });

    manager.registerTransport(lan);

    const peerStateSpy = vi.fn();
    manager.onPeerState(peerStateSpy);

    // Simulate LAN peer discovery connecting peer-B
    // @ts-expect-error accessing private peerStateCb for testing
    lan.peerStateCb?.('peer-B', 'connected');

    expect(peerStateSpy).toHaveBeenCalledWith('peer-B', 'connected');
    const peers = store.getPeers();
    expect(peers.some((p) => p.id === 'peer-B')).toBe(true);
  });
});
