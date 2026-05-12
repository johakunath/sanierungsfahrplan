import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  absWorkingDir: here,
  entryPoints: [join(here, 'src/index.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  external: ['react', 'react-dom', 'react-dom/client'],
  jsx: 'transform',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  banner: {
    js: `
      // map globals to module names expected by bundler
      var __reactMod = window.React;
      var __reactDomMod = window.ReactDOM;
    `
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  outfile: join(here, 'dist/app.js'),
  alias: {
    'react': join(here, 'src/react-shim.js'),
    'react-dom/client': join(here, 'src/react-dom-shim.js'),
  },
});

console.log('Build OK');
