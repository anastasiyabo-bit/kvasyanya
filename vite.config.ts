import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Serve a patched Phaser as ESM.
 * iOS Safari throws if Phaser assigns navigator.vibrate (readonly) — boot stuck at 0%.
 */
function phaserIosSafe(): Plugin {
  const rewrite = (code: string) =>
    code.replace(
      /navigator\.vibrate\s*=\s*navigator\.vibrate\s*\|\|[^;]+;/,
      'try{var __v=navigator.vibrate||navigator.webkitVibrate;if(__v)Features.vibration=true}catch(e){}',
    );
  return {
    name: 'phaser-ios-safe',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'phaser') return '\0phaser-ios-safe';
    },
    load(id) {
      if (id !== '\0phaser-ios-safe') return null;
      const file = resolve(process.cwd(), 'node_modules/phaser/dist/phaser.js');
      let code = rewrite(readFileSync(file, 'utf8'));
      // Drop CJS/AMD branches: Vite would treat `module` as a broken global.
      code = code.replace(
        /^\(function webpackUniversalModuleDefinition\(root, factory\) \{[\s\S]*?\}\)\(this, \(\) => \{/,
        '(function webpackUniversalModuleDefinition(root, factory) { root["Phaser"] = factory(); })(globalThis, () => {',
      );
      return `${code}\nexport default globalThis.Phaser;\n`;
    },
  };
}

/** Dev: /sdk.js is only on Yandex. Without a stub Vite serves HTML and Safari throws. */
function emptySdkInDev(): Plugin {
  return {
    name: 'empty-sdk-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/sdk.js') return next();
        res.setHeader('Content-Type', 'application/javascript');
        res.end('/* yandex sdk is injected only on yandex.ru */');
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [phaserIosSafe(), emptySdkInDev()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    exclude: ['phaser'],
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      ignored: ['**/docs/**', '**/dist/**'],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
