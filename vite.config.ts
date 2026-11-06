import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter: funciona em qualquer subcaminho do GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
          tiptap: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/pm/state', '@tiptap/pm/view'],
          quadro: ['@xyflow/react', '@dagrejs/dagre'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
