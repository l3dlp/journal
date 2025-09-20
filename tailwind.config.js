// tailwind.config.js
export default {
  darkMode: 'class',
  content: [
    './public/**/*.html',
    './src/**/*.{html,js}'
  ],
  theme: {
    extend: {
      container: { center: true, padding: '1rem' },
      fontFamily: { display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}