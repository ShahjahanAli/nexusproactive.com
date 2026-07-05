import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/nexus-chat.ts',
      name: 'NexusChat',
      fileName: 'nexus',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
