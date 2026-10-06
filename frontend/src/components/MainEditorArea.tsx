import React from 'react';
import Editor from '@monaco-editor/react';
import { X, Sparkles } from 'lucide-react';
import { EditorTab } from '../hooks/useEditorTabs';

interface MainEditorAreaProps {
  tabs: EditorTab[];
  activeTab: EditorTab | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onContentChange: (tabId: string, newContent: string) => void;
}

export const MainEditorArea: React.FC<MainEditorAreaProps> = ({
  tabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  onContentChange,
}) => {
  return (
    <div
      data-testid="main-editor-area"
      className="flex-1 bg-bg-darkest flex flex-col h-full overflow-hidden"
    >
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
