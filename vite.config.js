const { defineConfig } = require('vite')
const react = require('@vitejs/plugin-react')
const path = require('path')

module.exports = defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
