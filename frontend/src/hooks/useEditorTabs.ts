import { useState, useCallback, useEffect } from 'react';
import { CollaborationManager } from '../core/sync/CollaborationManager';

export interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language: string;
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'java':
      return 'java';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    default:
      return 'plaintext';
  }
}

export function useEditorTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openFile = useCallback(async (filePath: string) => {
    let targetTabId = filePath;

    setTabs((prev) => {
      // Check if already open inside setTabs functional update to avoid stale closure state
      const existing = prev.find((t) => t.filePath === filePath);
      if (existing) {
        targetTabId = existing.id;
        return prev;
      }

      let content = '';
      const existingYText = CollaborationManager.getInstance().getCrdtEngine().getText(filePath).toString();
      if (existingYText) {
        content = existingYText;
      } else if (window.electronAPI) {
        // Asynchronously load content later if needed, but initialize synchronously or fetch
        content = '';
      } else if (filePath.endsWith('.java')) {
        content = `class Main {\n    public static void main(String[] args) {\n        int b = 20;\n        int result = 50;\n\n        System.out.println("b = " + b);\n        System.out.println("result = " + result);\n    }\n}\n`;
      } else {
        content = `// Content for ${filePath}`;
      }

      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      const newTab: EditorTab = {
        id: filePath,
        filePath,
        fileName,
        content,
        originalContent: content,
        isDirty: false,
        language: getLanguageFromPath(filePath),
      };

      return [...prev, newTab];
    });

    if (window.electronAPI) {
      const fileContent = await window.electronAPI.fs.readFile(filePath);
      if (fileContent !== null && fileContent !== undefined) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === filePath && tab.content === ''
              ? { ...tab, content: fileContent, originalContent: fileContent }
              : tab
          )
        );
      }
    }

    setActiveTabId(targetTabId);
  }, []);

  // Auto-open Main.java on initial load
  useEffect(() => {
    openFile('Main.java');
  }, [openFile]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const nextTabs = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        if (nextTabs.length > 0) {
          setActiveTabId(nextTabs[nextTabs.length - 1].id);
        } else {
          setActiveTabId(null);
        }
      }
      return nextTabs;
    });
  }, [activeTabId]);

  const updateTabContent = useCallback((tabId: string, newContent: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === tabId) {
          return {
            ...tab,
            content: newContent,
            isDirty: newContent !== tab.originalContent,
          };
        }
        return tab;
      })
    );
  }, []);

  const saveTab = useCallback(async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (window.electronAPI) {
      const success = await window.electronAPI.fs.writeFile(tab.filePath, tab.content);
      if (success) {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id === tabId) {
              return {
                ...t,
                originalContent: t.content,
                isDirty: false,
              };
            }
            return t;
          })
        );
      }
    } else {
      // Browser fallback
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === tabId) {
            return {
              ...t,
              originalContent: t.content,
              isDirty: false,
            };
          }
          return t;
        })
      );
    }
  }, [tabs]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeTabId) {
          saveTab(activeTabId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, saveTab]);

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openFile,
    closeTab,
    updateTabContent,
    saveTab,
  };
}
