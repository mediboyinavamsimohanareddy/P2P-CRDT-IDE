import React, { useState, useEffect } from 'react';
import { Terminal, FileText, Shield, CheckCircle, Activity, AlertCircle, Play, XCircle, CheckCircle2 } from 'lucide-react';
import { TerminalComponent } from './TerminalComponent';
import { OperationLogStore, LogEntry } from '../core/security/OperationLogStore';

export const BottomPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'verification' | 'oplog' | 'demo'>('verification');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  useEffect(() => {
    const store = OperationLogStore.getInstance();
    setLogs(store.getEntries());
    return store.subscribe(() => {
      setLogs(store.getEntries());
    });
  }, []);

  const triggerSimulation = (action: string) => {
    const store = OperationLogStore.getInstance();
    if (action === 'disconnect') {
      setSimulationStatus('Peer C Network Connection Terminated');
      store.logRejectedSecurityEvent({
        id: `sec-${Date.now()}`,
        timestamp: Date.now(),
        peerId: 'Laptop-C',
        reason: 'Not a member',
        status: 'REJECTED',
        details: 'Peer C socket disconnected',
      });
    } else if (action === 'duplicate') {
      setSimulationStatus('Duplicate Op Injected');
      store.logRejectedSecurityEvent({
        id: `sec-${Date.now()}`,
        timestamp: Date.now(),
        peerId: 'Laptop-B',
        reason: 'Duplicate operation',
        status: 'REJECTED',
        details: 'Replayed opId 018e9b5a-8b12-7a34-9c56-123456789abc',
      });
    } else if (action === 'malformed') {
      setSimulationStatus('Malformed Payload Injected');
      store.logRejectedSecurityEvent({
        id: `sec-${Date.now()}`,
        timestamp: Date.now(),
        peerId: 'Laptop-B',
        reason: 'Malformed payload',
        status: 'REJECTED',
        details: 'Frame schema validation failed',
      });
    }

    setTimeout(() => setSimulationStatus(null), 3000);
  };

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
          onClick={() => setActiveTab('demo')}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
            activeTab === 'demo'
              ? 'bg-status-warn/20 text-status-warn border-t-2 border-status-warn'
              : 'text-status-warn hover:bg-bg-hover'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Demo Controls</span>
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
      ) : activeTab === 'demo' ? (
        <div className="flex-1 p-3 bg-bg-darkest flex flex-col gap-3 font-sans text-xs">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-200">Failure Simulation &amp; Injection Drawer</span>
            {simulationStatus && (
              <span className="bg-status-error/20 text-status-error px-2 py-0.5 rounded font-mono text-[10px] animate-pulse">
                {simulationStatus}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => triggerSimulation('disconnect')}
              className="bg-bg-panel border border-status-warn/30 hover:border-status-warn text-status-warn p-2 rounded text-left flex flex-col gap-1"
            >
              <span className="font-bold">Disconnect Peer C</span>
              <span className="text-[10px] text-gray-500">Simulate physical network failure</span>
            </button>
            <button
              onClick={() => triggerSimulation('duplicate')}
              className="bg-bg-panel border border-status-info/30 hover:border-status-info text-status-info p-2 rounded text-left flex flex-col gap-1"
            >
              <span className="font-bold">Send Duplicate Op</span>
              <span className="text-[10px] text-gray-500">Replay seen operation ID</span>
            </button>
            <button
              onClick={() => triggerSimulation('malformed')}
              className="bg-bg-panel border border-status-error/30 hover:border-status-error text-status-error p-2 rounded text-left flex flex-col gap-1"
            >
              <span className="font-bold">Send Malformed Op</span>
              <span className="text-[10px] text-gray-500">Inject corrupt schema payload</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto bg-bg-darkest text-gray-300">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <span>[12:42:10]</span>
            <span>Starting verification pipeline for AI Merge Proposal #0042...</span>
          </div>
          <div className="flex items-center gap-2 text-status-pass mb-1">
            <span>[12:42:11]</span>
            <span>✓ AST Parse successful (12ms)</span>
          </div>
          <div className="flex items-center gap-2 text-status-pass mb-1">
            <span>[12:42:12]</span>
            <span>✓ mvn compile: BUILD SUCCESS (840ms)</span>
          </div>
          <div className="flex items-center gap-2 text-status-pass mb-1">
            <span>[12:42:15]</span>
            <span>✓ mvn test: Tests run: 42, Failures: 0, Errors: 0, Skipped: 0 (2.4s)</span>
          </div>
          <div className="flex items-center gap-2 text-accent-mint font-bold mt-2">
            <span>[12:42:15]</span>
            <span>VERIFICATION PASSED. Merge is safe to apply.</span>
          </div>
        </div>
      )}
    </div>
  );
};
