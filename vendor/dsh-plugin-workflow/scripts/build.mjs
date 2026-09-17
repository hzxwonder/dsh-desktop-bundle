import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
const result = await build({
  entryPoints: ["client/index.jsx"],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/*", "react/*", "@deepseek-ai/dsh-client-ui-primitives"],
  loader: { ".css": "text" },
  minify: false,
});
await mkdir("dist", { recursive: true });
await writeFile(
  "dist/client.js",
  `window.__ModuleLoader__.load({id:'dsh-plugin-workflow',factory:require=>{const module={exports:{}};const exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`,
);
console.log("Built dist/client.js");
