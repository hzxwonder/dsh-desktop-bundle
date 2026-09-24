#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function verifyMindmap(batches, result) {
  const expected = new Map();
  for (const batch of batches || []) for (const p of batch.paragraphs || []) {
    if (expected.has(p.hash)) throw new Error(`输入段落重复：${p.hash}`);
    expected.set(p.hash, p);
  }
  const rows = result?.paragraphs;
  if (!Array.isArray(rows)) throw new Error("result.paragraphs 必须是数组");
  if (rows.length !== expected.size) throw new Error(`段落覆盖不完整：需要 ${expected.size}，收到 ${rows.length}`);
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row.hash !== "string" || seen.has(row.hash)) throw new Error("hash 缺失或重复");
    seen.add(row.hash);
    const source = expected.get(row.hash);
    if (!source) throw new Error(`返回了未知段落：${row.hash}`);
    if (typeof row.label !== "string" || !row.label.trim() || row.label.length > 500 || /[\r\n]/.test(row.label)) throw new Error(`段落 ${row.hash} 的 label 格式无效`);
    if (!Array.isArray(row.sentences) || row.sentences.length !== source.sentences.length) throw new Error(`段落 ${row.hash} 的句子数量不匹配`);
    for (const label of row.sentences) if (typeof label !== "string" || !label.trim() || label.length > 500 || /[\r\n]/.test(label)) throw new Error(`段落 ${row.hash} 的句子标签格式无效`);
  }
  return true;
}

const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const main = async () => {
  const path = process.argv[2];
  if (!path) return fail("用法：node verify.mjs input.json");
  let data;
  try { data = JSON.parse(await readFile(path, "utf8")); } catch (e) { return fail(`输入 JSON 无法解析：${e.message}`); }
  try { verifyMindmap(data.batches, data.result); } catch (e) { return fail(e.message); }
  console.log("OK");
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
