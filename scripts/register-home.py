#!/usr/bin/env python3
"""Write the launcher-side documents that point DSH Desktop at one composed home.

Kept in Python because it needs the application's own version metadata out of
Info.plist and hashes the profile path the same way the launcher does.
"""
import argparse
import hashlib
import json
import os
import plistlib
import sys
import time

PORT = 43000


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', required=True)
    parser.add_argument('--profile-dir', required=True)
    parser.add_argument('--app', required=True)
    parser.add_argument('--user-data', required=True)
    parser.add_argument('--port', type=int, default=None,
                        help='local Web port written into a new settings document')
    parser.add_argument('--dry-run', action='store_true')
    return parser.parse_args()


def write_private(path, payload, dry_run):
    if dry_run:
        print('would write', path)
        return
    directory = os.path.dirname(path)
    os.makedirs(directory, mode=0o700, exist_ok=True)
    os.chmod(directory, 0o700)
    with open(path, 'w') as handle:
        handle.write(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')
    os.chmod(path, 0o600)
    print('written      ', path)


def main():
    args = parse_args()
    home = os.path.abspath(os.path.expanduser(args.home))
    profile_dir = os.path.abspath(os.path.expanduser(args.profile_dir))
    app = os.path.abspath(os.path.expanduser(args.app))
    user_data = os.path.abspath(os.path.expanduser(args.user_data))

    with open(os.path.join(app, 'Contents', 'Info.plist'), 'rb') as handle:
        desktop_version = plistlib.load(handle)['CFBundleShortVersionString']
    runtime_manifest = os.path.join(
        app, 'Contents', 'Resources', 'app', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
    with open(runtime_manifest) as handle:
        dsh_version = json.load(handle)['version']

    recorded_at = time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.000Z'

    # 1. The locator is the only document that decides which home the launcher
    #    opens. previousHome is preserved so the app's own switch flow keeps
    #    offering the home a user came from.
    location_path = os.path.join(user_data, 'data-directory', 'state.json')
    previous_home = None
    if os.path.isfile(location_path):
        try:
            with open(location_path) as handle:
                existing = json.load(handle)
            previous_home = existing.get('activeHome')
        except (ValueError, OSError):
            previous_home = None
    if previous_home == home:
        previous_home = None
    write_private(location_path, {
        'version': 1,
        'activeHome': home,
        'previousHome': previous_home,
        'generation': 1,
        'updatedAt': recorded_at,
    }, args.dry_run)

    # 2. The Setup marker records that this profile already decided its setup,
    #    so the native Setup Wizard does not appear over a composed profile.
    profile_hash = hashlib.sha256(profile_dir.encode()).hexdigest()
    marker_path = os.path.join(user_data, 'profile-setup', profile_hash, 'state.json')
    write_private(marker_path, {
        'version': 2,
        'profileHash': profile_hash,
        'outcome': 'completed',
        'desktopVersion': desktop_version,
        'dshVersion': dsh_version,
        'setupRevision': 1,
        'recordedAt': recorded_at,
    }, args.dry_run)

    # 3. The local Web port decides the browser origin, and the origin carries
    #    the interface state plugins keep in localStorage. Keep one value stable
    #    across restarts; derive it from the home so two homes never collide.
    settings_path = os.path.join(home, 'settings.yaml')
    if os.path.exists(settings_path):
        print('kept         ', settings_path)
    else:
        port = args.port or PORT + int(hashlib.sha256(home.encode()).hexdigest()[:4], 16) % 1000
        content = (
            '# Shared DSH settings. Written once by dsh-desktop-bundle/setup.sh;\n'
            '# the Desktop app owns this document afterwards.\n'
            'dsh-desktop:\n'
            '  port: %d\n'
            '  mode: advanced\n'
            '  openBrowser: false\n'
            '  networkExposure: loopback\n'
        ) % port
        if args.dry_run:
            print('would write', settings_path)
        else:
            with open(settings_path, 'w') as handle:
                handle.write(content)
            os.chmod(settings_path, 0o600)
            print('written      ', settings_path, '(port %d)' % port)

    print('desktop       %s' % desktop_version)
    print('dsh runtime   %s' % dsh_version)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # noqa: BLE001 - the CLI reports one clear failure
        print('register-home: %s' % error, file=sys.stderr)
        sys.exit(1)
