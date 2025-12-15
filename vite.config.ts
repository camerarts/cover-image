
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Expose env vars to the client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
      'process.env.PASSWORD': JSON.stringify(env.PASSWORD),
      'process.env.VITE_PASSWORD': JSON.stringify(env.VITE_PASSWORD || env.PASSWORD)
    }
  }
})
