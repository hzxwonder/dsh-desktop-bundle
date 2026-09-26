//#region src/bin.d.ts
/** Profile-local maintenance CLI for the optional OpenAI Codex bundle. */
/** Execute one boot-free credential command. */
declare function run(argv: readonly string[]): Promise<number>;
//#endregion
export { run };