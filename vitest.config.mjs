import { defineConfig } from 'vitest/config';

// Logique pure de lib/ et régressions des API/services dans tests/.
// Les frontières Firebase/réseau sont simulées ; aucun service de production
// n'est contacté et aucun compte réel n'est nécessaire.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('.', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.js', 'tests/**/*.test.js'],
  },
});
