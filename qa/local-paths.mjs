// Evidence and reports are published with the repository, so a local path that
// names a person is replaced before it is ever written. The same masking runs
// again over the evidence directory before a report is committed, which keeps
// the rule true for files this run did not write.
const RULES = [
  [/\/Users\/[^/\s"']+/gu, '/Users/<user>'],
  [/\/home\/[^/\s"']+/gu, '/home/<user>'],
]

/** Replace the account name in every absolute home path of the given text. */
export function maskLocalPaths(text) {
  let masked = String(text)
  for (const [pattern, replacement] of RULES) masked = masked.replace(pattern, replacement)
  return masked
}
