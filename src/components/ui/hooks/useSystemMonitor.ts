
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'valis_system_monitor';
const DEFAULT_SETTINGS = { cpu: true, gpu: true, ram: true };

export function useSystemMonitor() {
  // 1. Initialize state from LocalStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  // 2. Function to update settings and notify other components
  const updateSettings = (newSettings: typeof DEFAULT_SETTINGS) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    
    // ⚡ Dispatch a custom event so the Sidebar updates instantly without a reload
    window.dispatchEvent(new Event('valis-settings-change'));
  };

  // 3. Listen for changes (Sync Reader)
  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings(JSON.parse(saved));
    };

    window.addEventListener('valis-settings-change', handleUpdate);
    return () => window.removeEventListener('valis-settings-change', handleUpdate);
  }, []);

  return [settings, updateSettings] as const;
}
