import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.ELECTRON_START_URL;

let currentFilePath = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

//
// FILE HANDLING
//

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'YAML', extensions: ['yml', 'yaml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');

  currentFilePath = filePath;

  return { filePath, content };
});

ipcMain.handle('save-file', async (_, content) => {
  if (!currentFilePath) {
    return ipcMain.emit('save-file-as', content);
  }

  await fs.writeFile(currentFilePath, content, 'utf-8');
  return { filePath: currentFilePath };
});

ipcMain.handle('save-file-as', async (_, content) => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'YAML', extensions: ['yml', 'yaml'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  await fs.writeFile(result.filePath, content, 'utf-8');

  currentFilePath = result.filePath;

  return { filePath: result.filePath };
});