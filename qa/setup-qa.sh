#!/usr/bin/env bash
# Prepare and restore an isolated QA environment for DSH Desktop acceptance.
#
# The launcher opens the home named by its locator document inside Electron's
# userData directory, and only one instance can run at a time, so a QA run needs
# the launcher to point at a fixture home. This script never edits the live home:
# it moves it aside, builds a fixture home from the bundle, registers that fixture
# with the launcher, and can put everything back exactly as it was.
#
#   bash qa/setup-qa.sh backup      # move the live home aside, build + register the fixture
#   bash qa/setup-qa.sh status      # show what is where right now
#   bash qa/setup-qa.sh restore     # restore the live home and its locator
#
# State lives in <workspace>/.qa: live-home/ (the untouched original),
# fixture-home/ (composed by the bundle), fixture-workspace/ (test directories).
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_DIR="$(cd "${SELF_DIR}/.." && pwd)"
# QA state lives beside the plugin workspace, outside the bundle, so a run never
# leaves fixture data inside the repository that ships to users.
QA_DIR="${DSH_QA_DIR:-$(cd "${BUNDLE_DIR}/../../.." && pwd)/.qa}"
APP="${DSH_QA_APP:-/Applications/DSH Desktop.app}"
LIVE_HOME="${HOME}/.dsh-desktop"
LIVE_USER_DATA="${HOME}/Library/Application Support/DSH Desktop"
LIVE_LOCATOR="${LIVE_USER_DATA}/data-directory/state.json"
LIVE_HOME_BACKUP="${QA_DIR}/live-home"
FIXTURE_HOME="${QA_DIR}/fixture-home"
FIXTURE_WORKSPACE="${QA_DIR}/fixture-workspace"
QA_PORT=43790
QA_MOCK_PORT=43921

log() { printf '%s\n' "$*"; }

require_app() {
  [ -d "${APP}" ] || { log "application bundle is missing: ${APP}" >&2; exit 1; }
}

quit_app() {
  if pgrep -f "MacOS/DSH Desktop" >/dev/null 2>&1; then
    log "quitting the running DSH Desktop"
    kill -TERM $(pgrep -f "MacOS/DSH Desktop") 2>/dev/null || true
    for _ in $(seq 1 30); do
      pgrep -f "MacOS/DSH Desktop" >/dev/null 2>&1 || break
      sleep 1
    done
  fi
  if pgrep -f "MacOS/DSH Desktop" >/dev/null 2>&1; then
    log "FAIL: DSH Desktop did not exit" >&2
    exit 1
  fi
}

do_backup() {
  require_app
  quit_app
  # A previous run's npm install rewrites vendor lockfiles; the vendored tree must
  # match the pinned commits, so drop those local edits before composing again.
  git -C "${BUNDLE_DIR}" checkout -- vendor 2>/dev/null || true
  mkdir -p "${QA_DIR}"
  if [ -d "${LIVE_HOME_BACKUP}" ]; then
    log "live home already backed up at ${LIVE_HOME_BACKUP}; leaving it alone"
  else
    [ -d "${LIVE_HOME}" ] || { log "no live home at ${LIVE_HOME}; nothing to back up" >&2; exit 1; }
    log "moving ${LIVE_HOME} -> ${LIVE_HOME_BACKUP}"
    mv "${LIVE_HOME}" "${LIVE_HOME_BACKUP}"
  fi
  [ -f "${QA_DIR}/live-locator.json" ] || {
    if [ -f "${LIVE_LOCATOR}" ]; then
      cp "${LIVE_LOCATOR}" "${QA_DIR}/live-locator.json"
      log "saved the live launcher locator"
    else
      log "no live launcher locator to save"
    fi
  }
}

