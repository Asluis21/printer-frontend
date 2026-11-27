import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // listen on all network interfaces, not just localhost,
    // so other devices can open http://<this-machine-ip>:5173
    host: true,
    // the browser calls /api on the same origin as the page (so no CORS),
    // and Vite forwards it to the backend running on this machine
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
