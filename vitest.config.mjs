import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/hospital_test',
      JWT_SECRET: 'super-secret-key-for-vitest-environment-with-32chars',
    },
  },
});
