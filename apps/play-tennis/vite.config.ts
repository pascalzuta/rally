import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
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
  // Web deploy uses '/' (Vercel). Native build uses './' (Capacitor file serving).
  base: process.env.CAPACITOR_BUILD ? './' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    'import.meta.env.VITE_CAPACITOR_BUILD': JSON.stringify(process.env.CAPACITOR_BUILD || ''),
  },
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
}))
