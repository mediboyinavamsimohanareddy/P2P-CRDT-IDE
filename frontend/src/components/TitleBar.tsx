import React, { useState, useEffect } from 'react';
import { Search, Shield, Users, Radio, FilePlus, FolderPlus, FolderOpen, X, Wifi } from 'lucide-react';
import { RoomPeerStore } from '../core/sync/RoomPeerStore';

interface TitleBarProps {
  onOpenFolder?: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onSelectView?: (view: string) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onOpenFolder,
  onNewFile,
  onNewFolder,
  onSelectView,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peerCount, setPeerCount] = useState(1);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const store = RoomPeerStore.getInstance();
    setPeerCount(store.getConnectedPeerCount());
    setRoomId(store.getRoomId());

    return store.subscribe(() => {
      setPeerCount(store.getConnectedPeerCount());
      setRoomId(store.getRoomId());
    });
  }, []);

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  return (
    <div
      data-testid="title-bar"
      className="h-9 bg-bg-darkest border-b border-border-subtle flex items-center justify-between px-3 text-xs select-none relative z-50"
    >
      <div className="flex items-center gap-3">
        <div className="font-bold text-accent-mint flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectView?.('editor')}>
          <div className="w-2.5 h-2.5 rounded-full bg-accent-mint animate-pulse" />
          DecentraIDE
        </div>

        {/* Menu Bar Dropdowns */}
        <div className="flex gap-1 text-gray-400 font-sans relative">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('file')}
              className={`px-2 py-1 rounded hover:text-gray-200 ${
                activeMenu === 'file' ? 'bg-bg-hover text-gray-200' : ''
              }`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-bg-panel border border-border-subtle rounded shadow-lg py-1 text-xs text-gray-300 flex flex-col z-50">
                <button
                  onClick={() => {
                    onNewFile?.();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover hover:text-gray-100 text-left"
                >
                  <FilePlus className="w-3.5 h-3.5 text-accent-mint" />
                  <span>New File</span>
                </button>
                <button
                  onClick={() => {
                    onNewFolder?.();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover hover:text-gray-100 text-left"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-status-info" />
                  <span>New Folder</span>
                </button>
                <div className="border-t border-border-subtle my-1" />
                <button
                  onClick={() => {
                    onOpenFolder?.();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover hover:text-gray-100 text-left"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-status-warn" />
                  <span>Open Folder...</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('edit')}
              className={`px-2 py-1 rounded hover:text-gray-200 ${
                activeMenu === 'edit' ? 'bg-bg-hover text-gray-200' : ''
              }`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-bg-panel border border-border-subtle rounded shadow-lg py-1 text-xs text-gray-300 flex flex-col z-50">
                <button onClick={() => setActiveMenu(null)} className="px-3 py-1.5 hover:bg-bg-hover text-left">Undo (Ctrl+Z)</button>
                <button onClick={() => setActiveMenu(null)} className="px-3 py-1.5 hover:bg-bg-hover text-left">Redo (Ctrl+Y)</button>
                <div className="border-t border-border-subtle my-1" />
                <button onClick={() => setActiveMenu(null)} className="px-3 py-1.5 hover:bg-bg-hover text-left">Cut (Ctrl+X)</button>
                <button onClick={() => setActiveMenu(null)} className="px-3 py-1.5 hover:bg-bg-hover text-left">Copy (Ctrl+C)</button>
                <button onClick={() => setActiveMenu(null)} className="px-3 py-1.5 hover:bg-bg-hover text-left">Paste (Ctrl+V)</button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('view')}
              className={`px-2 py-1 rounded hover:text-gray-200 ${
                activeMenu === 'view' ? 'bg-bg-hover text-gray-200' : ''
              }`}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-bg-panel border border-border-subtle rounded shadow-lg py-1 text-xs text-gray-300 flex flex-col z-50">
                <button
                  onClick={() => {
                    onSelectView?.('editor');
                    setActiveMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-bg-hover text-left"
                >
                  Editor
                </button>
                <button
                  onClick={() => {
                    onSelectView?.('network');
                    setActiveMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-bg-hover text-left flex items-center gap-2"
                >
                  <span>Network &amp; Sync</span>
                </button>
                <button
                  onClick={() => {
                    onSelectView?.('conflict');
                    setActiveMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-bg-hover text-left flex items-center gap-2"
                >
                  <span>Conflict Resolution</span>
                </button>
                <button
                  onClick={() => {
                    onSelectView?.('security');
                    setActiveMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-bg-hover text-left flex items-center gap-2"
                >
                  <span>Security &amp; Verification</span>
                </button>
              </div>
            )}
          </div>

          <button onClick={() => onSelectView?.('editor')} className="px-2 py-1 rounded hover:text-gray-200">Terminal</button>
          <button onClick={() => onSelectView?.('editor')} className="px-2 py-1 rounded hover:text-gray-200">Help</button>
        </div>
      </div>

      {/* Search / Command Palette Bar */}
      <div
        onClick={() => setShowCommandPalette(true)}
        className="flex items-center bg-bg-panel border border-border-subtle rounded px-2.5 py-0.5 text-gray-400 w-80 gap-2 cursor-pointer hover:border-gray-600 transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="truncate">Search files, commands, peers…</span>
        <kbd className="ml-auto bg-bg-dark border border-border-subtle text-[10px] px-1 rounded text-gray-400">⌘K</kbd>
      </div>

      {/* Dynamic Peer Count Connection & Status Indicators */}
      <div className="flex items-center gap-3 font-sans">
        <div className="flex items-center gap-1.5 text-status-pass bg-bg-panel border border-border-subtle px-2 py-0.5 rounded-full text-[11px]">
          <Radio className="w-3 h-3 text-status-pass animate-pulse" />
          <span>{roomId ? `Room: ${roomId}` : 'Local Standalone'}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-200 font-semibold text-[11px] bg-bg-panel border border-border-subtle px-2 py-0.5 rounded">
          <Users className="w-3.5 h-3.5 text-accent-mint" />
          <span>{peerCount} {peerCount === 1 ? 'peer (You)' : 'peers connected'}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 text-[11px]">
          <Shield className="w-3.5 h-3.5 text-status-pass" />
          <span>E2E encrypted</span>
        </div>
        <div className="w-5 h-5 rounded-full bg-peer-arjun text-white flex items-center justify-center font-bold text-[10px]">
          A
        </div>
      </div>

      {/* Command Palette Modal */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 z-50">
          <div className="bg-bg-panel border border-border-subtle rounded-lg w-[500px] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center border-b border-border-subtle px-3 py-2 gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a command or view name..."
                className="bg-transparent text-xs text-gray-200 outline-none w-full font-sans"
              />
              <button onClick={() => setShowCommandPalette(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1 text-xs">
              <div
                onClick={() => {
                  onSelectView?.('editor');
                  setShowCommandPalette(false);
                }}
                className="p-2 hover:bg-bg-hover rounded text-gray-200 flex items-center justify-between cursor-pointer"
              >
                <span>Go to Editor / Files</span>
                <span className="text-[10px] text-gray-500 font-mono">View</span>
              </div>
              <div
                onClick={() => {
                  onSelectView?.('network');
                  setShowCommandPalette(false);
                }}
                className="p-2 hover:bg-bg-hover rounded text-gray-200 flex items-center justify-between cursor-pointer"
              >
                <span>Open Network Topology &amp; P2P Sync</span>
                <span className="text-[10px] text-gray-500 font-mono">View</span>
              </div>
              <div
                onClick={() => {
                  onSelectView?.('conflict');
                  setShowCommandPalette(false);
                }}
                className="p-2 hover:bg-bg-hover rounded text-gray-200 flex items-center justify-between cursor-pointer"
              >
                <span>Resolve Semantic Overlap (LoginService.java)</span>
                <span className="text-[10px] text-gray-500 font-mono">Conflict</span>
              </div>
              <div
                onClick={() => {
                  onSelectView?.('security');
                  setShowCommandPalette(false);
                }}
                className="p-2 hover:bg-bg-hover rounded text-gray-200 flex items-center justify-between cursor-pointer"
              >
                <span>Open Security &amp; Defense Monitor</span>
                <span className="text-[10px] text-gray-500 font-mono">Security</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
