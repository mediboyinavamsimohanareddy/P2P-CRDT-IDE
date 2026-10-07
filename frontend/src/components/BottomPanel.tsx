import React, { useState, useEffect } from 'react';
import { Terminal, FileText, Shield, CheckCircle, Activity, AlertCircle, Play, XCircle, CheckCircle2 } from 'lucide-react';
import { TerminalComponent } from './TerminalComponent';
import { OperationLogStore, LogEntry } from '../core/security/OperationLogStore';

export const BottomPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'verification' | 'oplog'>('verification');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const store = OperationLogStore.getInstance();
    setLogs(store.getEntries());
    return store.subscribe(() => {
      setLogs(store.getEntries());
    });
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
      </div>

      {/* Content Area */}
      {activeTab === 'terminal' ? (
        <TerminalComponent />
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
