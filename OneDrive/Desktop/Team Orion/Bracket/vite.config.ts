import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // The fix is applied here inside the react() plugin options
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  // Your base path is correctly preserved
  base: '/Team0rion-Tournament-Brackets/',
})