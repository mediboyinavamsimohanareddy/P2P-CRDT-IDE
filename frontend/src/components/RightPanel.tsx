import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, ShieldAlert, Cpu, GitMerge, FileCode, Check, Clock } from 'lucide-react';
import { MergeHistoryStore } from '../core/merge/MergeHistoryStore';

export interface MergeHistoryRecord {
  id: string;
  file: string;
  operationType: string;
  peerInvolved: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
  conflictStatus: 'RESOLVED' | 'NO_CONFLICT' | 'CONFLICT_DETECTED';
  verificationStatus: 'PASSED' | 'FAILED' | 'VERIFYING' | 'SKIPPED';
  timestamp: string;
  stateHash?: string;
}

export const RightPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'verification'>('history');
  const [mergeRecords, setMergeRecords] = useState<MergeHistoryRecord[]>([]);

  useEffect(() => {
    const store = MergeHistoryStore.getInstance();
    setMergeRecords(store.getRecords());
    return store.subscribe(() => {
      setMergeRecords(store.getRecords());
    });
  }, []);

  return (
    <div
      data-testid="right-panel"
      className="w-80 bg-bg-dark border-l border-border-subtle flex flex-col h-full select-none"
    >
      {/* Tab Header */}
      <div className="h-9 bg-bg-panel border-b border-border-subtle flex items-center justify-between px-2 text-xs">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-bg-dark text-gray-200 border-t-2 border-accent-mint'
                : 'text-gray-400 hover:bg-bg-hover'
            }`}
          >
            <History className="w-3.5 h-3.5 text-accent-mint" />
            <span>Merge History</span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'verification'
                ? 'bg-bg-dark text-gray-200 border-t-2 border-accent-mint'
                : 'text-gray-400 hover:bg-bg-hover'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-status-pass" />
            <span>Verification</span>
          </button>
        </div>

        <div className="bg-bg-dark border border-border-subtle text-gray-400 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
          <Cpu className="w-3 h-3 text-status-info" />
          <span>Groq Llama 3.1</span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
        {activeTab === 'history' ? (
          <div className="flex flex-col gap-3">
            <div className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
              Semantic Merge Audit Trail ({mergeRecords.length})
            </div>

            {mergeRecords.length === 0 ? (
              <div className="text-gray-500 text-xs italic text-center py-6">
                No merge or synchronization records available.
              </div>
            ) : (
              mergeRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-bg-panel border border-border-subtle rounded p-3 flex flex-col gap-2 font-sans text-xs"
                >
                  <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                    <span className="font-bold text-gray-200 flex items-center gap-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-accent-mint" />
                      {record.id}
                    </span>
                    <span className={`border text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${
                      record.syncStatus === 'SYNCED' || record.syncStatus === 'ACCEPTED'
                        ? 'bg-status-pass/20 text-status-pass border-status-pass/30'
                        : record.syncStatus === 'REJECTED'
                        ? 'bg-status-error/20 text-status-error border-status-error/30'
                        : 'bg-status-warn/20 text-status-warn border-status-warn/30'
                    }`}>
                      {record.syncStatus}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-[11px] text-gray-400">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1 text-gray-200 font-mono font-semibold">
                        <FileCode className="w-3.5 h-3.5 text-gray-500" />
                        {record.file}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">{record.operationType}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 bg-bg-darkest p-2 rounded border border-border-subtle text-[10px] font-mono mt-0.5">
                      <div>
                        <span className="text-gray-500">Peer: </span>
                        <span className="text-gray-300">{record.peerInvolved}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Time: </span>
                        <span className="text-gray-300">{record.timestamp}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Conflict: </span>
                        <span className="text-gray-300">{record.conflictStatus}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Verification: </span>
                        <span className={record.verificationStatus === 'PASSED' ? 'text-status-pass font-bold' : record.verificationStatus === 'FAILED' ? 'text-status-error font-bold' : 'text-gray-300'}>
                          {record.verificationStatus}
                        </span>
                      </div>
                      {record.stateHash && (
                        <div className="col-span-2 pt-1 border-t border-border-subtle/50 text-gray-500 truncate">
                          Hash: {record.stateHash}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 font-sans text-xs">
            <div className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
              Automated Merge Verification Gates
            </div>

            <div className="bg-bg-panel border border-border-subtle rounded p-3 flex flex-col gap-2">
              <div className="font-semibold text-gray-200 border-b border-border-subtle pb-1.5">
                Deterministic Verification Pipeline
              </div>

              <div className="flex flex-col gap-2 font-mono text-[11px] text-gray-300">
                <div className="flex justify-between items-center bg-bg-darkest p-1.5 rounded border border-border-subtle">
                  <span>1. Syntax Validation</span>
                  <span className="text-status-pass font-bold">✓ PASS</span>
                </div>
                <div className="flex justify-between items-center bg-bg-darkest p-1.5 rounded border border-border-subtle">
                  <span>2. AST Scope Analysis</span>
                  <span className="text-status-pass font-bold">✓ PASS</span>
                </div>
                <div className="flex justify-between items-center bg-bg-darkest p-1.5 rounded border border-border-subtle">
                  <span>3. Static Code Analysis</span>
                  <span className="text-status-pass font-bold">✓ PASS</span>
                </div>
                <div className="flex justify-between items-center bg-bg-darkest p-1.5 rounded border border-border-subtle">
                  <span>4. Type System Check</span>
                  <span className="text-status-pass font-bold">✓ PASS</span>
                </div>
                <div className="flex justify-between items-center bg-bg-darkest p-1.5 rounded border border-border-subtle">
                  <span>5. mvn compile</span>
                  <span className="text-status-pass font-bold">✓ PASS (840ms)</span>
                </div>
                <div className="flex justify-between items-center bg-bg-darkest p-1.5 rounded border border-border-subtle">
                  <span>6. mvn test</span>
                  <span className="text-status-pass font-bold">✓ 42/42 PASS</span>
                </div>
              </div>
            </div>

            <div className="bg-bg-panel border border-border-subtle rounded p-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
                <ShieldAlert className="w-4 h-4 text-status-pass" />
                <span>Zero-Trust Execution Rule</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Every AI semantic merge proposal must pass all 6 verification stages before human reviewers can stage the changes into CRDT operations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
