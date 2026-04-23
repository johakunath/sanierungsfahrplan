import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.js'],
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
  outfile: 'dist/app.js',
  alias: {
    'react': './src/react-shim.js',
    'react-dom/client': './src/react-dom-shim.js',
  },
});

console.log('Build OK');
