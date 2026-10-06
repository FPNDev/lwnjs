import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  server: {
    allowedHosts: [
      '<yourdomain>.ngrok-free.dev'
    ],
  },
});
