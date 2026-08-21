import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Build and test share one config so tests resolve modules exactly as the build
// does. `reference/` is the retired prototype (docs/decisions/0001) and is
// excluded from every path here.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // jsdom is the default; Node-only suites opt out with a
    // `// @vitest-environment node` docblock on the first line of the file.
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['reference/**', 'node_modules/**', 'dist/**'],
    clearMocks: true,
    restoreMocks: true,
  },
});
