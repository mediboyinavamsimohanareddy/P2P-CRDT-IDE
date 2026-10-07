import React, { useState, useEffect } from 'react';
import { Terminal, FileText, Shield, CheckCircle, Activity, AlertCircle, Play, XCircle, CheckCircle2, GitMerge } from 'lucide-react';
import { TerminalComponent } from './TerminalComponent';
import { OperationLogStore, LogEntry } from '../core/security/OperationLogStore';
import { OverlapConflictDetector } from '../core/merge/OverlapConflictDetector';
import { Conflict } from '@decentraide/shared';

export interface BottomPanelProps {
  onSelectView?: (view: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ onSelectView }) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'verification' | 'oplog' | 'conflicts'>('verification');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeConflict, setActiveConflict] = useState<Conflict | null>(null);

  useEffect(() => {
    const store = OperationLogStore.getInstance();
    setLogs(store.getEntries());
    const unsubLogs = store.subscribe(() => {
      setLogs(store.getEntries());
    });

    const detector = OverlapConflictDetector.getInstance();
    setActiveConflict(detector.getLatest());
    const unsubConflicts = detector.subscribe((conflict) => {
      setActiveConflict(conflict);
      if (conflict) {
        setActiveTab('conflicts');
      }
    });

    return () => {
      unsubLogs();
      unsubConflicts();
    };
  }, []);

  return (
    <div
      data-testid="bottom-panel"
      className="h-48 bg-bg-dark border-t border-border-subtle flex flex-col select-none"
    >
      {/* Tabs Bar */}
      <div className="h-8 bg-bg-panel border-b border-border-subtle flex items-center px-2 gap-1 text-[11px] font-medium text-gray-400">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
            activeTab === 'terminal' ? 'bg-bg-dark text-gray-200 border-t-2 border-accent-mint' : 'hover:bg-bg-hover'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Terminal</span>
        </button>

        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
            activeTab === 'verification' ? 'bg-bg-dark text-gray-200 border-t-2 border-accent-mint' : 'hover:bg-bg-hover'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5 text-status-pass" />
          <span>Verification</span>
        </button>

        <button
          onClick={() => setActiveTab('oplog')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
            activeTab === 'oplog' ? 'bg-bg-dark text-gray-200 border-t-2 border-accent-mint' : 'hover:bg-bg-hover'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Operation Log</span>
          <span className="bg-bg-hover px-1.5 rounded-full text-[9px] font-mono">{logs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
            activeTab === 'conflicts' ? 'bg-bg-dark text-gray-200 border-t-2 border-status-warn' : 'hover:bg-bg-hover'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5 text-status-warn" />
          <span>Conflict Detector</span>
          {activeConflict && (
            <span className="bg-status-warn/20 text-status-warn px-1.5 rounded-full text-[9px] font-mono font-bold animate-pulse">
              1 Active
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'terminal' ? (
        <TerminalComponent />
      ) : activeTab === 'conflicts' ? (
        <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto bg-bg-darkest text-gray-300">
          {!activeConflict ? (
            <div className="text-gray-500 italic p-2">No active line overlaps detected across peers. Concurrent edits merge cleanly via CRDT Yjs YATA.</div>
          ) : (
            <div className="flex items-center justify-between bg-bg-panel p-3 rounded border border-status-warn/30">
              <div className="flex flex-col gap-1">
                <span className="text-status-warn font-bold flex items-center gap-1.5 text-xs font-sans">
                  <AlertCircle className="w-4 h-4" /> Overlapping edits detected in {activeConflict.filePath}
                </span>
                <span className="text-gray-400 text-[10px]">
                  Authors {activeConflict.versions[0]?.authorId} and {activeConflict.versions[1]?.authorId} edited the same file region concurrently.
                </span>
              </div>
              <button
                onClick={() => onSelectView?.('conflict')}
                className="bg-status-warn text-bg-darkest font-bold px-3 py-1.5 rounded text-xs hover:bg-status-warn/90 font-sans"
              >
                Open Conflict Panel
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'oplog' ? (
        <div className="flex-1 p-2 font-mono text-[11px] overflow-y-auto bg-bg-darkest text-gray-300">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-gray-500 text-[10px]">
                <th className="py-1 px-2">#</th>
                <th className="py-1 px-2">PEER</th>
                <th className="py-1 px-2">TYPE</th>
                <th className="py-1 px-2">FILE</th>
                <th className="py-1 px-2">TIME</th>
                <th className="py-1 px-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500 italic">
                    No CRDT operations recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.opNumber} className="border-b border-border-subtle/50 hover:bg-bg-panel">
                    <td className="py-1 px-2 text-gray-500">#{log.opNumber}</td>
                    <td className="py-1 px-2 text-gray-200 font-bold">{log.peerId}</td>
                    <td className="py-1 px-2 text-gray-300">{log.type}</td>
                    <td className="py-1 px-2 text-gray-400">{log.filePath}</td>
                    <td className="py-1 px-2 text-gray-500 text-[10px]">{log.timestamp}</td>
                    <td className="py-1 px-2">
                      {log.status === 'APPLIED' ? (
                        <span className="text-status-pass font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> APPLIED
                        </span>
                      ) : (
                        <span className="text-status-error font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> REJECTED
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto bg-bg-darkest text-gray-300">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic p-2">No verification logs available. Run verification pipeline to see live build diagnostics.</div>
          ) : (
            logs.map((log) => (
              <div key={log.opNumber} className="flex items-center gap-2 mb-1">
                <span className="text-gray-500">[{log.timestamp}]</span>
                <span className="text-gray-300">{log.peerId}:</span>
                <span className={log.status === 'APPLIED' ? 'text-status-pass font-bold' : 'text-status-error font-bold'}>
                  {log.type} on {log.filePath} ({log.status})
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
