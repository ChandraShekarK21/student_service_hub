import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const adminRouteEntry = {
  name: 'admin-route-entry',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url) {
        const [pathname, query] = req.url.split('?')
        if (pathname === '/admin' || pathname.startsWith('/admin/')) {
          req.url = `/admin-index.html${query ? `?${query}` : ''}`
        }
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminRouteEntry],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin-index.html',
      },
    },
  },
})
