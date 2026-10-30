import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas: funciona bajo https://<usuario>.github.io/<repo>/
  base: './',
  server: { port: 5173 },
  test: { include: ['tests/**/*.test.ts'] },
});
