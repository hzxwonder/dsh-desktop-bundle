#!/usr/bin/env node
// Provision the fixture home with a local mock model provider.
//
// The provider registry lives in the runtime's own settings namespace
// (`llm-pi-ai`), so the QA provider is merged in beside anything already there and
// the default model points at it. A namespace of our own would leave the provider
// invisible and the app would ask for an API key instead.
//
//   node qa/configure-provider.mjs            # write provider + credentials
//   node qa/configure-provider.mjs --show     # print the resulting settings
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE } from './driver.mjs'

const HOME = join(BUNDLE, '..', '..', '..', '.qa', 'fixture-home')
const SETTINGS = join(HOME, 'settings.yaml')
const CREDENTIALS = join(HOME, '.credentials.yaml')
const MOCK_PORT = 43921
export const PROVIDER_ID = 'qa-mock'
export const MODEL_ID = 'qa-mock-model'
export const CREDENTIAL_REF = 'QA_MOCK_API_KEY'

const NAMESPACES_TO_REPLACE = new Set(['llm-pi-ai', 'agent-default-model'])

const PROVIDER = `llm-pi-ai:
  providers:
    ${PROVIDER_ID}:
      displayName: QA Mock
      api: openai-completions
      apiKeyEnv: ${CREDENTIAL_REF}
      baseURL: http://127.0.0.1:${MOCK_PORT}/v1
      models:
        - id: ${MODEL_ID}
          name: QA Mock Model
          input: [text]
agent-default-model:
  provider: ${PROVIDER_ID}
  model: ${MODEL_ID}
`

/** Drop the top-level blocks this script owns, keeping every other namespace. */
function withoutOwnedNamespaces(text) {
  const kept = []
  let skipping = false
  for (const line of text.split('\n')) {
    if (/^[A-Za-z0-9_.-]+:/.test(line)) skipping = NAMESPACES_TO_REPLACE.has(line.slice(0, line.indexOf(':')))
    if (!skipping) kept.push(line)
  }
  return kept.join('\n').trimEnd()
}

function main() {
  if (!existsSync(SETTINGS)) throw new Error(`fixture settings missing: ${SETTINGS} (run qa/setup-qa.sh first)`)
  const base = withoutOwnedNamespaces(readFileSync(SETTINGS, 'utf8'))
  writeFileSync(SETTINGS, `${base}\n\n${PROVIDER}`)

  // A local stand-in key: the mock endpoint ignores it, and it is not a secret.
  if (!existsSync(CREDENTIALS)) {
    writeFileSync(CREDENTIALS, `version: 1\nrefs:\n  ${CREDENTIAL_REF}: qa-local-mock-key\n`)
  }

  if (process.argv.includes('--show')) console.log(readFileSync(SETTINGS, 'utf8'))
  else console.log(`QA provider ${PROVIDER_ID}/${MODEL_ID} written to ${SETTINGS}`)
}

main()
