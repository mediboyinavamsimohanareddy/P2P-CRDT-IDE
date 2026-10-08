import { describe, it, expect, beforeEach } from 'vitest';
import { LocalPersistenceManager, OfflineSessionDraft } from '../../services/LocalPersistenceManager';
import { OverlapConflictDetector } from '../merge/OverlapConflictDetector';
import { RoomPeerStore } from './RoomPeerStore';
import { AutoRejoinManager } from './AutoRejoinManager';

describe('Feature 2: LocalStorage, Auto-Rejoin & Offline Timeout Pipeline', () => {
  let persistence: LocalPersistenceManager;
  let detector: OverlapConflictDetector;
  let peerStore: RoomPeerStore;

  beforeEach(() => {
    persistence = new LocalPersistenceManager('.');
    detector = OverlapConflictDetector.getInstance();
    detector.clear();
    peerStore = RoomPeerStore.getInstance();
    persistence.clearDevToolsOfflineDraft();
  });

  it('1. Persists offline session into DevTools-visible LocalStorage keys', () => {
    const draft: OfflineSessionDraft = {
      roomId: 'DB-HOST-101',
      peerId: 'peer-laptop-3',
      displayName: 'Laptop 3',
      code: 'int a = 30;',
      integerValue: 30,
      filePath: 'src/main/java/Main.java',
      isHost: false,
      lastSavedAt: Date.now(),
      isOffline: true,
    };

    persistence.saveDevToolsOfflineDraft(draft);

    // Verify individual inspectable DevTools keys
    expect(window.localStorage.getItem('decentraide:active-room-id')).toBe('DB-HOST-101');
    expect(window.localStorage.getItem('decentraide:cached-code')).toBe('int a = 30;');
    expect(window.localStorage.getItem('decentraide:user-integer-val')).toBe('30');

    // Verify composite offline-session JSON
    const recovered = persistence.getDevToolsOfflineDraft();
    expect(recovered).not.toBeNull();
    expect(recovered?.roomId).toBe('DB-HOST-101');
    expect(recovered?.code).toBe('int a = 30;');
    expect(recovered?.integerValue).toBe(30);
    expect(recovered?.isOffline).toBe(true);
  });

  it('2. When internet returns, auto-rejoins room and forwards code to conflict detector against other 2 laptops', () => {
    // Stage other 2 laptops' code into the detector
    detector.notePeerEdit('laptop-1-host', 'Main.java', 'int a = 10;', 20, 'Laptop 1 (Host)');
    detector.notePeerEdit('laptop-2-peer', 'Main.java', 'int a = 20;', 50, 'Laptop 2');

    // User's offline draft in LocalStorage
    const offlineDraft: OfflineSessionDraft = {
      roomId: 'DB-TEST-ROOM',
      peerId: 'laptop-3-reconnected',
      displayName: 'Laptop 3 (Recovered)',
      code: 'int a = 30;',
      integerValue: 30,
      filePath: 'Main.java',
      isHost: false,
      lastSavedAt: Date.now(),
      isOffline: true,
    };
    persistence.saveDevToolsOfflineDraft(offlineDraft);

    // Internet restored: fetch from LocalStorage & identify room ID
    const fetchedDraft = persistence.getDevToolsOfflineDraft();
    expect(fetchedDraft?.roomId).toBe('DB-TEST-ROOM');

    // Directly forward recovered code to Conflict Detector
    const conflict = detector.triggerReconnectedTest(
      fetchedDraft!.peerId,
      fetchedDraft!.code,
      fetchedDraft!.filePath,
      fetchedDraft!.integerValue,
      'Laptop 3'
    );

    expect(conflict).not.toBeNull();
    expect(conflict.versions.length).toBeGreaterThanOrEqual(3);

    // Verify all 3 laptops are present in the conflict versions
    const versionCodes = conflict.versions.map((v) => v.codeSnippet);
    expect(versionCodes).toContain('int a = 10;');
    expect(versionCodes).toContain('int a = 20;');
    expect(versionCodes).toContain('int a = 30;');
  });

  it('3. When offline peer does not return within timeout, only other 2 laptops move forward in conflict detector', () => {
    // Register 3 peers in the conflict detector
    detector.notePeerEdit('laptop-1-host', 'Main.java', 'int a = 10;', 20, 'Laptop 1 (Host)');
    detector.notePeerEdit('laptop-2-peer', 'Main.java', 'int a = 20;', 50, 'Laptop 2');
    detector.triggerReconnectedTest('laptop-3-offline', 'int a = 30;', 'Main.java', 30, 'Laptop 3');

    const activeConflict = detector.getLatest();
    expect(activeConflict?.versions.length).toBe(3);

    // Laptop 3 remains offline past timeout: mark in PeerStore & trigger conflict detector timeout
    peerStore.markPeerOffline('laptop-3-offline');
    const timedOutConflict = detector.handlePeerOfflineTimeout('laptop-3-offline');

    expect(timedOutConflict).not.toBeNull();
    // Only the other 2 laptops' code is forwarded!
    expect(timedOutConflict?.versions.length).toBe(2);
    const remainingPeerIds = timedOutConflict?.versions.map((v) => v.authorId);
    expect(remainingPeerIds).toContain('laptop-1-host');
    expect(remainingPeerIds).toContain('laptop-2-peer');
    expect(remainingPeerIds).not.toContain('laptop-3-offline');
  });
});
