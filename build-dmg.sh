#!/usr/bin/env bash
# Build the DSH Desktop application from the pinned fork and package it as a dmg.
#
# The fork adds the native browser panel the plugin set expects; the stable
# channel of the upstream repository does not carry it. Builds happen outside
# this repository: the fork is checked out under .build/ (or reused from
# --source), Yarn, Corepack, Electron and node-gyp caches stay inside .build/,
# and the packaged application is staged on a plain APFS path because codesign
# refuses bundles that carry file-provider attributes.
#
# Usage: ./build-dmg.sh [options]
#   --arch arm64|universal   Package target (default: arm64)
#   --ref <git-ref>          Fork revision to build (default: manifest commit)
#   --source <dir>           Existing fork checkout to build instead of cloning
#   --work <dir>             Build directory (default: <repo>/.build)
#   --stage <dir>            Packaging output (default: /tmp/dsh-desktop-stage)
#   --out <dir>              dmg output directory (default: <repo>/dist)
#   --skip-build             Reuse an existing checkout without rebuilding
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SELF_DIR}"
APP_NAME="DSH Desktop.app"

DEFAULT_REPO="$(node -p "require('${REPO_ROOT}/manifest.json').desktop.repository")"
DEFAULT_REF="$(node -p "require('${REPO_ROOT}/manifest.json').desktop.commit")"
DESKTOP_VERSION="$(node -p "require('${REPO_ROOT}/manifest.json').desktop.appVersion")"

ARCH="arm64"
REF="${DEFAULT_REF}"
SOURCE=""
WORK="${REPO_ROOT}/.build"
STAGE="/tmp/dsh-desktop-stage"
OUT="${REPO_ROOT}/dist"
SKIP_BUILD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --arch) ARCH="${2:?--arch needs a target}"; shift 2 ;;
    --ref) REF="${2:?--ref needs a git ref}"; shift 2 ;;
    --source) SOURCE="${2:?--source needs a directory}"; shift 2 ;;
    --work) WORK="${2:?--work needs a directory}"; shift 2 ;;
    --stage) STAGE="${2:?--stage needs a directory}"; shift 2 ;;
    --out) OUT="${2:?--out needs a directory}"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "build-dmg: unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "${ARCH}" in
  arm64|universal) ;;
  *) echo "build-dmg: --arch must be arm64 or universal" >&2; exit 2 ;;
esac

