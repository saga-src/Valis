
import { updateGame as webUpdateGame } from './storage'; 

const isElectron = () => typeof window !== 'undefined' && (window as any).api;

export const Games = {
  getById: async (id: string) => {
    if (isElectron()) return await (window as any).api.getGameById(id);
    throw new Error("Web mode getById not implemented");
  },
  update: async (game: any) => {
    if (isElectron()) return await (window as any).api.updateGame(game);
    return await webUpdateGame(game);
  },
  delete: async (id: string) => {
    if (isElectron()) return await (window as any).api.deleteGame(id);
    console.warn("Web mode delete not implemented");
  }
};

// ⚡ UPDATED LOGGER
export const System = {
  log: (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullMsg = `[VALIS-RENDERER ${timestamp}] ${message}`;
    
    // 1. Log to Browser Console (for DevTools)
    if (data) console.log(fullMsg, data);
    else console.log(fullMsg);

    // 2. Log to VS Code Terminal (via Electron Bridge)
    if (isElectron() && (window as any).api.log) {
      const payload = data ? `${fullMsg} | Data: ${JSON.stringify(data, null, 2)}` : fullMsg;
      (window as any).api.log(payload);
    }
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullMsg = `[VALIS-ERROR ${timestamp}] ${message}`;
    
    console.error(fullMsg, error || '');

    if (isElectron() && (window as any).api.log) {
      const payload = `${fullMsg} | Stack: ${error?.stack || error?.message || error}`;
      (window as any).api.log(payload);
    }
  }
};