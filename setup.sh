#!/usr/bin/env bash
# Assemble one DSH Desktop environment: install the vendored plugin set,
# compose the Desktop profile that loads it, and register the DSH home with the
# Desktop launcher.
#
# Everything this script writes lives inside the target DSH home plus, when
# asked, the application directory. It never edits another home and never
# rewrites an existing settings document.
#
# Usage: ./setup.sh [options]
#   --home <dir>        DSH home for the Desktop app (default: $HOME/.dsh-desktop)
#   --profile <name>    Desktop profile name (default: desktop)
#   --app <path>        Install the application bundle from this path or .dmg
#   --app-dest <dir>    Application destination (default: /Applications)
#   --skip-deps         Do not run npm install inside the vendored plugins
#   --skip-register     Do not write launcher state or the settings template
#   --dry-run           Print what would happen and change nothing
#   -h, --help          Show this help
set -euo pipefail

readonly SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly VENDOR_DIR="${SELF_DIR}/vendor"
readonly TEMPLATE_DIR="${SELF_DIR}/templates"
readonly NPM_CACHE="${SELF_DIR}/.cache/npm"
readonly MIN_NODE_MAJOR=22
readonly MIN_NODE_MINOR=19

HOME_DSH="${DSH_DESKTOP_HOME:-$HOME/.dsh-desktop}"
PROFILE_NAME="desktop"
APP_SOURCE=""
APP_DEST="/Applications"
SKIP_DEPS=0
SKIP_REGISTER=0
DRY_RUN=0

log() { printf '%s\n' "$*"; }
fail() { printf 'setup: %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --home) HOME_DSH="${2:?--home needs a directory}"; shift 2 ;;
    --profile) PROFILE_NAME="${2:?--profile needs a name}"; shift 2 ;;
    --app) APP_SOURCE="${2:?--app needs a path}"; shift 2 ;;
    --app-dest) APP_DEST="${2:?--app-dest needs a directory}"; shift 2 ;;
    --skip-deps) SKIP_DEPS=1; shift ;;
    --skip-register) SKIP_REGISTER=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

case "${PROFILE_NAME}" in
  ''|*/*|*..*) fail "invalid profile name: ${PROFILE_NAME}" ;;
esac
[[ "${PROFILE_NAME}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "invalid profile name: ${PROFILE_NAME}"

step() { printf '\n== %s ==\n' "$*"; }
run() {
  if [ "${DRY_RUN}" = 1 ]; then printf '   would run: %s\n' "$*"; return 0; fi
  "$@"
}

step "1/6 toolchain"
command -v node >/dev/null 2>&1 || fail "node is required (>= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR})"
readonly NODE_VERSION="$(node -p 'process.versions.node')"
node -e '
const [major, minor] = process.versions.node.split(".").map(Number)
const ok = major > Number(process.argv[1]) || (major === Number(process.argv[1]) && minor >= Number(process.argv[2]))
if (!ok) { console.error(`setup: node ${process.versions.node} is older than ${process.argv[1]}.${process.argv[2]}`); process.exit(1) }
' "${MIN_NODE_MAJOR}" "${MIN_NODE_MINOR}" || exit 1
command -v npm >/dev/null 2>&1 || fail "npm is required to install plugin dependencies"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required to compose the profile (npm i -g pnpm)"
log "node           ${NODE_VERSION}"
log "npm            $(npm -v)"
log "pnpm           $(pnpm -v)"
log "bundle         ${SELF_DIR}"
log "dsh home       ${HOME_DSH}"
log "profile        ${PROFILE_NAME}"

step "2/6 application bundle"
APP_PATH=""
if [ -z "${APP_SOURCE}" ]; then
  for candidate in "/Applications/DSH Desktop.app" "$HOME/Applications/DSH Desktop.app"; do
    [ -d "${candidate}" ] && { APP_PATH="${candidate}"; break; }
  done
  [ -n "${APP_PATH}" ] && log "found          ${APP_PATH}" || log "not found      install the dmg from Releases, then re-run with --app"
else
  APP_PATH="$(bash "${SELF_DIR}/scripts/install-app.sh" --source "${APP_SOURCE}" --dest "${APP_DEST}" --print-path)"
  log "installed      ${APP_PATH}"
fi

PROFILE_DIR="${HOME_DSH}/profiles/${PROFILE_NAME}"

step "3/6 plugin dependencies"
if [ "${SKIP_DEPS}" = 1 ]; then
  log "skipped        --skip-deps"
else
  # Keep the npm cache inside the bundle: a shared cache under ~/.npm is often
  # root-owned or read-only, and npm fails the whole install when it cannot
  # write there.
  export npm_config_cache="${NPM_CACHE}"
  for plugin_dir in "${VENDOR_DIR}"/*/; do
    [ -f "${plugin_dir}/package.json" ] || continue
    name="$(basename "${plugin_dir}")"
    if [ -d "${plugin_dir}/node_modules" ]; then
      log "present        ${name}"
      continue
    fi
    log "install        ${name}"
    ( cd "${plugin_dir}" && run npm install --no-audit --no-fund --loglevel=error )
  done
fi

step "4/6 profile composition"
if [ "${DRY_RUN}" = 1 ]; then
  log "would run: node ${SELF_DIR}/scripts/compose-profile.mjs --bundle ${SELF_DIR} --profile-dir ${PROFILE_DIR}"
else
  compose_args=(--bundle "${SELF_DIR}" --profile-dir "${PROFILE_DIR}")
  [ -n "${APP_PATH}" ] && compose_args+=(--app "${APP_PATH}")
  node "${SELF_DIR}/scripts/compose-profile.mjs" "${compose_args[@]}"
fi

step "5/6 dependency resolution"
if [ "${DRY_RUN}" = 1 ]; then
  log "would run: pnpm install (cwd ${PROFILE_DIR})"
else
  ( cd "${PROFILE_DIR}" && pnpm install --reporter=append-only )
  if [ -d "${APP_PATH}/Contents/Resources/app/node_modules/@deepseek-ai" ]; then
    node "${SELF_DIR}/scripts/align-runtime.mjs" "${PROFILE_DIR}" "${APP_PATH}"
  fi
fi

step "6/6 launcher registration"
if [ "${SKIP_REGISTER}" = 1 ]; then
  log "skipped        --skip-register"
elif [ -z "${APP_PATH}" ] || [ ! -d "${APP_PATH}" ]; then
  log "skipped        no application bundle to read versions from"
else
  register_args=(--home "${HOME_DSH}" --profile "${PROFILE_NAME}" --app "${APP_PATH}")
  [ "${DRY_RUN}" = 1 ] && register_args+=(--dry-run)
  node "${SELF_DIR}/scripts/register-home.mjs" "${register_args[@]}"
fi

step "verify"
if [ "${DRY_RUN}" = 1 ]; then
  log "would run: node ${SELF_DIR}/scripts/verify.mjs --bundle ${SELF_DIR} --home ${HOME_DSH} --profile ${PROFILE_NAME}"
else
  node "${SELF_DIR}/scripts/verify.mjs" --bundle "${SELF_DIR}" --home "${HOME_DSH}" --profile "${PROFILE_NAME}"
fi

printf '\n'
log "DSH home       ${HOME_DSH}"
log "profile        ${PROFILE_DIR}"
[ -n "${APP_PATH}" ] && log "application    ${APP_PATH}"
log ""
log "Next: launch DSH Desktop. The Vendored plugin set is already in the profile;"
log "configure model providers and credentials in the app's Settings, and set up"
log "SSH connections from the SSH plugin's own settings page."
