export {};

declare global {
  interface Window {
    api?: {
      ping: () => string;
      openFile: () => Promise<{ filePath: string; content: string } | null>;
      saveFile: (content: string) => Promise<{ filePath: string } | null>;
      saveFileAs: (content: string) => Promise<{ filePath: string } | null>;
    };
  }
}