[ "$(uname -s)" = "Darwin" ] || { echo "build-dmg: macOS is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "build-dmg: node is required" >&2; exit 1; }
command -v corepack >/dev/null 2>&1 || { echo "build-dmg: corepack is required (ships with Node)" >&2; exit 1; }

# Every cache stays inside --work. The defaults live in ~/.cache, ~/Library and
# ~/npm, and node-gyp additionally needs npm_config_devdir, or rebuilding the
# fs-ext native module tries to download Electron headers into a read-only place.
mkdir -p "${WORK}"
export COREPACK_HOME="${WORK}/corepack"
export YARN_CACHE_FOLDER="${WORK}/yarn-cache"
export YARN_GLOBAL_FOLDER="${WORK}/yarn-global"
export electron_config_cache="${WORK}/electron"
export ELECTRON_BUILDER_CACHE="${WORK}/electron-builder"
export npm_config_devdir="${WORK}/node-gyp"
export npm_config_cache="${WORK}/npm-cache"
export npm_config_manage_package_manager_versions=false
export CSC_IDENTITY_AUTO_DISCOVERY=false

step() { printf '\n== %s ==\n' "$*"; }

if [ -n "${SOURCE}" ]; then
  FORK="${SOURCE}"
  step "1/6 fork checkout (reused)"
  echo "${FORK}"
else
  FORK="${WORK}/dsh-desktop"
  step "1/6 fork checkout (${DEFAULT_REPO} @ ${REF})"
  if [ -d "${FORK}/.git" ]; then
    git -C "${FORK}" fetch --quiet origin
    git -C "${FORK}" checkout --detach --quiet "${REF}"
  else
    mkdir -p "$(dirname "${FORK}")"
    git clone --quiet "${DEFAULT_REPO}" "${FORK}"
    git -C "${FORK}" checkout --detach --quiet "${REF}"
  fi
  git -C "${FORK}" submodule update --init --recursive --quiet
  echo "commit $(git -C "${FORK}" rev-parse --short HEAD)"
fi

[ -d "${FORK}/dsh-plugin-desktop" ] || { echo "build-dmg: ${FORK} is not a dsh-desktop checkout" >&2; exit 1; }

cd "${FORK}"

if [ "${SKIP_BUILD}" = 1 ]; then
  step "2/6 workspace install and build (skipped)"
else
  step "2/6 workspace install"
  corepack yarn install --immutable
  step "3/6 workspace build"
  corepack yarn workspace dsh-community-market build
  corepack yarn workspace dsh-plugin-desktop build
  corepack yarn workspace dsh-plugin-desktop prepare:electron-native
fi

# Yarn's frozen install can re-extract the bundled uv binaries without their
# executable bit. Upstream's packaged-runtime verifier reads them during
# afterPack and aborts packaging when they are not executable, so restore the
# mode before packaging instead of shipping an app that fails its own check.
if [ -d "${FORK}/dsh-plugin-desktop/node_modules/@dataiku" ]; then
  find "${FORK}/dsh-plugin-desktop/node_modules/@dataiku" -path '*/bin/uv' -exec chmod +x {} +
fi

step "4/6 package (${ARCH})"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"
# Electron Builder compiles the Icon Composer document with Xcode 26 `actool`.
# A machine whose `actool` is missing or older packages the document's committed
# legacy `app-icon.icns` export instead, which holds the same artwork.
MAC_ICON=()
if ! xcrun --find actool >/dev/null 2>&1 \
  || ! actool --version 2>/dev/null | tr -d '\n' \
    | grep -Eq '<key>short-bundle-version</key>[[:space:]]*<string>(2[6-9]|[3-9][0-9])'; then
  MAC_ICON=(--config.mac.icon=build/app-icon.icns)
fi
(
  cd dsh-plugin-desktop
  # electron-builder resolves afterPack/afterAllArtifactBuild hooks relative to
  # its working directory, so this runs from the package root. The verifier in
  # afterAllArtifactBuild cannot infer the architecture of a bare --dir build and
  # reports a failure after the bundle already exists; the staging directory is
  # therefore checked below instead of trusting the exit code.
  node node_modules/electron-builder/cli.js \
    --mac "--${ARCH}" --dir --publish never \
    --config.forceCodeSigning=false \
    --config.mac.identity=null \
    --config.mac.notarize=false \
    --config.win.signExecutable=false \
    --config.electronDist=node_modules/electron/dist \
    --config.directories.output="${STAGE}" \
    ${MAC_ICON[@]+"${MAC_ICON[@]}"} || echo "electron-builder reported a failure; checking for the bundle"
)

APP=""
for candidate in "${STAGE}/mac-${ARCH}/${APP_NAME}" "${STAGE}/mac/${APP_NAME}" "${STAGE}/mac-universal/${APP_NAME}"; do
  [ -d "${candidate}" ] && { APP="${candidate}"; break; }
done
[ -n "${APP}" ] || { echo "build-dmg: no packaged application under ${STAGE}" >&2; exit 1; }

node "${REPO_ROOT}/scripts/verify-prompt-runtime.mjs" "${APP}"

step "5/6 ad-hoc signature"
xattr -cr "${APP}"
codesign --force --deep --sign - "${APP}"
codesign --verify --deep --strict "${APP}"
echo "signed    ${APP}"

step "6/6 dmg"
mkdir -p "${OUT}"
DMG="${OUT}/DSH-Desktop-${DESKTOP_VERSION}-${ARCH}.dmg"
rm -f "${DMG}"
STAGE_DMG="$(mktemp -d /tmp/dsh-desktop-dmg.XXXXXX)"
cp -R "${APP}" "${STAGE_DMG}/"
ln -s /Applications "${STAGE_DMG}/Applications"
hdiutil create -volname "DSH Desktop" -srcfolder "${STAGE_DMG}" -ov -format UDZO -quiet "${DMG}" \
  || { echo "build-dmg: hdiutil could not create ${DMG}" >&2; rm -rf "${STAGE_DMG}"; exit 1; }
rm -rf "${STAGE_DMG}"
[ -f "${DMG}" ] || { echo "build-dmg: ${DMG} was not created" >&2; exit 1; }

# The application inside the image is ad-hoc signed, so it is verified after
# mounting rather than trusted from the build log.
MOUNT_POINT="$(mktemp -d /tmp/dsh-desktop-verify.XXXXXX)"
hdiutil attach "${DMG}" -nobrowse -quiet -mountpoint "${MOUNT_POINT}"
codesign --verify --deep --strict "${MOUNT_POINT}/${APP_NAME}"
hdiutil detach "${MOUNT_POINT}" -quiet
rmdir "${MOUNT_POINT}" 2>/dev/null || true
echo "verified  ad-hoc signature inside the mounted image"

echo "dmg       ${DMG}"
echo "size      $(du -h "${DMG}" | cut -f1)"
echo "sha256    $(shasum -a 256 "${DMG}" | cut -d' ' -f1)"
