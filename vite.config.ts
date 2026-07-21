import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const repositoryName = env.VITE_GITHUB_REPOSITORY_NAME || '';
  return {
    plugins: [react()],
    base: repositoryName ? `/${repositoryName}/` : '/',
    test: {
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      globals: true,
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**']
    }
  };
});
