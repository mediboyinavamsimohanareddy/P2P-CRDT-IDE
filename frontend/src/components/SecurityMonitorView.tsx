import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Check, ArrowRight, X } from 'lucide-react';
import { CodeSafetyAnalyzer, CodeSafetyAnalysisResult } from '../core/security/CodeSafetyAnalyzer';
import { GroqProvider } from '../core/ai/GroqProvider';
import { YjsCrdtEngine } from '../core/crdt/CrdtEngine';

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
  const [showFixPreview, setShowFixPreview] = useState(false);
  const [reanalysisStatus, setReanalysisStatus] = useState<string | null>(null);

  const sampleInsecureCode = `public class AuthService {
    // HARDCODED CREDENTIAL RISK
    private String adminPassword = "SuperSecretAdminPassword123!";
    
    public boolean login(String user, String pass) {
        if ("admin".equals(user) && adminPassword.equals(pass)) {
            // UNGUARDED SYSTEM COMMAND EXECUTION
            try {
                Runtime.getRuntime().exec("cmd.exe /c echo Logged in user: " + user);
            } catch (Exception e) {}
            return true;
        }
        return false;
    }
}`;

  useEffect(() => {
    runAnalysis();
  }, [activeFilePath]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setReanalysisStatus(null);
    try {
      let codeToAnalyze = sampleInsecureCode;
      if (crdtEngine && activeFilePath) {
        const text = crdtEngine.getText(activeFilePath).toString();
        if (text && text.trim().length > 0) {
          codeToAnalyze = text;
        }
      } else if (activeCode && activeCode.trim().length > 0) {
        codeToAnalyze = activeCode;
      }

      const analyzer = new CodeSafetyAnalyzer(new GroqProvider());
      const res = await analyzer.analyzeCode(codeToAnalyze, activeFilePath);
      setResult(res);
    } catch (e) {
      console.error('Safety analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyFix = async () => {
    if (!result || !result.suggestedFix) return;

    // 1. Re-analyze fix before applying
    setAnalyzing(true);
    setReanalysisStatus('Re-analyzing proposed AI fix for safety verification...');
    const analyzer = new CodeSafetyAnalyzer(new GroqProvider());
    let currentCode = sampleInsecureCode;
    if (crdtEngine && activeFilePath) {
      const text = crdtEngine.getText(activeFilePath).toString();
      if (text && text.trim().length > 0) currentCode = text;
    } else if (activeCode && activeCode.trim().length > 0) {
      currentCode = activeCode;
    }
    const { isVerifiedSafe, newResult } = await analyzer.reanalyzeFix(currentCode, result.suggestedFix, activeFilePath);

    if (isVerifiedSafe) {
      // 2. Apply fix through Yjs Transaction
      if (crdtEngine && activeFilePath) {
        const yText = crdtEngine.getText(activeFilePath);
        crdtEngine.getDoc().transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, result.suggestedFix);
        }, 'security-fix-applied');
      }

      if (onApplyFix) {
        onApplyFix(result.suggestedFix);
      }

      setResult(newResult);
      setShowFixPreview(false);
      alert('Security correction successfully applied through Yjs transaction across collaborative replicas.');
    } else {
      alert('Proposed fix failed secondary security re-analysis. Fix was not applied.');
    }
    setAnalyzing(false);
    setReanalysisStatus(null);
  };

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-status-pass">
            <Shield className="w-5 h-5 text-accent-mint" />
            AI Hacker &amp; Code Safety Management
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Detect syntactically valid code containing suspicious, malicious, or insecure logic.
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

      {/* Distinction Banner: Syntax Valid vs Security Safe */}
      <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-status-pass" />
            <span className="font-semibold text-gray-200">Syntax Correct: <span className="text-status-pass">VALID</span></span>
          </div>
          <div className="flex items-center gap-2">
            {result && !result.isSecuritySafe ? (
              <ShieldAlert className="w-4 h-4 text-status-error" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-status-pass" />
            )}
            <span className="font-semibold text-gray-200">
              Security Safe: {result && !result.isSecuritySafe ? <span className="text-status-error">RISK DETECTED</span> : <span className="text-status-pass">SAFE</span>}
            </span>
          </div>
        </div>
        {result && (
          <span className="text-[10px] font-mono text-gray-400">
            Confidence: <span className="text-accent-mint font-bold">{result.confidence}%</span>
          </span>
        )}
      </div>

      {/* Analysis Result Card */}
      {result && (
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono uppercase ${
                result.severity === 'CRITICAL' || result.severity === 'HIGH' ? 'bg-status-error/20 text-status-error' : 'bg-status-pass/20 text-status-pass'
              }`}>
                {result.severity} SEVERITY
              </span>
              <h2 className="text-sm font-bold text-gray-100">{result.title}</h2>
            </div>
            <span className="text-xs font-mono text-gray-400">{result.affectedArea}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-gray-400 font-semibold">Category:</span>
              <span className="text-gray-200 font-mono bg-bg-panel p-2 rounded border border-border-subtle">{result.category}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-400 font-semibold">Recommended Fix Strategy:</span>
              <span className="text-gray-200 bg-bg-panel p-2 rounded border border-border-subtle">{result.recommendation}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-gray-400 font-semibold">Security Explanation:</span>
            <div className="bg-bg-panel p-3 rounded border border-border-subtle text-gray-300 leading-relaxed font-sans">
              {result.explanation}
            </div>
          </div>

          {!result.isSecuritySafe && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowFixPreview(true)}
                className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 shadow"
              >
                <span>Review AI Proposed Fix</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Review Fix Modal */}
      {showFixPreview && result && (
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
                <span className="text-status-error font-bold text-xs font-sans">BEFORE (Insecure Logic):</span>
                <pre className="bg-bg-darkest p-3 rounded border border-status-error/30 text-gray-300 overflow-x-auto max-h-64 font-mono">
                  {crdtEngine?.getText(activeFilePath).toString() || activeCode || sampleInsecureCode}
                </pre>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-status-pass font-bold text-xs font-sans">AFTER (AI Safe Rectification):</span>
                <pre className="bg-bg-darkest p-3 rounded border border-status-pass/30 text-gray-200 overflow-x-auto max-h-64">
                  {result.suggestedFix}
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
