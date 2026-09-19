import { build } from "esbuild";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
const result = await build({
  entryPoints: ["client/index.jsx"],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  external: ["react", "react-dom", "react/*", "react-dom/*"],
  loader: { ".css": "text" },
  minify: false,
});
await mkdir("dist", { recursive: true });
await writeFile(
  "dist/client.js",
  `window.__ModuleLoader__.load({id:'dsh-plugin-latex',factory:require=>{const module={exports:{}};const exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});`,
);
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "dist/pdf.worker.mjs",
);
console.log("LaTeX client built");
