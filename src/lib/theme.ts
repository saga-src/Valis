import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'stealth';

export function getSavedTheme(): Theme {
  const saved = localStorage.getItem('theme') as Theme;
  if (saved) return saved;
  
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  
  // Remove previous classes
  root.classList.remove('light', 'dark', 'stealth');
  
  // Add new class
  root.classList.add(theme);

  localStorage.setItem('theme', theme);
}

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = getSavedTheme();
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return { theme, changeTheme };
};