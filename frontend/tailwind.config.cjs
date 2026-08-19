module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#0EA5A8',
          'teal-dark': '#0B8A8D',
          'teal-light': '#14B8A6',
          'teal-subtle': '#E6FFFA',
          indigo: '#6366F1',
          'indigo-dark': '#4F46E5',
          purple: '#7C3AED',
          bg: '#F7F9FC',
          text: '#172033',
          muted: '#64748B',
          surface: '#FFFFFF',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'soft-md': '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
        'soft-lg': '0 10px 30px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03)',
        'soft-xl': '0 20px 40px -8px rgba(15, 23, 42, 0.12)',
        'teal-glow': '0 0 25px -5px rgba(14, 165, 168, 0.3)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
