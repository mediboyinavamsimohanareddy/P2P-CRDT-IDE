import React, { useState, useEffect } from 'react';
import { Network, Wifi, ShieldCheck, Copy, Check, Plus, LogIn } from 'lucide-react';
import { RoomPeerStore, ConnectedPeer } from '../core/sync/RoomPeerStore';
import { YjsCrdtEngine } from '../core/crdt/CrdtEngine';
import { CollaborationManager } from '../core/sync/CollaborationManager';
import { SignalingConfig } from '../core/sync/SignalingConfig';
import { createRoom, joinRoom } from '../core/sync/roomApi';
import { SessionStatusStore } from '../core/sync/SessionStatusStore';

export interface NetworkAndSyncViewProps {
  crdtEngine?: YjsCrdtEngine;
}

export const NetworkAndSyncView: React.FC<NetworkAndSyncViewProps> = ({ crdtEngine }) => {
  const [copied, setCopied] = useState(false);
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [signalingHostInput, setSignalingHostInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [workspaceHash, setWorkspaceHash] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState(SessionStatusStore.getInstance().get());

  useEffect(() => {
    const store = RoomPeerStore.getInstance();
    setPeers(store.getPeers());
    setRoomId(store.getRoomId());

    const updateHash = () => {
      if (crdtEngine) {
        setWorkspaceHash(crdtEngine.computeWorkspaceHash());
      }
    };
    updateHash();

    const unsubscribe = store.subscribe(() => {
      setPeers(store.getPeers());
      setRoomId(store.getRoomId());
      updateHash();
    });

    const interval = setInterval(updateHash, 2000);
    const unsubStatus = SessionStatusStore.getInstance().subscribe(() => {
      setSessionStatus(SessionStatusStore.getInstance().get());
    });

    return () => {
      unsubscribe();
      unsubStatus();
      clearInterval(interval);
    };
  }, [crdtEngine]);

  const handleCreateRoom = async () => {
    let newRoomId = 'DB-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    try {
      const res = await createRoom(RoomPeerStore.getInstance().getLocalPeerId(), 'DecentraWorkspace');
      if (res.success && res.roomId) {
        newRoomId = res.roomId;
      }
    } catch {
      // Offline fallback mode
    }

    CollaborationManager.getInstance().startSession(newRoomId, { isHost: true });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`decentraide://join/${newRoomId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    alert(`Room ${newRoomId} created successfully! Invite link copied to clipboard.`);
  };

  const handleJoinRoom = async () => {
    if (!joinInput.trim()) return;
    setJoinError(null);
    const cleanRoomId = joinInput.trim().toUpperCase();
    if (signalingHostInput.trim()) {
      SignalingConfig.getInstance().setHost(signalingHostInput.trim());
    }

    try {
      const res = await joinRoom(cleanRoomId, RoomPeerStore.getInstance().getLocalPeerId());
      if (!res.success) {
        setJoinError(res.error || 'Room not found on host');
        return;
      }
    } catch {
      setJoinError('Could not reach room host backend');
      return;
    }

    CollaborationManager.getInstance().startSession(cleanRoomId, { isHost: false });
    setShowJoinModal(false);
    setJoinInput('');
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`decentraide://join/${roomId || 'DB-72A91'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-accent-mint">
            <Network className="w-5 h-5" />
            Network Topology &amp; Synchronization
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time peer connection state, CRDT state vector convergence, and transport analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateRoom}
            className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Room</span>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-status-info hover:bg-status-info/80 text-white font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 shadow"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Join Room</span>
          </button>
          <button
            onClick={handleCopyInvite}
            className="bg-bg-panel border border-border-subtle hover:bg-bg-dark text-gray-200 font-medium px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-status-pass" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Link!' : 'Copy Invite'}</span>
          </button>
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-dark border border-border-subtle rounded-lg p-5 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-status-info" /> Join Collaborative P2P Room
            </h3>
            <p className="text-xs text-gray-400">Enter the Room ID and host LAN address supplied by the host laptop:</p>
            {joinError && (
              <div className="text-status-error text-[11px] font-semibold bg-status-error/10 p-2 rounded border border-status-error/30">
                {joinError}
              </div>
            )}
            <input
              type="text"
              placeholder="Signaling Host (e.g. 192.168.1.14:8082)"
              value={signalingHostInput}
              onChange={(e) => setSignalingHostInput(e.target.value)}
              className="bg-bg-darkest border border-border-subtle px-3 py-2 rounded text-xs text-gray-200 font-mono focus:outline-none focus:border-accent-mint"
            />
            <input
              type="text"
              placeholder="e.g. DB-72A91"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              className="bg-bg-darkest border border-border-subtle px-3 py-2 rounded text-xs text-gray-200 font-mono uppercase focus:outline-none focus:border-accent-mint"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowJoinModal(false)}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinRoom}
                className="bg-status-info hover:bg-status-info/80 text-white font-semibold px-4 py-1.5 rounded text-xs"
              >
                Connect to Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Topology & Convergence */}
      <div className="grid grid-cols-2 gap-4">
        {/* Topology Card */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold border-b border-border-subtle pb-2">
            <span className="flex items-center gap-1.5 text-gray-200">
              <Wifi className="w-4 h-4 text-status-info" /> Active P2P Mesh Links
            </span>
            <span className="text-accent-mint font-mono text-[11px]">
              {peers.length} Active {peers.length === 1 ? 'Replica' : 'Replicas'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {peers.map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-bg-panel p-2 rounded border border-border-subtle">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="font-semibold text-gray-200">{p.displayName}</span>
                </div>
                <span className="text-[11px] font-mono text-status-pass">
                  {p.role === 'Host' ? 'Primary Replica' : `${p.activity || 'P2P DataChannel'} · 18 ms`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Convergence Status Card */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold border-b border-border-subtle pb-2">
            <span className="flex items-center gap-1.5 text-gray-200">
              <ShieldCheck className="w-4 h-4 text-status-pass" /> Workspace Convergence Verification
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                sessionStatus.converged
                  ? 'bg-status-pass/20 text-status-pass'
                  : 'bg-status-warn/20 text-status-warn'
              }`}
            >
              {sessionStatus.converged ? 'CRDT: SYNCED' : 'CRDT: SYNCING'}
            </span>
          </div>

          <div className="flex flex-col gap-2 font-mono text-[11px] bg-bg-darkest p-3 rounded border border-border-subtle text-gray-300">
            <div>Workspace state hash:</div>
            <div className="text-accent-mint font-bold break-all">
              {sessionStatus.localHash || workspaceHash || '—'}
            </div>
            <div>
              Remote hash: {sessionStatus.remoteHash || 'waiting'}
            </div>
            <div
              className={`text-[10px] pt-1 ${
                sessionStatus.converged ? 'text-status-pass' : 'text-status-warn'
              }`}
            >
              {sessionStatus.converged && sessionStatus.localHash && sessionStatus.localHash === sessionStatus.remoteHash
                ? 'STATE HASH: MATCHED'
                : 'STATE HASH: MISMATCH'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
