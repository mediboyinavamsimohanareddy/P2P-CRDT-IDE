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
    store.connectDemoRoomPeers('DB-72A91');
    expect(store.getConnectedPeerCount()).toBe(3);
    expect(store.getRoomId()).toBe('DB-72A91');
  });
});
