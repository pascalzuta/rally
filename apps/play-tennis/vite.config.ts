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
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && (req.url.startsWith('/t/') || req.url.startsWith('/r/'))) {
            req.url = '/index.html'
          }
          next()
        })
      },
    },
  ],
  base: '/',
})
