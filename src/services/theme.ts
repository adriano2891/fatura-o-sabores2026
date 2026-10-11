/**
 * Sabores & Nações - Gestor de Tema (Modo Escuro & Modo Claro)
 * Tema Padrão: Modo Escuro ('dark')
 * Persistência: localStorage ('sn_theme')
 */

import { useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'sn_theme';

export function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (e) {
    console.error('Erro ao ler tema do localStorage', e);
  }
  // Padrão obrigatório: Modo Escuro
  return 'dark';
}

export function applyThemeToDom(theme: ThemeMode): void {
  try {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  } catch (e) {
    console.error('Erro ao aplicar tema no DOM', e);
  }
}

// Inicializa imediatamente ao carregar o script para evitar FOUC
if (typeof window !== 'undefined') {
  applyThemeToDom(getInitialTheme());
}

type ThemeListener = (theme: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

export function setTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    console.error('Erro ao gravar tema no localStorage', e);
  }
  applyThemeToDom(theme);
  listeners.forEach((cb) => cb(theme));
}

export function toggleTheme(): ThemeMode {
  const current = getInitialTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function useTheme(): {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
  isDark: boolean;
  isLight: boolean;
} {
  const [theme, setLocalTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyThemeToDom(theme);

    const handler = (newTheme: ThemeMode) => {
      setLocalTheme(newTheme);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [theme]);

  return {
    theme,
    toggleTheme: () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
    },
    setTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };
}
