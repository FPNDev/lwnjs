import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  server: {
    allowedHosts: ['eloquence-colonize-sponge.ngrok-free.dev'],
  },
});
