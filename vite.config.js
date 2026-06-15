import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cambia 'vita-sana' col nome del tuo repo GitHub
  base: '/vita-sana/',
})
