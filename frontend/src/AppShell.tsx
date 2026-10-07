import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { ProjectBar } from './components/ProjectBar';
import { LeftSidebar } from './components/LeftSidebar';
import { MainEditorArea } from './components/MainEditorArea';
import { NetworkAndSyncView } from './components/NetworkAndSyncView';
import { ConflictResolutionView } from './components/ConflictResolutionView';
import { SecurityMonitorView } from './components/SecurityMonitorView';
import { SourceControlView } from './components/SourceControlView';
import { ProjectHealthView } from './components/ProjectHealthView';
import { RightPanel } from './components/RightPanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { useEditorTabs } from './hooks/useEditorTabs';
import { useFileSystem } from './hooks/useFileSystem';
import { CollaborationManager } from './core/sync/CollaborationManager';
import { CrdtMonacoBinding } from './core/crdt/CrdtMonacoBinding';

export const AppShell: React.FC = () => {
  const [activeView, setActiveView] = useState<
    'editor' | 'network' | 'conflict' | 'security' | 'source-control' | 'merge-history' | 'health'
  >('editor');

  const {
    tabs,
    activeTab,
    setActiveTabId,
    openFile,
    closeTab,
    updateTabContent,
  } = useEditorTabs();

  const { openFolder, workspaceRoot } = useFileSystem();

  const collabManager = CollaborationManager.getInstance();
  const crdtEngine = collabManager.getCrdtEngine();
  const transportManager = collabManager.getTransportManager();
  const bindingsRef = useRef<Map<string, CrdtMonacoBinding>>(new Map());

  useEffect(() => {
    // Session is started when user explicitly creates or joins a room, or uses LAN discovery
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    collabManager.setActiveFilePath(activeTab.filePath);

    let binding = bindingsRef.current.get(activeTab.filePath);
    if (!binding) {
      binding = new CrdtMonacoBinding(crdtEngine, activeTab.filePath);
      bindingsRef.current.set(activeTab.filePath, binding);
    }

    const unbind = binding.bind(
      () => activeTab.content,
      (val) => updateTabContent(activeTab.id, val)
    );

    return () => {
      unbind();
    };
  }, [activeTab?.id, activeTab?.filePath]);

  const handleContentChange = (tabId: string, newContent: string) => {
    updateTabContent(tabId, newContent);
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    let binding = bindingsRef.current.get(tab.filePath);
    if (!binding) {
      binding = new CrdtMonacoBinding(crdtEngine, tab.filePath);
      bindingsRef.current.set(tab.filePath, binding);
    }
    binding.handleEditorChange(newContent);
  };

  const handleNewFile = () => {
    const fileName = prompt('Enter new file name:', 'Untitled.java');
    if (fileName) {
      const path = workspaceRoot ? `${workspaceRoot}/${fileName}` : `src/main/java/${fileName}`;
      openFile(path);
      setActiveView('editor');
    }
  };

  const handleNewFolder = () => {
    const folderName = prompt('Enter new folder name:', 'new-folder');
    if (folderName && window.electronAPI && workspaceRoot) {
      window.electronAPI.fs.createDir(`${workspaceRoot}/${folderName}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-darkest text-gray-200 font-sans">
      <TitleBar
        onOpenFolder={openFolder}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onSelectView={(view) => setActiveView(view as any)}
      />
      <ProjectBar />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          onOpenFile={(path) => {
            setActiveView('editor');
            openFile(path);
          }}
          activeView={activeView}
          onSelectView={(view) => setActiveView(view as any)}
          activeFilePath={activeTab?.filePath}
        />

        <div className="flex flex-col flex-1 overflow-hidden border-x border-border-subtle">
          <div className="flex flex-1 overflow-hidden">
            {activeView === 'network' ? (
              <NetworkAndSyncView crdtEngine={crdtEngine} />
            ) : activeView === 'conflict' ? (
              <ConflictResolutionView
                crdtEngine={crdtEngine}
                activeFilePath={activeTab?.filePath}
                activeCode={activeTab?.content}
                onApplyResolvedCode={(resolvedCode) => {
                  if (activeTab) {
                    handleContentChange(activeTab.id, resolvedCode);
                  }
                }}
              />
            ) : activeView === 'security' ? (
              <SecurityMonitorView
                crdtEngine={crdtEngine}
                activeFilePath={activeTab?.filePath}
                activeCode={activeTab?.content}
                onApplyFix={(fixedCode) => {
                  if (activeTab) {
                    handleContentChange(activeTab.id, fixedCode);
                  }
                }}
              />
            ) : activeView === 'source-control' ? (
              <SourceControlView />
            ) : activeView === 'health' ? (
              <ProjectHealthView />
            ) : (
              <MainEditorArea
                tabs={tabs}
                activeTab={activeTab}
                onSelectTab={setActiveTabId}
                onCloseTab={closeTab}
                onContentChange={handleContentChange}
              />
            )}
            <RightPanel />
          </div>
          <BottomPanel onSelectView={(view) => setActiveView(view as any)} />
        </div>
      </div>

      <StatusBar transportManager={transportManager} />
    </div>
  );
};
