import { defineConfig } from 'vitest/config';

// Tests unitaires pour la logique pure de lib/ (aucune dépendance React ni
// Firebase dans les fichiers testés — voir lib/*.test.js). Volontairement
// minimal : pas de jsdom, on ne teste pas de composants ici.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('.', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.js'],
  },
});
