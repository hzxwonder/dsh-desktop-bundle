import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyPromptRuntime } from './verify-prompt-runtime.mjs'
test('rejects a client-only package and accepts paired Host chunks', () => {
  const app = mkdtempSync(join(tmpdir(), 'prompt-package-'))
  try {
    const lib = join(app, 'Contents/Resources/app/lib')
    mkdirSync(lib, { recursive: true })
    writeFileSync(join(lib, 'client.js'), '// desktop-prompt: /prompt command /_desktop/prompts')
    writeFileSync(join(lib, 'index.js'), '// Host')
    assert.throws(() => verifyPromptRuntime(app), /Host API is missing/)
    writeFileSync(join(lib, 'index.js'), 'import { apply } from "./host.js";')
    writeFileSync(join(lib, 'host.js'), '// desktop-prompt: library API /_desktop/prompts')
    assert.doesNotThrow(() => verifyPromptRuntime(app))
  } finally { rmSync(app, { recursive: true, force: true }) }
})
