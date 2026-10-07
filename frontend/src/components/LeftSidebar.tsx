import React, { useState, useEffect } from 'react';
import { Files, GitPullRequest, AlertCircle, History, Shield, Activity, Heart, UserPlus, FolderOpen, File, Folder, FilePlus, FolderPlus, X, Copy, Check, Radio } from 'lucide-react';
import { useFileSystem } from '../hooks/useFileSystem';
import { FileEntry } from '../main/preload';
import { RoomPeerStore, ConnectedPeer } from '../core/sync/RoomPeerStore';
import { CollaborationManager } from '../core/sync/CollaborationManager';
import { SignalingConfig, fetchLanInfo } from '../core/sync/SignalingConfig';
import { createRoom, joinRoom } from '../core/sync/roomApi';
import { SessionStatusStore } from '../core/sync/SessionStatusStore';

interface LeftSidebarProps {
  onOpenFile?: (path: string) => void;
  activeView?: string;
  onSelectView?: (view: string) => void;
  activeFilePath?: string;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ onOpenFile, activeView, onSelectView, activeFilePath }) => {
  const { isElectron, workspaceRoot, files, openFolder, writeFile, createDir, refreshFiles } = useFileSystem();

  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [peers, setPeers] = useState<ConnectedPeer[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputRoomId, setInputRoomId] = useState('');
  const [signalingHost, setSignalingHost] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lanJoinUrl, setLanJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    const store = RoomPeerStore.getInstance();
    setPeers(store.getPeers());
    setRoomId(store.getRoomId());

    return store.subscribe(() => {
      setPeers(store.getPeers());
      setRoomId(store.getRoomId());
    });
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !workspaceRoot) return;

    const targetPath = `${workspaceRoot}/${newItemName.trim()}`;

    if (creatingType === 'file') {
      if (writeFile) {
        await writeFile(targetPath, `// New file: ${newItemName}\npublic class ${newItemName.split('.')[0]} {}\n`);
        await refreshFiles();
      }
      onOpenFile?.(targetPath);
    } else if (creatingType === 'folder') {
      if (createDir) {
        await createDir(targetPath);
        await refreshFiles();
      }
    }

    setNewItemName('');
    setCreatingType(null);
  };

  const handleCreateRoom = async () => {
    let newRoomId = 'DB-72A91';
    const localPeerId = RoomPeerStore.getInstance().getLocalPeerId();
    try {
      const res = await createRoom(localPeerId, 'DecentraBank');
      if (res.success && res.roomId) {
        newRoomId = res.roomId;
      }
    } catch {
      // Fallback
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
    if (!inputRoomId.trim()) return;
    setJoinError(null);
    const cleanRoomId = inputRoomId.trim().toUpperCase();
    const localPeerId = RoomPeerStore.getInstance().getLocalPeerId();
    if (signalingHost.trim()) {
      SignalingConfig.getInstance().setHost(signalingHost.trim());
    }

    try {
      const res = await joinRoom(cleanRoomId, localPeerId);
      if (!res.success) {
        setJoinError(res.error || 'Room not found on host');
        return;
      }
    } catch {
      setJoinError('Could not reach room host backend');
      return;
    }

    CollaborationManager.getInstance().startSession(cleanRoomId, { isHost: false });
    setShowInviteModal(false);
    setInputRoomId('');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`decentraide://join/${roomId || 'DB-72A91'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-testid="left-sidebar"
      className="w-64 bg-bg-dark border-r border-border-subtle flex flex-col justify-between h-full select-none"
    >
      <div className="flex flex-col overflow-y-auto">
        {/* Workspace navigation options */}
        <div className="p-2 border-b border-border-subtle flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">Workspace</div>

          <div
            onClick={() => onSelectView?.('editor')}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
              activeView === 'editor' ? 'bg-bg-hover text-gray-200 font-medium' : 'hover:bg-bg-hover text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Files className="w-3.5 h-3.5 text-accent-mint" />
              <span>Explorer</span>
            </div>
          </div>

          <div
            onClick={() => onSelectView?.('source-control')}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
              activeView === 'source-control' ? 'bg-bg-hover text-gray-200 font-medium' : 'hover:bg-bg-hover text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-3.5 h-3.5 text-status-info" />
              <span>Source Control</span>
            </div>
            <span className="bg-bg-panel border border-border-subtle text-[10px] px-1.5 rounded-full text-gray-400 font-mono">2</span>
          </div>

          <div
            onClick={() => onSelectView?.('merge-history')}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
              activeView === 'merge-history' ? 'bg-bg-hover text-gray-200 font-medium' : 'hover:bg-bg-hover text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Merge History</span>
            </div>
          </div>

          <div
            onClick={() => onSelectView?.('security')}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
              activeView === 'security' ? 'bg-bg-hover text-gray-200 font-medium' : 'hover:bg-bg-hover text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-status-pass" />
              <span>Security &amp; Verification</span>
            </div>
          </div>

          <div
            onClick={() => onSelectView?.('network')}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
              activeView === 'network' ? 'bg-bg-hover text-gray-200 font-medium' : 'hover:bg-bg-hover text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-status-info" />
              <span>Network &amp; Sync</span>
            </div>
          </div>

          <div
            onClick={() => onSelectView?.('health')}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
              activeView === 'health' ? 'bg-bg-hover text-gray-200 font-medium' : 'hover:bg-bg-hover text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-status-pass" />
              <span>Project Health</span>
            </div>
          </div>
        </div>

        {/* Explorer File Tree */}
        <div className="p-2 border-b border-border-subtle flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Explorer</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCreatingType('file')}
                className="text-gray-400 hover:text-accent-mint"
                title="New File"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCreatingType('folder')}
                className="text-gray-400 hover:text-status-info"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              {isElectron && (
                <button onClick={openFolder} className="text-gray-400 hover:text-gray-200" title="Open Folder">
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* New Item Input Inline */}
          {creatingType && (
            <form onSubmit={handleCreateSubmit} className="flex items-center px-2 py-1 gap-1">
              <input
                type="text"
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={creatingType === 'file' ? 'FileName.java' : 'folder-name'}
                className="bg-bg-darkest text-xs text-gray-200 px-2 py-0.5 rounded border border-accent-mint outline-none w-full font-mono"
              />
              <button type="button" onClick={() => setCreatingType(null)} className="text-gray-500 hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="pl-2 pt-1 font-mono text-[12px] text-gray-400 flex flex-col gap-1">
            {!workspaceRoot ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <span className="text-gray-500 text-[11px] font-sans text-center px-4">No folder opened</span>
                {isElectron && (
                  <button
                    onClick={openFolder}
                    className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-semibold py-1 px-3 rounded text-xs font-sans"
                  >
                    Open Folder
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="text-gray-200 font-bold truncate" title={workspaceRoot}>
                  {workspaceRoot.split(/[/\\]/).pop()}
                </div>
                {files.map((file: FileEntry, idx: number) => {
                  const isOpened = activeFilePath && (activeFilePath === file.path || activeFilePath.endsWith(file.name));
                  return (
                    <div
                      key={idx}
                      onClick={() => !file.isDirectory && onOpenFile?.(file.path)}
                      className={`pl-3 flex items-center gap-1.5 py-0.5 rounded cursor-pointer truncate transition-colors ${
                        isOpened ? 'bg-bg-hover text-accent-mint font-semibold' : 'hover:bg-bg-hover'
                      }`}
                      title={file.name}
                    >
                      {file.isDirectory ? (
                        <Folder className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <File className={`w-3.5 h-3.5 shrink-0 ${isOpened ? 'text-accent-mint' : 'text-gray-500'}`} />
                      )}
                      <span className={file.isDirectory ? 'text-gray-300' : isOpened ? 'text-accent-mint' : 'text-gray-400'}>
                        {file.name}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Dynamic Live Peers Panel */}
        <div className="p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Live Peers ({peers.length})
            </span>
            <button
              onClick={() => setShowInviteModal(true)}
              className="text-accent-mint hover:underline text-[11px] flex items-center gap-1 font-sans"
            >
              <UserPlus className="w-3 h-3" />
              <span>{roomId ? 'Room' : 'Connect'}</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            {peers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1 rounded bg-bg-panel border border-border-subtle">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-semibold text-gray-200 text-[11px] truncate">{p.displayName}</span>
                  <span className="text-[10px] text-gray-500 truncate">{p.activity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-2 border-t border-border-subtle text-[11px] text-gray-500 flex justify-between items-center bg-bg-darkest">
        <span>Workspace trusted</span>
        <span className="text-accent-mint">Encrypted</span>
      </div>

      {/* Invite / Room Connection Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-panel border border-border-subtle rounded-lg w-96 p-4 shadow-2xl flex flex-col gap-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <span className="font-bold text-gray-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-accent-mint" />
                P2P Session &amp; Room Connection
              </span>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {roomId ? (
              <div className="flex flex-col gap-2">
                <span className="text-gray-300">Active Room ID:</span>
                <div className="bg-bg-darkest p-2 rounded border border-border-subtle font-mono text-accent-mint font-bold text-sm flex items-center justify-between">
                  <span>{roomId}</span>
                  <button onClick={handleCopyLink} className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 font-sans">
                    {copied ? <Check className="w-3.5 h-3.5 text-status-pass" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCreateRoom}
                  className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-semibold py-2 rounded text-xs text-center"
                >
                  Create New Room (e.g. DB-72A91)
                </button>

                <div className="text-center text-[10px] text-gray-500 uppercase tracking-wider">or join existing room</div>

                {joinError && (
                  <div className="text-status-error text-[11px] font-semibold bg-status-error/10 p-2 rounded border border-status-error/30">
                    {joinError}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={signalingHost}
                    onChange={(e) => setSignalingHost(e.target.value)}
                    placeholder="Signaling Host (e.g. 192.168.1.14:8082)"
                    className="bg-bg-darkest text-xs text-gray-200 p-2 rounded border border-border-subtle outline-none font-mono"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value)}
                      placeholder="Enter Room ID (e.g. DB-72A91)"
                      className="bg-bg-darkest text-xs text-gray-200 p-2 rounded border border-border-subtle outline-none flex-1 font-mono uppercase"
                    />
                    <button
                      onClick={handleJoinRoom}
                      className="bg-bg-hover hover:bg-border-subtle text-gray-200 px-3 rounded font-semibold text-xs"
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
