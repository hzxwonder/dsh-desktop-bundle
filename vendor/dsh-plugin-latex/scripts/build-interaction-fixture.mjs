import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const directory = join(tmpdir(), 'dsh-latex-interaction');
await mkdir(directory, { recursive:true });
await build({entryPoints:['scripts/interaction-fixture.jsx'],bundle:true,format:'esm',outfile:join(directory,'ui.js'),loader:{'.css':'text'}});
await writeFile(join(directory,'index.html'), '<!doctype html><html><meta charset="utf-8"><title>LaTeX Interaction QA</title><body><div id="root"></div><script type="module" src="ui.js"></script></body></html>');
console.log(directory);
