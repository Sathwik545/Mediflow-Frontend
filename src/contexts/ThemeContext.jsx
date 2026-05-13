/**
 * ThemeContext.jsx — MediFlow Dark / Light Theme Manager
 *
 * Persists choice in localStorage under key 'mf-theme'.
 * Activates dark mode by adding class="dark" to <html>.
 * Default: dark (enterprise product default).
 *
 * Usage:
 *   const { theme, toggleTheme } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('mf-theme') || 'dark'
  );

  /* Sync class on <html> whenever theme changes */
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else                  root.classList.remove('dark');
    localStorage.setItem('mf-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
