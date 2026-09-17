/**
 * Build the browser-side terminal asset.
 *
 * The Host serves plugin client code verbatim (the client module system wraps
 * it, it does not bundle it), so xterm ships as one self-contained asset that
 * the panel imports at runtime. Both halves — the ESM bundle the panel imports
 * and the stylesheet it links — are produced here.
 */
import {build} from 'esbuild';

await build({
  entryPoints: ['terminal-entry.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  legalComments: 'none',
  outfile: 'assets/terminal.js',
  logLevel: 'info',
});

await build({
  entryPoints: ['node_modules/@xterm/xterm/css/xterm.css'],
  bundle: true,
  minify: true,
  outfile: 'assets/terminal.css',
  logLevel: 'info',
});
