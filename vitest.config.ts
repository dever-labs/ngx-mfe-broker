import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['projects/**/*.spec.ts'],
    globals: true,
    setupFiles: ['projects/ngx-mfe-broker/src/test-setup.ts'],
  },
});
