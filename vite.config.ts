import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest: { name: 'DarkNotes — рукописные заметки', short_name: 'DarkNotes', description: 'Тетради, PDF и ваши идеи. Работает без интернета.', lang: 'ru', start_url: './', scope: './', display: 'standalone', background_color: '#080d12', theme_color: '#080d12', icons: [{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}] },
    workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,png,bcmap,ttf,pfb,woff,woff2,wasm}'], maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, navigateFallback: 'index.html', cleanupOutdatedCaches: true },
  })],
  build: { rollupOptions: { output: { manualChunks: { 'pdf-viewer': ['pdfjs-dist'], 'pdf-export': ['pdf-lib'], 'react-vendor': ['react','react-dom'] } } } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
