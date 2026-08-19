import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Catastro 2026',
        short_name: 'Catastro',
        description: 'Geoportal de Catastro Offline',
        theme_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'logo_gad.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo_gad.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo_gad.png',
            sizes: 'any',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
  server: {
    host: true, // Permite acceso desde la red local
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/token': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  define: {
    'process.env': {}
  }
})
