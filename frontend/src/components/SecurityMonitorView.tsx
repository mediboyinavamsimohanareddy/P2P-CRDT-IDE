import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Check,
  ArrowRight,
  X,
  Lock,
  Eye,
  History,
  FileCode,
} from 'lucide-react';
import { CodeSafetyAnalyzer, CodeSafetyAnalysisResult } from '../core/security/CodeSafetyAnalyzer';
import { OllamaLocalProvider } from '../core/ai/AIProvider';
import { YjsCrdtEngine } from '../core/crdt/CrdtEngine';
import { HackingSafetyStore, SecurityFinding, FileVerdict, AuditDecisionLog } from '../core/security/HackingSafetyStore';

export interface SecurityMonitorViewProps {
  crdtEngine?: YjsCrdtEngine;
  activeFilePath?: string;
  activeCode?: string;
  onApplyFix?: (fixedCode: string) => void;
}

export const SecurityMonitorView: React.FC<SecurityMonitorViewProps> = ({
  crdtEngine,
  activeFilePath = 'src/App.java',
  activeCode,
  onApplyFix,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CodeSafetyAnalysisResult | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [showFixPreview, setShowFixPreview] = useState(false);
  const [reanalysisStatus, setReanalysisStatus] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<FileVerdict | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditDecisionLog[]>([]);

  const safetyStore = HackingSafetyStore.getInstance();

  useEffect(() => {
    const updateState = () => {
      setVerdict(safetyStore.getVerdict(activeFilePath));
      setAuditLogs(safetyStore.getAuditLogs());
    };

    updateState();
    const unsubscribe = safetyStore.subscribe(updateState);
    return () => unsubscribe();
  }, [activeFilePath]);

  useEffect(() => {
    runAnalysis();
  }, [activeFilePath]);

  const getCurrentCode = (): string => {
    if (crdtEngine && activeFilePath) {
      const text = crdtEngine.getText(activeFilePath).toString();
      if (text && text.trim().length > 0) return text;
    }
    if (activeCode && activeCode.trim().length > 0) return activeCode;
    return '';
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setReanalysisStatus(null);
    try {
      const codeToAnalyze = getCurrentCode();
      const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider('http://localhost:11434'));
      const res = await analyzer.analyzeCode(codeToAnalyze, activeFilePath);
      setResult(res);
      setVerdict(res.verdict);
    } catch (e) {
      console.error('Safety analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyFix = async () => {
    const fixToApply = selectedFinding?.suggestedFix || result?.suggestedFix;
    if (!fixToApply) return;

    setAnalyzing(true);
    setReanalysisStatus('Re-analyzing proposed AI fix for safety verification...');
    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider('http://localhost:11434'));
    const currentCode = getCurrentCode();

    const { isVerifiedSafe, newResult } = await analyzer.reanalyzeFix(currentCode, fixToApply, activeFilePath);

    if (isVerifiedSafe) {
      if (crdtEngine && activeFilePath) {
        const yText = crdtEngine.getText(activeFilePath);
        crdtEngine.getDoc().transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, fixToApply);
        }, 'security-fix-applied');
      }

      if (onApplyFix) {
        onApplyFix(fixToApply);
      }

      setResult(newResult);
      setShowFixPreview(false);
      setSelectedFinding(null);
    } else {
      alert('Proposed fix failed secondary security re-analysis. Fix was not applied.');
    }
    setAnalyzing(false);
    setReanalysisStatus(null);
  };

  const handleAcknowledgeRisk = () => {
    safetyStore.acknowledgeRisk(activeFilePath, 'Developer manual override');
  };

  const handleIsolateCode = () => {
    safetyStore.isolateCode(activeFilePath);
  };

  const securityScore = verdict?.securityScore ?? 100;
  const threatLevel = verdict?.threatLevel ?? 'Safe';
  const findings = verdict?.findings || [];

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-status-pass">
            <Shield className="w-5 h-5 text-accent-mint" />
            Hacking Safety Management Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Syntax correctness does not guarantee security. Detect, explain, recommend, record decisions, and gate execution.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="bg-bg-panel border border-border-subtle hover:bg-bg-dark text-gray-200 font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          <span>{analyzing ? 'Analyzing...' : 'Run Safety Audit'}</span>
        </button>
      </div>

      {/* Top Metric Bar */}
      <div className="grid grid-cols-4 gap-4">
        {/* Security Score */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-semibold">Security Score</span>
          <div className="flex items-end justify-between mt-2">
            <span
              className={`text-2xl font-extrabold font-mono ${
                securityScore >= 80
                  ? 'text-emerald-400'
                  : securityScore >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {securityScore} / 100
            </span>
            <div className="w-16 h-2 bg-bg-panel rounded-full overflow-hidden mb-1">
              <div
                className={`h-full ${
                  securityScore >= 80
                    ? 'bg-emerald-400'
                    : securityScore >= 50
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${securityScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Threat Level */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-semibold">Threat Level</span>
          <div className="mt-2 flex items-center gap-2">
            {threatLevel === 'High Risk' ? (
              <span className="flex items-center gap-1 text-red-400 font-bold bg-red-950/60 border border-red-800/60 px-2.5 py-1 rounded text-xs">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                HIGH RISK
              </span>
            ) : threatLevel === 'Warning' ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                WARNING
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                SAFE
              </span>
            )}
          </div>
        </div>

        {/* Execution Gate Status */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-semibold">Execution Gate</span>
          <div className="mt-2 flex items-center gap-2">
            {verdict?.isExecutionAllowed ? (
              <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
                <Check className="w-3.5 h-3.5" /> Allowed
              </span>
            ) : (
              <span className="text-red-400 font-semibold text-xs flex items-center gap-1 bg-red-950/60 border border-red-800/60 px-2 py-1 rounded">
                <Lock className="w-3.5 h-3.5" /> Blocked
              </span>
            )}
          </div>
        </div>

        {/* Verification Status */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-semibold">Verification Status</span>
          <span className="mt-2 text-xs font-mono text-accent-mint bg-accent-mint/10 border border-accent-mint/30 px-2.5 py-1 rounded w-max">
            {verdict?.verificationStatus || 'Not Scanned'}
          </span>
        </div>
      </div>

      {/* Developer Decision & Override Controls */}
      <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <FileCode className="w-4 h-4 text-accent-mint" />
          <span>Active File: <strong className="font-mono text-gray-100">{activeFilePath}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAcknowledgeRisk}
            className="bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border border-amber-700/60 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Acknowledge Risk &amp; Unlock Execution</span>
          </button>

          <button
            onClick={handleIsolateCode}
            className="bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/60 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Isolate Code</span>
          </button>
        </div>
      </div>

      {/* Findings Section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Detected Vulnerabilities &amp; Insecure Logic ({findings.length})
        </h2>

        {findings.length === 0 ? (
          <div className="bg-bg-dark border border-border-subtle rounded-lg p-6 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <span>No security vulnerabilities or malicious logic detected in this file.</span>
          </div>
        ) : (
          findings.map((f) => (
            <div
              key={f.id}
              className={`bg-bg-dark border rounded-lg p-4 flex flex-col gap-3 ${
                f.status === 'High Risk' ? 'border-red-800/60' : 'border-amber-800/60'
              }`}
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                      f.status === 'High Risk'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    [{f.severity}] {f.status}
                  </span>
                  <span className="font-bold text-xs text-gray-100">{f.threatType}</span>
                  <span className="text-[10px] font-mono text-gray-400">({f.source.toUpperCase()} Detector)</span>
                </div>
                <span className="text-xs font-mono text-gray-400">Lines {f.startLine}-{f.endLine}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 font-semibold block mb-1">Risk Explanation (Why):</span>
                  <p className="bg-bg-panel p-2.5 rounded border border-border-subtle text-gray-300 leading-relaxed">
                    {f.why}
                  </p>
                </div>

                <div>
                  <span className="text-gray-400 font-semibold block mb-1">Recommended Mitigation:</span>
                  <p className="bg-bg-panel p-2.5 rounded border border-border-subtle text-gray-300 leading-relaxed">
                    {f.recommendation}
                  </p>
                </div>
              </div>

              {f.snippet && (
                <div className="text-xs">
                  <span className="text-gray-400 font-semibold block mb-1">Flagged Code Snippet:</span>
                  <pre className="bg-bg-darkest p-2.5 rounded border border-border-subtle font-mono text-red-300 text-[11px] overflow-x-auto">
                    {f.snippet}
                  </pre>
                </div>
              )}

              {f.suggestedFix && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setSelectedFinding(f);
                      setShowFixPreview(true);
                    }}
                    className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-bold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review Recommended Fix</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Audit History Log Feed */}
      <div className="flex flex-col gap-3 pt-2">
        <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <History className="w-4 h-4 text-accent-mint" />
          Local Security Audit Decision Log
        </h2>

        <div className="bg-bg-dark border border-border-subtle rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-[11px]">
          {auditLogs.length === 0 ? (
            <div className="text-gray-500 text-xs italic py-2 text-center">No audit decisions logged yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between py-1.5 border-b border-border-subtle/50 last:border-0 text-gray-300"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="text-accent-mint font-semibold">[{log.action}]</span>
                  <span>{log.details}</span>
                </div>
                {log.threatLevel && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      log.threatLevel === 'High Risk'
                        ? 'text-red-400 bg-red-950'
                        : log.threatLevel === 'Warning'
                        ? 'text-amber-400 bg-amber-950'
                        : 'text-emerald-400 bg-emerald-950'
                    }`}
                  >
                    {log.threatLevel}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Fix Modal */}
      {showFixPreview && (selectedFinding || result) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-bg-dark border border-border-subtle rounded-xl p-6 w-full max-w-3xl flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent-mint" />
                Review AI Security Correction — {activeFilePath}
              </h3>
              <button onClick={() => setShowFixPreview(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 font-mono text-[11px]">
              <div className="flex flex-col gap-1.5">
                <span className="text-status-error font-bold text-xs font-sans">BEFORE (Flagged Code):</span>
                <pre className="bg-bg-darkest p-3 rounded border border-status-error/30 text-gray-300 overflow-x-auto max-h-64 font-mono">
                  {getCurrentCode()}
                </pre>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-status-pass font-bold text-xs font-sans">AFTER (Rectified Code):</span>
                <pre className="bg-bg-darkest p-3 rounded border border-status-pass/30 text-gray-200 overflow-x-auto max-h-64 font-mono">
                  {selectedFinding?.suggestedFix || result?.suggestedFix}
                </pre>
              </div>
            </div>

            {reanalysisStatus && (
              <div className="text-xs text-status-info italic flex items-center gap-2 font-mono bg-bg-panel p-2 rounded">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {reanalysisStatus}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowFixPreview(false)}
                className="px-4 py-2 rounded text-xs text-gray-400 hover:text-gray-200"
              >
                Dismiss
              </button>
              <button
                onClick={handleApplyFix}
                disabled={analyzing}
                className="bg-status-pass hover:bg-status-pass/80 text-bg-darkest font-bold px-5 py-2 rounded text-xs flex items-center gap-1.5 shadow"
              >
                <Check className="w-4 h-4" />
                <span>Approve &amp; Apply via Yjs Transaction</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
