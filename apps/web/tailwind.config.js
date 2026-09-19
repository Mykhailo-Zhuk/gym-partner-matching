/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1420',
        card: '#1a2233',
        border: '#2a3554',
        accent: '#4f8cff',
        success: '#34d399',
        error: '#e5534b',
        warning: '#f59e0b',
        text: '#e8ecf4',
        muted: '#8b93a7',
      },
    },
  },
  plugins: [],
};
