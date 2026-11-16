import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyDOMTheme = (t: Theme) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('theme', t);
  } catch {}
  const root = window.document.documentElement;
  if (t === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 1. URL parameter override for testing & deep-linking (?theme=light / ?theme=dark)
    if (typeof window !== 'undefined' && window.location?.search) {
      const urlParams = new URLSearchParams(window.location.search);
      const paramTheme = urlParams.get('theme');
      if (paramTheme === 'light' || paramTheme === 'dark') {
        applyDOMTheme(paramTheme);
        return paramTheme;
      }
    }

    // 2. Saved preference in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') {
        applyDOMTheme(saved);
        return saved;
      }

      // 3. System preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        applyDOMTheme('light');
        return 'light';
      }
    }

    applyDOMTheme('dark');
    return 'dark'; // Default to Obsidian dark
  });

  const currentThemeRef = React.useRef<Theme>(theme);
  currentThemeRef.current = theme;

  const setTheme = (newTheme: Theme) => {
    currentThemeRef.current = newTheme;
    applyDOMTheme(newTheme);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const next = currentThemeRef.current === 'dark' ? 'light' : 'dark';
    currentThemeRef.current = next;
    applyDOMTheme(next);
    setThemeState(next);
  };

  useEffect(() => {
    applyDOMTheme(theme);
    // Expose helpers on window for headless/testing automation
    if (typeof window !== 'undefined') {
      (window as any).__setTheme = setTheme;
      (window as any).__toggleTheme = toggleTheme;
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
