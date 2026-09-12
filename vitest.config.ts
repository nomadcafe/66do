import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // tsconfig 里 jsx 是 "preserve"（留给 Next 的编译器），esbuild 拿不到提示就
  // 退回 classic transform，组件里没有 `import React` 就会 "React is not defined"。
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
