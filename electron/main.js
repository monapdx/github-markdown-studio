import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.ELECTRON_START_URL;
let mainWindow = null;
let currentFilePath = null;

function createWindow() {
  console.log('[main] creating window');
  console.log('[main] __dirname =', __dirname);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] window finished load');
  });

  mainWindow.webContents.openDevTools({ mode: 'detach' });

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

ipcMain.handle('dialog:openFile', async () => {
  console.log('[main] dialog:openFile called');

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'YAML', extensions: ['yml', 'yaml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  console.log('[main] open dialog result:', result);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  currentFilePath = filePath;

  return { filePath, content };
});

ipcMain.handle('dialog:saveFile', async (_, content) => {
  console.log('[main] dialog:saveFile called');

  if (!currentFilePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'YAML', extensions: ['yml', 'yaml'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    currentFilePath = result.filePath;
  }

  await fs.writeFile(currentFilePath, content, 'utf-8');
  return { filePath: currentFilePath };
});

ipcMain.handle('dialog:saveFileAs', async (_, content) => {
  console.log('[main] dialog:saveFileAs called');

  const result = await dialog.showSaveDialog(mainWindow, {
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