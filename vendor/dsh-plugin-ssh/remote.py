"""Bounded JSON protocol for remote POSIX file operations and shell commands."""
import fcntl
import hashlib
import json
import os
import signal
import stat
import subprocess
import sys
import tempfile

LIMIT = 65536

def revision(data):
    return hashlib.sha256(data).hexdigest()

def fail(code):
    raise ValueError(code)

def target(root, relative):
    if not isinstance(relative, str) or os.path.isabs(relative) or '\0' in relative:
        fail('SSH_INVALID_PATH')
    result = os.path.abspath(os.path.join(root, relative))
    if os.path.commonpath([root, result]) != root:
        fail('SSH_PATH_OUTSIDE_ROOT')
    if result == os.path.join(root, '.dsh-ssh-write.lock'):
        fail('SSH_RESERVED_PATH')
    current = root
    for part in os.path.relpath(result, root).split(os.sep):
        current = os.path.join(current, part)
        if os.path.islink(current):
            fail('SSH_SYMLINK_DENIED')
    return result

def read_file(filename):
    fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            fail('SSH_INVALID_FILE')
        if info.st_size > LIMIT:
            fail('SSH_FILE_TOO_LARGE')
        data = stream.read(LIMIT + 1)
        if len(data) > LIMIT:
            fail('SSH_FILE_TOO_LARGE')
        return data

def run(request):
    # Saved PI-Desktop-style connections may use ~ as their remote directory;
    # expansion happens on the remote account, never on the local Host.
    root = os.path.realpath(os.path.expanduser(request['root']))
    if not os.path.isdir(root):
        fail('SSH_ROOT_REQUIRED')
    action = request['action']
    if action == 'probe':
        return {'root': root, 'platform': sys.platform, 'python': list(sys.version_info[:3])}
    if action == 'exec':
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            child = subprocess.Popen(['/bin/sh', '-c', request['command']], cwd=root, stdout=out, stderr=err, stdin=subprocess.DEVNULL, start_new_session=True)
            timed_out = False
            try:
                child.wait(timeout=request['timeout'])
            except subprocess.TimeoutExpired:
                timed_out = True
            finally:
                try: os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                child.wait()
            streams = []
            for stream in [out, err]:
                size = stream.tell()
                stream.seek(max(0, size - LIMIT))
                streams.append({'text': stream.read(LIMIT).decode('utf-8', errors='replace'), 'truncated': size > LIMIT})
            return {'exitCode': child.returncode, 'timedOut': timed_out, 'stdout': streams[0], 'stderr': streams[1]}
    filename = target(root, request.get('path', '.'))
    if action == 'list':
        entries = []
        with os.scandir(filename) as iterator:
            for entry in iterator:
                if len(entries) >= 500:
                    return {'path': filename, 'entries': entries, 'truncated': True}
                entries.append({'name': entry.name, 'kind': 'symlink' if entry.is_symlink() else 'directory' if entry.is_dir(follow_symlinks=False) else 'file'})
        return {'path': filename, 'entries': entries, 'truncated': False}
    if action == 'read':
        if request.get('preview') is True:
            fd = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode):
                os.close(fd)
                fail('SSH_INVALID_FILE')
            with os.fdopen(fd, 'rb') as stream:
                data = stream.read(256 * 1024)
            if b'\0' in data:
                fail('SSH_BINARY_FILE')
            return {'content': data.decode('utf-8', errors='replace'), 'size': info.st_size, 'truncated': info.st_size > len(data)}
        data = read_file(filename)
        return {'content': data.decode('utf-8'), 'revision': revision(data)}
    if action == 'write':
        data = request['content'].encode('utf-8')
        if len(data) > LIMIT or b'\0' in data:
            fail('SSH_INVALID_CONTENT')
        lockname = os.path.join(root, '.dsh-ssh-write.lock')
        lockfd = os.open(lockname, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(lockfd, 'rb') as lock:
            if os.fstat(lock.fileno()).st_nlink != 1:
                fail('SSH_INVALID_LOCK')
            try: fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError: fail('SSH_WRITE_BUSY')
            try:
                current = read_file(filename)
                base = revision(current)
                mode = stat.S_IMODE(os.stat(filename, follow_symlinks=False).st_mode)
            except FileNotFoundError:
                base, mode = 'missing', 0o600
            if request.get('baseRevision') != base:
                fail('SSH_REVISION_CONFLICT')
            fd, temporary = tempfile.mkstemp(prefix='.dsh-write-', dir=os.path.dirname(filename))
            try:
                with os.fdopen(fd, 'wb') as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
                    os.fchmod(stream.fileno(), mode)
                os.replace(temporary, filename)
            finally:
                if os.path.exists(temporary): os.unlink(temporary)
        return {'saved': True, 'revision': revision(data)}
    fail('SSH_INVALID_ACTION')

if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(512 * 1024 + 1)
        if len(raw) > 512 * 1024: fail('SSH_REQUEST_TOO_LARGE')
        result = {'ok': True, 'result': run(json.loads(raw))}
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error).startswith('SSH_') else 'SSH_REMOTE_FAILED'
        result = {'ok': False, 'error': code}
    print(json.dumps(result))
