#!/usr/bin/env bash
# Refresh this bundle from the maintained plugin repositories and verify it.
#
# Wraps the steps documented in docs/vendor.md: refuse to sync from dirty source
# checkouts, refresh vendor/ and the version pins, render a profile into a
# scratch home, and run the structural checks. The result is meant to be reviewed
# and committed by hand.
#
# Usage: ./sync-plugins.sh --from <plugin-source-root> [--only a,b] [--scratch <dir>]
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FROM=""
ONLY=""
SCRATCH="${SELF_DIR}/.scratch/home"

while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:?--from needs a directory}"; shift 2 ;;
    --only) ONLY="${2:?--only needs a list}"; shift 2 ;;
    --scratch) SCRATCH="${2:?--scratch needs a directory}"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "sync-plugins: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "${FROM}" ] || { echo "sync-plugins: --from is required" >&2; exit 2; }
[ -d "${FROM}" ] || { echo "sync-plugins: no such directory: ${FROM}" >&2; exit 1; }

dirty=0
for repo in "${FROM}"/*/; do
  [ -d "${repo}/.git" ] || continue
  status="$(git -C "${repo}" status --porcelain)"
  if [ -n "${status}" ]; then
    echo "dirty  ${repo}" >&2
    printf '%s\n' "${status}" | sed 's/^/       /' >&2
    dirty=1
  fi
done
if [ "${dirty}" = 1 ]; then
  echo "sync-plugins: commit or stash the changes above before vendoring" >&2
  exit 1
fi

vendor_args=(--from "${FROM}")
[ -n "${ONLY}" ] && vendor_args+=(--only "${ONLY}")
node "${SELF_DIR}/scripts/vendor.mjs" "${vendor_args[@]}"

echo
echo "== compose and verify =="
bash "${SELF_DIR}/setup.sh" --home "${SCRATCH}" --profile desktop --skip-deps --skip-register

echo
echo "review with: git -C ${SELF_DIR} diff --stat && git -C ${SELF_DIR} status --short"
