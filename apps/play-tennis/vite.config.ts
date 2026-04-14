import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'cache-bust-html',
      transformIndexHtml(html) {
        let result = html.replace(
          '</head>',
          `<!-- build: ${new Date().toISOString()} -->\n  </head>`
        )
        // For native (Capacitor) builds, add native-app class and viewport-fit=cover
        if (process.env.CAPACITOR_BUILD) {
          result = result.replace('<html ', '<html class="native-app" ')
          result = result.replace(
            'user-scalable=no"',
            'user-scalable=no, viewport-fit=cover"'
          )
        }
        return result
      },
    },
  ],
  // Web deploy uses '/' (Vercel). Native build uses './' (Capacitor file serving).
  base: process.env.CAPACITOR_BUILD ? './' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
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
