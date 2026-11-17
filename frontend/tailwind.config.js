/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00142f', // Deep navy
          dark: '#000c1e',
          light: '#072b5c',
          container: '#071c37',
        },
        secondary: {
          DEFAULT: '#0051d5', // Vibrant action blue
          hover: '#0041ab',
          light: '#e0ecff',
          container: '#346cef',
        },
        'bg-base': '#f8f9ff',
        'surface-default': '#ffffff',
        'surface-sunken': '#f1f5f9',
        'surface-elevated': '#e2e8f0',
        'border-subtle': '#e2e8f0',
        success: {
          bg: '#ecfdf5',
          text: '#065f46',
          icon: '#059669',
          border: '#a7f3d0',
        },
        warning: {
          bg: '#fffbeb',
          text: '#92400e',
          border: '#fde68a',
        },
        danger: {
          bg: '#fef2f2',
          container: '#fee2e2',
          text: '#991b1b',
          action: '#dc2626',
          border: '#fecaca',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'component': '8px',
        'card': '12px',
        'pill': '9999px',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 20, 47, 0.05)',
        'elevated': '0 12px 32px -4px rgba(0, 20, 47, 0.08)',
        'modal': '0 24px 48px -8px rgba(0, 20, 47, 0.16)',
      },
    },
  },
  plugins: [],
}
