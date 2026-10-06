import React, { useState } from 'react';
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
        />

        <div className="flex flex-col flex-1 overflow-hidden border-x border-border-subtle">
          <div className="flex flex-1 overflow-hidden">
            {activeView === 'network' ? (
              <NetworkAndSyncView />
            ) : activeView === 'conflict' ? (
              <ConflictResolutionView />
            ) : activeView === 'security' ? (
              <SecurityMonitorView />
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
                onContentChange={updateTabContent}
              />
            )}
            <RightPanel />
          </div>
          <BottomPanel />
        </div>
      </div>

      <StatusBar />
    </div>
  );
};
