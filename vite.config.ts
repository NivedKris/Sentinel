import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

const cesiumPlugin = (cesium as any).default || cesium;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesiumPlugin()],
  server: {
    allowedHosts: [
      'rumpless-minerva-terrifically.ngrok-free.dev'
    ]
  }
})
