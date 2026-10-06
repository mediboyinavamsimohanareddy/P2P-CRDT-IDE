import { FileEntry, FSEvent } from '../main/preload';

export interface ElectronAPI {
  fs: {
    openFolder: () => Promise<string | null>;
    readDir: (dirPath: string) => Promise<FileEntry[]>;
    readFile: (filePath: string) => Promise<string | null>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    createDir: (dirPath: string) => Promise<boolean>;
    delete: (targetPath: string) => Promise<boolean>;
    rename: (oldPath: string, newPath: string) => Promise<boolean>;
    onFSEvent: (callback: (event: FSEvent) => void) => void;
    removeFSEventListener: () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
