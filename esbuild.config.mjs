import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const watch = process.argv.includes('--watch');

// ESM build
const esmConfig = {
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/marquee.esm.js',
  minify: !watch,
  sourcemap: true,
};

// DevTools build (separate bundle)
const devtoolsConfig = {
  entryPoints: ['src/devtools.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/marquee.devtools.js',
  minify: !watch,
  sourcemap: true,
};

// UMD build (IIFE with global name)
const umdConfig = {
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'MarqueeLib',
  outfile: 'dist/marquee.umd.js',
  minify: !watch,
  sourcemap: true,
  footer: {
    js: 'if(typeof module!=="undefined")module.exports=MarqueeLib;',
  },
};

// Copy CSS
function copyCSS() {
  try {
    copyFileSync('src/styles.css', 'dist/marquee.css');
    console.log('  dist/marquee.css');
  } catch (e) {
    console.error('CSS copy failed:', e.message);
  }
}

if (watch) {
  const ctxEsm = await esbuild.context(esmConfig);
  const ctxUmd = await esbuild.context(umdConfig);
  const ctxDev = await esbuild.context(devtoolsConfig);
  await ctxEsm.watch();
  await ctxUmd.watch();
  await ctxDev.watch();
  copyCSS();
  console.log('Watching for changes...');
} else {
  await esbuild.build(esmConfig);
  console.log('  dist/marquee.esm.js');
  await esbuild.build(umdConfig);
  console.log('  dist/marquee.umd.js');
  await esbuild.build(devtoolsConfig);
  console.log('  dist/marquee.devtools.js');
  copyCSS();
  console.log('Build complete.');
}
