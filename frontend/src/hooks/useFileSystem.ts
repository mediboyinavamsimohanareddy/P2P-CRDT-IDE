import { useState, useEffect, useCallback } from 'react';
import { FileEntry } from '../main/preload';

export function useFileSystem() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  const loadDirectory = useCallback(async (dirPath: string) => {
    if (!window.electronAPI) return;
    const entries = await window.electronAPI.fs.readDir(dirPath);
    // Sort: directories first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
    setFiles(entries);
  }, []);

  const openFolder = async () => {
    if (!window.electronAPI) return;
    const folderPath = await window.electronAPI.fs.openFolder();
    if (folderPath) {
      setWorkspaceRoot(folderPath);
      await loadDirectory(folderPath);
    }
  };

  useEffect(() => {
    if (!window.electronAPI || !workspaceRoot) return;

    window.electronAPI.fs.onFSEvent((event) => {
      // In a real app, we'd update a nested tree state.
      // For now, just reload the root directory if something changes.
      console.log('FS Event:', event);
      loadDirectory(workspaceRoot);
    });

    return () => {
      window.electronAPI.fs.removeFSEventListener();
    };
  }, [workspaceRoot, loadDirectory]);

  return {
    isElectron,
    workspaceRoot,
    files,
    openFolder,
    loadDirectory,
    readFile: window.electronAPI?.fs.readFile,
    writeFile: window.electronAPI?.fs.writeFile,
    createDir: window.electronAPI?.fs.createDir,
    deleteFile: window.electronAPI?.fs.delete,
    renameFile: window.electronAPI?.fs.rename,
  };
}
