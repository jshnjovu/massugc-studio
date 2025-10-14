/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Refined neutral palette (Cursor/Claude inspired) - PRIMARY FOR CONTENT
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Content-focused text colors (neutral-based)
        content: {
          50: '#f9fafb',    // Very light content
          100: '#f3f4f6',   // Light content background
          200: '#e5e7eb',   // Subtle borders
          300: '#d1d5db',   // Muted text
          400: '#9ca3af',   // Secondary text
          500: '#6b7280',   // Body text
          600: '#4b5563',   // Strong text
          700: '#374151',   // Heading text
          800: '#1f2937',   // Dark heading
          900: '#111827',   // Darkest text
          950: '#030712',   // Nearly black
        },
        // Crimson accent colors (for intentional highlights only)
        crimson: {
          50: '#fef2f2',    // Very light crimson tint
          100: '#fee2e2',   // Light crimson
          200: '#fecaca',   // Soft crimson
          300: '#fca5a5',   // Medium crimson
          400: '#f87171',   // Bright crimson
          500: '#ef4444',   // Core crimson red
          600: '#dc2626',   // Deep crimson
          700: '#b91c1c',   // Darker crimson
          800: '#991b1b',   // Very dark crimson
          900: '#7f1d1d',   // Deepest crimson
          950: '#450a0a',   // Nearly black crimson
        },
        // Modern primary palette (less aggressive, more professional)
        primary: {
          50: '#f8fafc',    // Very light slate
          100: '#f1f5f9',   // Light slate
          200: '#e2e8f0',   // Soft slate
          300: '#cbd5e1',   // Medium slate
          400: '#94a3b8',   // Bright slate
          500: '#64748b',   // Core slate
          600: '#475569',   // Deep slate
          700: '#334155',   // Darker slate
          800: '#1e293b',   // Very dark slate
          900: '#0f172a',   // Deepest slate
          950: '#020617',   // Nearly black slate
        },
        // Warm accent colors (inspired by the orange-gold glow)
        accent: {
          50: '#fffbeb',    // Light amber
          100: '#fef3c7',   // Soft amber
          200: '#fde68a',   // Medium amber
          300: '#fcd34d',   // Bright amber
          400: '#fbbf24',   // Core amber
          500: '#f59e0b',   // Deep amber
          600: '#d97706',   // Darker amber
          700: '#b45309',   // Very dark amber
          800: '#92400e',   // Deepest amber
          900: '#78350f',   // Nearly black amber
        },
        // Professional dark theme (ElevenLabs inspired)
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
        // Surface colors with subtle warmth
        surface: {
          light: '#ffffff',
          'light-hover': '#fefefe',
          'light-active': '#fafafa',
          'light-warm': '#fffcfc',      // Subtle warm tint
          dark: '#0a0a0a',
          'dark-hover': '#171717',
          'dark-active': '#262626',
          'dark-warm': '#0f0a0a',       // Subtle warm dark tint
        },
        // Semantic colors with refined palette
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Special glow/highlight colors
        glow: {
          crimson: '#ef4444',         // Crimson glow
          accent: '#f59e0b',          // Amber glow
          white: '#ffffff',           // Pure white glow
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Monaco',
          'Inconsolata',
          'Roboto Mono',
          'monospace',
        ],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
        'dark-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'glow-crimson': '0 0 20px rgba(239, 68, 68, 0.15)',
        'glow-accent': '0 0 20px rgba(245, 158, 11, 0.15)',
        'glow-white': '0 0 20px rgba(255, 255, 255, 0.2)',
        'inner-glow': 'inset 0 0 20px rgba(239, 68, 68, 0.1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-crimson': 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
        'gradient-amber': 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
        'gradient-warm': 'linear-gradient(135deg, #fef2f2 0%, #fffbeb 100%)',
        'gradient-dark-warm': 'linear-gradient(135deg, #0f0a0a 0%, #030712 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-in',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-out': 'slideOut 0.3s ease-in',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 