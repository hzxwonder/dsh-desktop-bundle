#!/usr/bin/env node
// Check that the home the launcher opens mounts every maintained plugin.
//
// The profile manifest and the installed packages only say a plugin is present;
// the command directory says it loaded. Each expected command is something a
// plugin registers while mounting, so a missing entry means that plugin never
// reached the running application even though everything on disk looks right.
//
// Usage: node qa/verify-daily-plugins.mjs [--home <dir>] [--keep]
import { join } from 'node:path'
import { BUNDLE, launcherHome, quitRunningApp, sleep, startSession } from './driver.mjs'
import { awaitReady, clearComposer, focusComposer, prepare } from './scenario.mjs'

const EXPECTED = [
  ['workflow', 'dsh-plugin-workflow'],
  ['ssh', 'dsh-plugin-ssh'],
  ['desktop-suite', 'dsh-desktop-suite'],
  ['desktop-workbench', 'dsh-desktop-workbench'],
]

function parseArgs(argv) {
  const options = { home: undefined, keep: false }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--home') options.home = argv[++index]
    else if (argv[index] === '--keep') options.keep = true
    else throw new Error(`unknown argument: ${argv[index]}`)
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
const evidenceDir = join(BUNDLE, 'qa', 'evidence', 'daily-plugins')
const session = await startSession({ home: options.home, evidenceDir })
console.log(`home    ${session.home}`)
console.log(`profile ${join(session.home, 'profiles', 'desktop')}`)

let failed = false
try {
  await awaitReady(session)
  await prepare(session)
  await focusComposer(session)
  await session.type('/')
  await sleep(2500)
  // The directory renders one row per registered command; the row text starts
  // with the command name and continues with its description.
  const rows = await session.eval(`(() => [...document.querySelectorAll('[role=option]')]
    .map(node => (node.innerText || '').replace(/\\s+/g, ' ').trim().split(' ')[0])
    .filter(Boolean))()`)
  await session.screenshot('command-directory')
  await clearComposer(session)
  await session.press('Escape')
  await sleep(500)

  if (rows.length === 0) {
    failed = true
    console.log('FAIL  command directory listed no commands')
  }
  for (const [command, plugin] of EXPECTED) {
    const present = rows.includes(command)
    if (!present) failed = true
    console.log(`${present ? 'ok   ' : 'FAIL '} ${command.padEnd(18)} ${plugin}`)
  }
  console.log(`listed ${rows.length} commands`)
  console.log(`evidence ${join(evidenceDir, 'command-directory.png')}`)
} finally {
  if (!options.keep) await quitRunningApp({}).catch(() => {})
  console.log(`launcher ${launcherHome()}`)
}
process.exit(failed ? 1 : 0)
