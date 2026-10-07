import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Sparkles, ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react';
import { EditorTab } from '../hooks/useEditorTabs';
import { CodeSafetyAnalyzer } from '../core/security/CodeSafetyAnalyzer';
import { OllamaLocalProvider } from '../core/ai/AIProvider';
import { HackingSafetyStore, FileVerdict } from '../core/security/HackingSafetyStore';

interface MainEditorAreaProps {
  tabs: EditorTab[];
  activeTab: EditorTab | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onContentChange: (tabId: string, newContent: string) => void;
  onOpenSecurityDashboard?: () => void;
  onEditorMount?: (editor: any) => void;
}

export const MainEditorArea: React.FC<MainEditorAreaProps> = ({
  tabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  onContentChange,
  onOpenSecurityDashboard,
}) => {
  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);

  const [verdict, setVerdict] = useState<FileVerdict | null>(null);

  const analyzerRef = useRef<CodeSafetyAnalyzer>(
    new CodeSafetyAnalyzer(new OllamaLocalProvider('http://localhost:11434'))
  );

  // Subscribe to HackingSafetyStore updates
  useEffect(() => {
    const store = HackingSafetyStore.getInstance();
    const updateLocalVerdict = () => {
      if (activeTab) {
        setVerdict(store.getVerdict(activeTab.fileName));
      }
    };

    updateLocalVerdict();
    const unsubscribe = store.subscribe(updateLocalVerdict);
    return () => unsubscribe();
  }, [activeTab?.id, activeTab?.fileName]);

  // Debounced safety scan when active tab content changes
  useEffect(() => {
    if (!activeTab || !activeTab.content) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const result = await analyzerRef.current.analyzeCode(
        activeTab.content,
        activeTab.fileName,
        activeTab.language
      );

      // Apply Monaco Markers if editor is mounted
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          const markers = result.findings.map((f) => ({
            startLineNumber: f.startLine,
            startColumn: f.startColumn || 1,
            endLineNumber: f.endLine,
            endColumn: f.endColumn || 100,
            message: `[Hacking Safety] ${f.threatType}: ${f.why}\nRecommendation: ${f.recommendation}`,
            severity:
              f.status === 'High Risk'
                ? monacoRef.current.MarkerSeverity.Error
                : monacoRef.current.MarkerSeverity.Warning,
          }));

          monacoRef.current.editor.setModelMarkers(model, 'hacking-safety', markers);
        }
      }
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeTab?.content, activeTab?.fileName, activeTab?.language]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (onEditorMount) {
      onEditorMount(editor);
    }
  };

  const threatLevel = verdict?.threatLevel || 'Safe';
  const securityScore = verdict?.securityScore ?? 100;

  return (
    <div
      data-testid="main-editor-area"
      className="flex-1 bg-bg-darkest flex flex-col h-full overflow-hidden"
    >
      {/* Safety Status Banner */}
      {activeTab && (
        <div className="bg-bg-dark/95 border-b border-border-subtle px-3 py-1.5 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            {threatLevel === 'High Risk' ? (
              <span className="flex items-center gap-1 text-red-400 font-semibold bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                High Risk ({securityScore}/100)
              </span>
            ) : threatLevel === 'Warning' ? (
              <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Warning ({securityScore}/100)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Safe ({securityScore}/100)
              </span>
            )}
            <span className="text-gray-400 italic">
              Syntax correctness does not guarantee security.
            </span>
          </div>

          <button
            onClick={onOpenSecurityDashboard}
            className="flex items-center gap-1 text-xs text-accent-mint hover:text-accent-mint/80 bg-accent-mint/10 border border-accent-mint/30 px-2 py-0.5 rounded transition-colors"
          >
            <Shield className="w-3 h-3" />
            Security Dashboard ({verdict?.findings?.length || 0})
          </button>
        </div>
      )}

      {/* Editor tabs */}
      <div className="h-9 bg-bg-dark border-b border-border-subtle flex items-center px-1 gap-1 overflow-x-auto select-none">
        {tabs.length === 0 ? (
          <div className="text-gray-500 text-xs px-3 italic">No files open</div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-t border-x border-border-subtle cursor-pointer ${
                  isActive
                    ? 'bg-bg-darkest border-t-2 border-accent-mint text-gray-200'
                    : 'text-gray-400 hover:bg-bg-hover'
                }`}
              >
                <span>{tab.fileName}</span>
                {tab.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warn" title="Unsaved changes" />
                )}
                <X
                  className="w-3 h-3 text-gray-500 hover:text-gray-300 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Monaco Editor / Empty State */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab ? (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onMount={handleEditorMount}
            onChange={(value) => onContentChange(activeTab.id, value || '')}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: '"JetBrains Mono", monospace',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 select-none">
            <Sparkles className="w-8 h-8 text-accent-mint/40" />
            <div className="text-sm font-medium">DecentraIDE Monaco Editor</div>
            <div className="text-xs text-gray-600">Select a file from the Explorer tree to start editing</div>
          </div>
        )}
      </div>
    </div>
  );
};
