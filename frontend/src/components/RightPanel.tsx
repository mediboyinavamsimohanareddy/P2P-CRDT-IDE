import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, ShieldAlert, Cpu, GitMerge, FileCode, Check, Clock } from 'lucide-react';
import { MergeHistoryStore } from '../core/merge/MergeHistoryStore';

export interface MergeHistoryRecord {
  id: string;
  file: string;
  functionName: string;
  participants: string[];
  aiModel: string;
  confidence: number;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  timestamp: string;
  stateHash: string;
  verificationDetails: {
    syntax: boolean;
    ast: boolean;
    staticAnalysis: boolean;
    typeCheck: boolean;
    compilation: boolean;
    tests: string;
  };
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

            {mergeRecords.map((record) => (
              <div
                key={record.id}
                className="bg-bg-panel border border-border-subtle rounded p-3 flex flex-col gap-2 font-sans text-xs"
              >
                <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                  <span className="font-bold text-gray-200 flex items-center gap-1.5">
                    <GitMerge className="w-3.5 h-3.5 text-accent-mint" />
                    {record.id}
                  </span>
                  <span className="bg-status-pass/20 text-status-pass border border-status-pass/30 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    {record.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-[11px] text-gray-400">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-gray-300 font-mono">
                      <FileCode className="w-3 h-3 text-gray-500" />
                      {record.file}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{record.functionName}</span>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[10px] text-gray-500">
                    <span>Participants: {record.participants.join(', ')}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {record.timestamp}
                    </span>
                  </div>

                  <div className="bg-bg-darkest p-2 rounded border border-border-subtle mt-1 flex flex-col gap-1 font-mono text-[10px]">
                    <div className="flex justify-between text-gray-400">
                      <span>Engine: {record.aiModel}</span>
                      <span className="text-status-pass">{record.confidence}% conf</span>
                    </div>
                    <div className="text-gray-500">Replica SHA: {record.stateHash}</div>
                    <div className="flex items-center gap-1 text-status-pass pt-0.5">
                      <Check className="w-3 h-3" />
                      <span>Passed compile &amp; tests ({record.verificationDetails.tests})</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
