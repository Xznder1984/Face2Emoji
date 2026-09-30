import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the built pages work when hosted in a subdirectory
  // (GitHub Pages project sites, a /demo/ folder, and so on).
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        privacy: 'privacy.html',
        terms: 'terms.html',
        notFound: '404.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    reporters: 'default',
  },
});
