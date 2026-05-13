/**
 * tailwind.config.js — MediFlow HMS Tailwind Configuration
 *
 * Uses CSS custom properties (--c-*) for theming so dark/light switching
 * is instant and doesn't require Tailwind's JIT dark: variant on every class.
 * CSS vars are defined in src/index.css under :root (light) and .dark (dark).
 *
 * Opacity-based variants (bg-card/10, text-tx1/60) require the RGB helper
 * format — see index.css for the --c-*-rgb companion variables.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  /* Activated via <html class="dark"> — toggled in ThemeContext */
  darkMode: 'class',

  theme: {
    extend: {
      /* ── Semantic colour aliases via CSS custom properties ── */
      colors: {
        page:    'var(--c-page)',
        sidebar: 'var(--c-sidebar)',
        card:    'var(--c-card)',
        surface: 'var(--c-surface)',
        border:  'var(--c-border)',
        tx1:     'var(--c-tx1)',   /* text primary */
        tx2:     'var(--c-tx2)',   /* text secondary */
        tx3:     'var(--c-tx3)',   /* text muted / placeholder */
      },

      /* ── Typography ── */
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      /* ── Border radii ── */
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },

      /* ── Box shadows ── */
      boxShadow: {
        'card':      '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        'card-md':   '0 4px 12px rgba(0,0,0,0.15)',
        'card-lg':   '0 10px 40px rgba(0,0,0,0.25)',
        'glow-indigo': '0 0 30px rgba(99,102,241,0.22)',
        'glow-cyan':   '0 0 30px rgba(6,182,212,0.18)',
        'modal':     '0 25px 80px rgba(0,0,0,0.5)',
      },

      /* ── Custom keyframe animations ── */
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        fadeInUp: {
          '0%':   { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)'    },
        },
      },
      animation: {
        shimmer:   'shimmer 2s linear infinite',
        fadeInUp:  'fadeInUp 0.4s ease-out both',
      },
    },
  },

  plugins: [],
};
