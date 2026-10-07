import { describe, it, expect } from 'vitest';
import { RoomPeerStore } from './RoomPeerStore';

describe('RoomPeerStore', () => {
  it('starts with 1 local peer and no random peers before room connection', () => {
    const store = RoomPeerStore.getInstance();
    expect(store.getConnectedPeerCount()).toBe(1);
    expect(store.getPeers()[0].displayName).toContain('You');
  });

  it('updates peer count when room peers connect', () => {
    const store = RoomPeerStore.getInstance();
    store.setRoomId('DB-72A91');
    store.setRoomPeers([
      {
        id: 'peer-local-you',
        displayName: 'You (Local Host)',
        role: 'Host',
        status: 'connected',
        activity: 'Editing active workspace',
        color: '#2EE6A6',
      },
      {
        id: 'peer-2',
        displayName: 'Peer 2',
        role: 'Peer',
        status: 'connected',
        activity: 'Connected',
        color: '#4D96FF',
      },
    ]);
    expect(store.getConnectedPeerCount()).toBe(2);
    expect(store.getRoomId()).toBe('DB-72A91');
  });
});