do_fixture() {
  require_app
  if [ -d "${FIXTURE_HOME}" ]; then
    log "fixture home already composed at ${FIXTURE_HOME}"
  else
    log "composing the fixture home at ${FIXTURE_HOME}"
    bash "${BUNDLE_DIR}/setup.sh" --home "${FIXTURE_HOME}" --profile desktop --skip-register \
      > "${QA_DIR}/fixture-setup.log" 2>&1 || { tail -20 "${QA_DIR}/fixture-setup.log" >&2; exit 1; }
    tail -3 "${QA_DIR}/fixture-setup.log"
  fi
  mkdir -p "${FIXTURE_WORKSPACE}/alpha" "${FIXTURE_WORKSPACE}/beta"
  printf 'alpha project fixture\n' > "${FIXTURE_WORKSPACE}/alpha/README.md"
  printf 'export const beta = 1\n' > "${FIXTURE_WORKSPACE}/beta/index.ts"

  # Registering first writes the fixture home's settings document, which the
  # provider below merges into; composing a fresh home skips registration, so
  # the settings file would otherwise not exist yet.
  log "pointing the launcher at the fixture home"
  node "${BUNDLE_DIR}/scripts/register-home.mjs" \
    --home "${FIXTURE_HOME}" --app "${APP}" --user-data "${LIVE_USER_DATA}" --port "${QA_PORT}"

  log "installing the local mock model provider into the fixture settings"
  node "${BUNDLE_DIR}/qa/configure-provider.mjs"

  log "starting the mock model service on port ${QA_MOCK_PORT}"
  if pgrep -f "qa/mock-llm.mjs" > /dev/null; then
    log "mock model service already running"
  else
    nohup node "${BUNDLE_DIR}/qa/mock-llm.mjs" --port "${QA_MOCK_PORT}" \
      > "${QA_DIR}/mock-llm.log" 2>&1 &
    sleep 1
  fi
}

do_status() {
  log "qa directory      ${QA_DIR}"
  log "live home         $([ -d "${LIVE_HOME}" ] && echo present || echo absent) ${LIVE_HOME}"
  log "live home backup  $([ -d "${LIVE_HOME_BACKUP}" ] && echo present || echo absent) ${LIVE_HOME_BACKUP}"
  log "fixture home      $([ -d "${FIXTURE_HOME}" ] && echo present || echo absent) ${FIXTURE_HOME}"
  log "app running       $(pgrep -f 'MacOS/DSH Desktop' | wc -l | tr -d ' ') process(es)"
  if [ -f "${LIVE_LOCATOR}" ]; then
    log "launcher activeHome $(python3 -c "import json;print(json.load(open('${LIVE_LOCATOR}')).get('activeHome'))")"
  else
    log "launcher locator  absent"
  fi
}

do_restore() {
  quit_app
  git -C "${BUNDLE_DIR}" checkout -- vendor 2>/dev/null || true
  if [ -f "${QA_DIR}/live-locator.json" ]; then
    log "restoring the live launcher locator"
    mkdir -p "$(dirname "${LIVE_LOCATOR}")"
    cp "${QA_DIR}/live-locator.json" "${LIVE_LOCATOR}"
  fi
  if [ -d "${LIVE_HOME_BACKUP}" ]; then
    if [ -d "${LIVE_HOME}" ]; then
      log "a home already exists at ${LIVE_HOME}; moving it to ${QA_DIR}/replaced-home"
      rm -rf "${QA_DIR}/replaced-home"
      mv "${LIVE_HOME}" "${QA_DIR}/replaced-home"
    fi
    log "restoring ${LIVE_HOME_BACKUP} -> ${LIVE_HOME}"
    mv "${LIVE_HOME_BACKUP}" "${LIVE_HOME}"
  else
    log "no backed-up live home to restore"
  fi
  do_status
}

case "${1:-}" in
  backup) do_backup; do_fixture; do_status ;;
  fixture) do_fixture; do_status ;;
  status) do_status ;;
  restore) do_restore ;;
  quit) quit_app; do_status ;;
  *) log "usage: $0 {backup|fixture|status|restore|quit}" >&2; exit 2 ;;
esac
