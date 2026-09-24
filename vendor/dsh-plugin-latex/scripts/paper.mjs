#!/usr/bin/env node
import net from "node:net";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const directory = process.env.DSH_PAPER_DATA || join(process.env.DSH_HOME || join(homedir(), ".dsh-desktop"), "latex-studio");
try {
  const request = JSON.parse(await new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { text += chunk; if (text.length > 4 * 1024 * 1024) reject(new Error("请求过大")); });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  }));
  const { socket } = JSON.parse(await readFile(join(directory, "automation.json"), "utf8"));
  const send = request => new Promise((resolve, reject) => {
    const connection = net.createConnection(socket);
    let text = "";
    connection.setTimeout(35000, () => connection.destroy(new Error("工作台响应超时")));
    connection.setEncoding("utf8");
    connection.on("connect", () => connection.write(JSON.stringify(request) + "\n"));
    connection.on("data", chunk => { text += chunk; });
    connection.on("end", () => { try { resolve(JSON.parse(text)); } catch (error) { reject(error); } });
    connection.on("error", reject);
  });
  let response = await send(request);
  if (request.action === "analyze" && response.ok) {
    const deadline = Date.now() + 660000;
    do {
      if (Date.now() > deadline) throw new Error("行文导图等待超时，请在工作台检查任务状态");
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await send({ action:"job", id:request.id });
    } while (response.ok && response.value?.status === "running");
  }
  process.stdout.write(JSON.stringify(response) + "\n");
  if (!response.ok || response.value?.status === "failed") process.exitCode = 1;
} catch (error) {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
}
