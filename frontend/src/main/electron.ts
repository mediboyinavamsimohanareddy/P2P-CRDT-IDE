import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import chokidar from 'chokidar';

let mainWindow: BrowserWindow | null = null;
let watcher: InstanceType<typeof chokidar.FSWatcher> | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Filesystem Operations
ipcMain.handle('fs:openFolder', async () => {
  if (!mainWindow) return null;
  const result = (await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })) as unknown as { canceled: boolean; filePaths: string[] };
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const folderPath = result.filePaths[0];
  
  // Setup watcher
  if (watcher) {
    await watcher.close();
  }
  
  watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher
    .on('add', (path: string) => mainWindow?.webContents.send('fs:event', { type: 'add', path }))
    .on('change', (path: string) => mainWindow?.webContents.send('fs:event', { type: 'change', path }))
    .on('unlink', (path: string) => mainWindow?.webContents.send('fs:event', { type: 'unlink', path }))
    .on('addDir', (path: string) => mainWindow?.webContents.send('fs:event', { type: 'addDir', path }))
    .on('unlinkDir', (path: string) => mainWindow?.webContents.send('fs:event', { type: 'unlinkDir', path }));

  return folderPath;
});

ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: join(dirPath, entry.name)
    }));
  } catch (error) {
    console.error('Failed to read directory:', error);
    return [];
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error('Failed to read file:', error);
    return null;
  }
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write file:', error);
    return false;
  }
});

ipcMain.handle('fs:createDir', async (_, dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Failed to create directory:', error);
    return false;
  }
});

ipcMain.handle('fs:delete', async (_, targetPath: string) => {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.unlink(targetPath);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete:', error);
    return false;
  }
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.rename(oldPath, newPath);
    return true;
  } catch (error) {
    console.error('Failed to rename:', error);
    return false;
  }
});
