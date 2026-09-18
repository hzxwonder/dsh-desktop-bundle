#!/usr/bin/env node
// Local stand-in for a model provider, so acceptance cases can exercise the whole
// conversation path without any real endpoint or credential.
//
// It speaks the OpenAI chat-completions wire format that the pinned runtime's
// `openai-completions` adapter expects, answers every request with a short streamed
// reply, and logs the request bodies for inspection.
//
//   node qa/mock-llm.mjs [--port 43921] [--reply "text"] [--log <file>] [--fail-once]
import { createServer } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const value = (flag, fallback) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : fallback
}
const port = Number(value('--port', '43921'))
const reply = value('--reply', 'QA mock reply: the conversation path works.')
const logPath = value('--log', '/tmp/dsh-qa-mock-llm.log')
const failFirst = args.includes('--fail-once')

let requestCount = 0
let failed = false

const server = createServer((request, response) => {
  const chunks = []
  request.on('data', chunk => chunks.push(chunk))
  request.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    requestCount += 1
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, `${new Date().toISOString()} ${request.method} ${request.url} ${body.slice(0, 2000)}\n`)

    if (failFirst && !failed) {
      failed = true
      response.writeHead(500, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'QA mock: deliberate first-request failure' } }))
      return
    }

    let wantsStream = false
    let model = 'qa-mock-model'
    try {
      const parsed = JSON.parse(body)
      wantsStream = parsed.stream === true
      model = parsed.model ?? model
    } catch { /* tolerate a non-JSON probe */ }

    if (!wantsStream) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        id: 'chatcmpl-qa', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model,
        choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
      }))
      return
    }

    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    const created = Math.floor(Date.now() / 1000)
    const frame = delta => `data: ${JSON.stringify({
      id: 'chatcmpl-qa', object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta, finish_reason: null }],
    })}\n\n`
    response.write(frame({ role: 'assistant', content: '' }))
    for (const word of reply.split(' ')) response.write(frame({ content: `${word} ` }))
    response.write(`data: ${JSON.stringify({
      id: 'chatcmpl-qa', object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
    })}\n\n`)
    response.write('data: [DONE]\n\n')
    response.end()
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`mock llm listening on http://127.0.0.1:${port} (log ${logPath})`)
})
process.on('SIGTERM', () => {
  console.log(`mock llm served ${requestCount} request(s)`)
  server.close(() => process.exit(0))
})
