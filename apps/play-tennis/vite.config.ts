import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cache-bust-html',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `<!-- build: ${new Date().toISOString()} -->\n  </head>`
        )
      },
    },
  ],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks: cached separately, rarely change
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
