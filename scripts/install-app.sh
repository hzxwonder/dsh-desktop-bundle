#!/usr/bin/env bash
# Install a DSH Desktop application bundle from a .dmg or an existing .app.
#
# The bundle in Releases is ad-hoc signed, so the copy keeps its signature and
# only needs the quarantine attribute cleared; macOS still asks for an explicit
# confirmation on first launch, and Gatekeeper may require the user to allow it
# in System Settings > Privacy & Security. Installing into /Applications needs
# write permission there.
#
# Usage: install-app.sh --source <path.dmg|path.app> [--dest <dir>] [--print-path]
set -euo pipefail

SOURCE=""
DEST="/Applications"
PRINT_PATH=0

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="${2:?--source needs a path}"; shift 2 ;;
    --dest) DEST="${2:?--dest needs a directory}"; shift 2 ;;
    --print-path) PRINT_PATH=1; shift ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install-app: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "${SOURCE}" ] || { echo "install-app: --source is required" >&2; exit 2; }
[ -e "${SOURCE}" ] || { echo "install-app: no such path: ${SOURCE}" >&2; exit 1; }

APP_NAME="DSH Desktop.app"
MOUNT_POINT=""
cleanup() {
  if [ -n "${MOUNT_POINT}" ] && [ -d "${MOUNT_POINT}" ]; then
    hdiutil detach "${MOUNT_POINT}" -quiet || true
  fi
}
trap cleanup EXIT

case "${SOURCE}" in
  *.dmg)
    MOUNT_POINT="$(mktemp -d /tmp/dsh-desktop-dmg.XXXXXX)"
    hdiutil attach "${SOURCE}" -nobrowse -quiet -mountpoint "${MOUNT_POINT}"
    SOURCE_APP="${MOUNT_POINT}/${APP_NAME}"
    ;;
  *)
    SOURCE_APP="${SOURCE}"
    ;;
esac

[ -d "${SOURCE_APP}" ] || { echo "install-app: no ${APP_NAME} inside ${SOURCE}" >&2; exit 1; }

TARGET="${DEST}/${APP_NAME}"
mkdir -p "${DEST}"
if [ -e "${TARGET}" ]; then
  RUNNING="$(pgrep -f "MacOS/DSH Desktop" || true)"
  if [ -n "${RUNNING}" ]; then
    echo "install-app: DSH Desktop is running (pid ${RUNNING}); quit it first" >&2
    exit 1
  fi
  rm -rf "${TARGET}"
fi

# ditto keeps signatures, extended attributes and resource forks that a plain cp
# would flatten; --noqtn drops the quarantine flag the download added.
ditto --rsrc --extattr --noqtn "${SOURCE_APP}" "${TARGET}"

# Strip extended attributes before verifying. A destination inside a
# file-provider volume (anything under ~/Documents or ~/Desktop) makes the copy
# carry com.apple.FinderInfo and com.apple.fileprovider.* attributes, and
# codesign rejects the whole bundle for that detritus. The signature itself is
# untouched by stripping attributes.
xattr -cr "${TARGET}"
if ! codesign --verify --strict "${TARGET}" 2>/dev/null; then
  echo "install-app: signature is not intact after copying; re-signing ad-hoc" >&2
  codesign --force --deep --sign - "${TARGET}"
  codesign --verify --strict "${TARGET}"
fi
echo "verified  ad-hoc signature of $(basename "${TARGET}")"

if [ "${PRINT_PATH}" = 1 ]; then
  printf '%s\n' "${TARGET}"
else
  echo "installed ${TARGET}"
fi
