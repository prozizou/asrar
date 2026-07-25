'use client';
// Bouton flottant clair/sombre — port de theme.js. Le thème initial est posé
// avant le rendu par un petit script inline dans le layout (anti-FOUC).
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(cur);
  }, []);

  const toggle = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem('asrar_theme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <button id="asrarThemeBtn" type="button" aria-label="Basculer clair / sombre" onClick={toggle}>
      {theme === 'light' ? '☀️' : '🌙'}
    </button>
  );
}
