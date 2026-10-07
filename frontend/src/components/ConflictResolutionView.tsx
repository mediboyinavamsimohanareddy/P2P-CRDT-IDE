import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles, Play, Check, X, RefreshCw } from 'lucide-react';
import { VerificationRunner, StageResult } from '../core/merge/VerificationRunner';
import { MergeHistoryStore } from '../core/merge/MergeHistoryStore';
import { OperationLogStore } from '../core/security/OperationLogStore';
import { YjsCrdtEngine } from '../core/crdt/CrdtEngine';

export interface ConflictResolutionViewProps {
  crdtEngine?: YjsCrdtEngine;
  activeFilePath?: string;
  activeCode?: string;
  onApplyResolvedCode?: (resolvedCode: string) => void;
}

export const ConflictResolutionView: React.FC<ConflictResolutionViewProps> = ({
  crdtEngine,
  activeFilePath = 'LoginService.java',
  activeCode,
  onApplyResolvedCode,
}) => {
  const defaultCode = activeCode || `public boolean validatePassword(String pass) {\n    if (pass == null) return false;\n    // Ollama Mistral Merged: Length check (>=8) combined with digit requirement\n    return pass.length() >= 8 && pass.matches(".*\\\\d.*");\n}`;
  const [proposedCode, setProposedCode] = useState<string>(defaultCode);
  const [selectedVersion, setSelectedVersion] = useState<'A' | 'B' | 'C' | 'AI'>('AI');
  const [isVerifying, setIsVerifying] = useState(false);
  const [allPassed, setAllPassed] = useState(false);
  const [isStaged, setIsStaged] = useState(false);
  const [stages, setStages] = useState<StageResult[]>([
    { stage: 'syntax', label: 'Syntax Validation', status: 'idle' },
    { stage: 'ast', label: 'AST Scope Analysis', status: 'idle' },
    { stage: 'static', label: 'Static Analysis', status: 'idle' },
    { stage: 'typecheck', label: 'Type Check', status: 'idle' },
    { stage: 'compile', label: 'mvn compile', status: 'idle' },
    { stage: 'tests', label: 'mvn test', status: 'idle' },
  ]);

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setAllPassed(false);
    setIsStaged(false);

    const runner = new VerificationRunner();
    runner.onProgress((updatedStages) => {
      setStages(updatedStages);
    });

    const res = await runner.runVerification(proposedCode, activeFilePath);

    setIsVerifying(false);
    setAllPassed(res);
  };

  const handleAcceptMerge = () => {
    if (!allPassed) return;

    // Apply merged code into active CRDT text buffer
    if (crdtEngine && activeFilePath) {
      const ytext = crdtEngine.getText(activeFilePath);
      crdtEngine.getDoc().transact(() => {
        if (ytext.length > 0) ytext.delete(0, ytext.length);
        ytext.insert(0, proposedCode);
      }, 'conflict-resolution-applied');
    }

    if (onApplyResolvedCode) {
      onApplyResolvedCode(proposedCode);
    }

    const currentHash = crdtEngine ? crdtEngine.computeWorkspaceHash() : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    // 1. Record merge in MergeHistoryStore
    const nextMergeNum = MergeHistoryStore.getInstance().getRecords().length + 1;
    MergeHistoryStore.getInstance().addRecord({
      id: `SYNC-#${String(nextMergeNum).padStart(4, '0')}`,
      file: activeFilePath,
      operationType: 'Semantic AI Merge',
      peerInvolved: 'Peer-2 (Remote)',
      syncStatus: 'SYNCED',
      conflictStatus: 'RESOLVED',
      verificationStatus: 'PASSED',
      timestamp: new Date().toLocaleTimeString(),
      stateHash: currentHash,
    });

    // 2. Record operation in OperationLogStore
    OperationLogStore.getInstance().logAppliedOp('Local Peer (AI Merge)', 'UPDATE', activeFilePath);

    setIsStaged(true);
  };

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* Header Banner */}
      <div className="bg-bg-dark border border-status-warn/30 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-status-warn/10 text-status-warn">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-100">Resolve Semantic Overlap — {activeFilePath}</h1>
              <span className="bg-status-pass/20 text-status-pass text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                Ollama Mistral:latest · 95% confidence
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Three concurrent edits modified password policy validation logic. AI proposal must pass live compile &amp; test gates.
            </p>
          </div>
        </div>
      </div>

      {/* Version Cards Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Version A */}
        <div
          onClick={() => {
            setSelectedVersion('A');
            setProposedCode('return pass.length() > 8;');
          }}
          className={`bg-bg-dark border rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
            selectedVersion === 'A' ? 'border-peer-arjun bg-peer-arjun/5' : 'border-border-subtle hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-peer-arjun">Version A (Laptop A)</span>
            <span className="text-[10px] text-gray-500 font-mono">Length Check</span>
          </div>
          <pre className="text-[11px] font-mono bg-bg-darkest p-2 rounded text-gray-300">
            return pass.length() &gt; 8;
          </pre>
        </div>

        {/* Version B */}
        <div
          onClick={() => {
            setSelectedVersion('B');
            setProposedCode('return pass.matches(".*\\\\d.*");');
          }}
          className={`bg-bg-dark border rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
            selectedVersion === 'B' ? 'border-peer-rahul bg-peer-rahul/5' : 'border-border-subtle hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-peer-rahul">Version B (Laptop B)</span>
            <span className="text-[10px] text-gray-500 font-mono">Regex Digit</span>
          </div>
          <pre className="text-[11px] font-mono bg-bg-darkest p-2 rounded text-gray-300">
            return pass.matches(".*\\d.*");
          </pre>
        </div>

        {/* Version C */}
        <div
          onClick={() => {
            setSelectedVersion('C');
            setProposedCode('return pass.length() >= 12;');
          }}
          className={`bg-bg-dark border rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
            selectedVersion === 'C' ? 'border-peer-mohammed bg-peer-mohammed/5' : 'border-border-subtle hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-peer-mohammed">Version C (Laptop C Reconnected)</span>
            <span className="text-[10px] text-gray-500 font-mono">Strict 12+</span>
          </div>
          <pre className="text-[11px] font-mono bg-bg-darkest p-2 rounded text-gray-300">
            return pass.length() &gt;= 12;
          </pre>
        </div>
      </div>

      {/* AI Proposed Merge Block */}
      <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-gray-200">
            <Sparkles className="w-4 h-4 text-accent-mint" />
            <span>Ollama Mistral:latest Merge Proposal</span>
          </div>
          <span className="text-[11px] font-mono">
            {isStaged ? (
              <span className="text-status-pass font-bold">✓ MERGE ACCEPTED &amp; STAGED TO CRDT</span>
            ) : allPassed ? (
              <span className="text-status-pass font-bold">VERIFIED PASS</span>
            ) : isVerifying ? (
              <span className="text-status-warn">VERIFYING GATES...</span>
            ) : (
              <span className="text-gray-500">Pending Verification</span>
            )}
          </span>
        </div>

        <textarea
          value={proposedCode}
          onChange={(e) => setProposedCode(e.target.value)}
          className="text-[12px] font-mono bg-bg-darkest p-3 rounded text-gray-200 border border-border-subtle leading-relaxed h-32 w-full outline-none focus:border-accent-mint resize-none"
        />

        {/* Verification Pipeline Stages */}
        <div className="flex items-center justify-between bg-bg-panel p-2.5 rounded border border-border-subtle text-xs">
          <div className="flex items-center gap-3">
            {stages.map((stg) => (
              <span
                key={stg.stage}
                className={`flex items-center gap-1 text-[11px] font-mono ${
                  stg.status === 'passed'
                    ? 'text-status-pass'
                    : stg.status === 'running'
                    ? 'text-status-warn animate-pulse'
                    : 'text-gray-500'
                }`}
              >
                {stg.status === 'passed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {stg.label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="bg-status-info hover:bg-status-info/80 text-white font-semibold px-3 py-1 rounded text-xs flex items-center gap-1.5 shadow disabled:opacity-40"
            >
              {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isVerifying ? 'Running Gates...' : 'Run Verification Gates'}</span>
            </button>
            <button
              onClick={handleAcceptMerge}
              disabled={!allPassed || isStaged}
              className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-semibold px-3 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isStaged ? 'Staged to CRDT' : 'Accept & Stage Merge'}</span>
            </button>
            <button className="bg-bg-hover text-gray-400 px-3 py-1 rounded text-xs flex items-center gap-1">
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
