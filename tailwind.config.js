/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './resources/views/**/*.edge',
    './app/templates/**/*.ts',
    './commands/**/*.ts',
    './public/**/*.html',
    './seo-*.html'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}