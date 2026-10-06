import { contextBridge, ipcRenderer } from 'electron';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface FSEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    createDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
    delete: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    onFSEvent: (callback: (event: FSEvent) => void) => {
      ipcRenderer.on('fs:event', (_event, value) => callback(value));
    },
    removeFSEventListener: () => {
      ipcRenderer.removeAllListeners('fs:event');
    }
  }
});
