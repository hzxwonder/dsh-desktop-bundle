import { mkdir, readdir, lstat, readFile, writeFile, unlink, chmod, realpath } from 'node:fs/promises';
import { resolve, join, relative, dirname, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fail } from './definition.js';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const excluded = new Set(['.git', 'node_modules', '.DS_Store', '.workflow-checkpoints']);
const inside = (root, path) => { const p = relative(root, path); return p === '' || (!p.startsWith('..') && !isAbsolute(p)); };
export class Checkpoints {
  constructor(directory) { this.directory = resolve(directory); this.locks = new Map(); this.recoveryError = null; }
  async lock(cwd, owner) {
    if (this.recoveryError) fail('CHECKPOINT_RECOVERY_REQUIRED');
    const root = await realpath(cwd);
    for (const [path, held] of this.locks)
      if (held !== owner && (inside(path, root) || inside(root, path))) fail('WORKSPACE_BUSY');
    this.locks.set(root, owner);
    return () => { if (this.locks.get(root) === owner) this.locks.delete(root); };
  }
  async snapshot(cwd) {
    const root = await realpath(cwd), files = {};
    let bytes = 0;
    const walk = async (folder) => {
      for (const item of await readdir(folder, { withFileTypes: true })) {
        const path = join(folder, item.name);
        if (excluded.has(item.name) || inside(this.directory, path)) continue;
        const info = await lstat(path);
        // Symlink targets are outside the checkpoint ownership boundary.
        if (info.isSymbolicLink()) continue;
        if (info.isDirectory()) await walk(path);
        else if (info.isFile()) {
          if (Object.keys(files).length >= 20000 || (bytes += info.size) > 128 * 1024 * 1024) fail('CHECKPOINT_SIZE_LIMIT');
          const data = await readFile(path);
          files[relative(root, path)] = { hash: digest(data), mode: info.mode & 0o777, data: data.toString('base64') };
        }
      }
    };
    await walk(root);
    return { root, files };
  }
  folder(runId, key, attempt) {
    return join(this.directory, digest(Buffer.from(runId)), 'steps', digest(Buffer.from(key)).slice(0, 20), `attempt-${attempt}`);
  }
  async save(folder, name, value) {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(join(folder, name), JSON.stringify(value, null, 2), { mode: 0o600 });
  }
  async begin(cwd, folder, input) {
    await this.save(folder, 'input.json', input);
    if (!cwd) return null;
    const before = await this.snapshot(cwd);
    await this.save(folder, 'before.json', before);
    return before;
  }
  async finish(before, folder, output) {
    await this.save(folder, 'output.json', output ?? null);
    if (!before) return { folder, changes: [] };
    const after = await this.snapshot(before.root);
    const changes = [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])]
      .filter(p => before.files[p]?.hash !== after.files[p]?.hash || before.files[p]?.mode !== after.files[p]?.mode)
      .map(path => ({ path, before: before.files[path] ?? null, after: after.files[path] ?? null }));
    await this.save(folder, 'patch.json', { root: before.root, changes });
    // Full-file unified hunks are intentionally simple; patch.json preserves binary bytes and modes.
    const patch = changes.map(c => {
      const a = c.before && Buffer.from(c.before.data, 'base64'), b = c.after && Buffer.from(c.after.data, 'base64');
      const title = `diff --git ${JSON.stringify('a/' + c.path)} ${JSON.stringify('b/' + c.path)}\n`;
      const mode = file => '100' + file.mode.toString(8).padStart(3, '0');
      const modes = !c.before ? `new file mode ${mode(c.after)}\n` : !c.after ? `deleted file mode ${mode(c.before)}\n` : c.before.mode !== c.after.mode ? `old mode ${mode(c.before)}\nnew mode ${mode(c.after)}\n` : '';
      if (a?.includes(0) || b?.includes(0)) return `${title}${modes}Binary files differ (exact bytes in patch.json)\n`;
      if (c.before?.hash === c.after?.hash) return title + modes;
      const lines = data => { const text = data?.toString('utf8') ?? ''; return text ? text.replace(/\n$/, '').split('\n') : []; };
      const al = lines(a), bl = lines(b);
      const body = (ls, prefix, data) => ls.map((line, i) => `${prefix}${line}\n${i === ls.length - 1 && data?.at(-1) !== 10 ? '\\ No newline at end of file\n' : ''}`).join('');
      return title + modes + `--- ${c.before ? JSON.stringify('a/' + c.path) : '/dev/null'}\n+++ ${c.after ? JSON.stringify('b/' + c.path) : '/dev/null'}\n@@ -${al.length ? 1 : 0},${al.length} +${bl.length ? 1 : 0},${bl.length} @@\n` + body(al, '-', a) + body(bl, '+', b);
    }).join('\n');
    await writeFile(join(folder, 'changes.patch'), patch, { mode: 0o600 });
    return { folder, root: before.root, changes: changes.map(({ path, before, after }) => ({ path, beforeHash: before?.hash, afterHash: after?.hash })) };
  }
  async recover() {
    const names = await readdir(this.directory).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
    for (const name of names.filter(n => n.startsWith('rollback-'))) {
      const folder = join(this.directory, name);
      const journal = JSON.parse(await readFile(join(folder, 'transaction.json'), 'utf8'));
      if (journal.status !== 'prepared') continue;
      try {
        const targets = new Map(journal.targets);
        for (const [path, original] of journal.originals) {
          let ancestor = path;
          while (ancestor !== dirname(ancestor)) {
            const stat = await lstat(ancestor).catch(e => { if (e.code !== 'ENOENT') throw e; });
            if (stat?.isSymbolicLink()) fail('CHECKPOINT_PATH');
            ancestor = dirname(ancestor);
          }
          const info = await lstat(path).catch(e => { if (e.code !== 'ENOENT') throw e; });
          if (info && !info.isFile()) fail('CHECKPOINT_CONFLICT');
          const current = info ? { hash: digest(await readFile(path)), mode: info.mode & 0o777 } : null;
          const matches = file => file?.hash === current?.hash && file?.mode === current?.mode;
          if (!matches(original) && !matches(targets.get(path))) fail('CHECKPOINT_CONFLICT');
        }
        for (const [path, original] of journal.originals) {
          if (original) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, Buffer.from(original.data, 'base64'), { mode: original.mode }); await chmod(path, original.mode); }
          else await unlink(path).catch(e => { if (e.code !== 'ENOENT') throw e; });
        }
        await this.save(folder, 'transaction.json', { ...journal, status: 'recovered' });
      } catch (error) { this.recoveryError = error.code ?? error.message; }
    }
    return this.recoveryError;
  }
  async rollback(checkpoints) {
    const patches = [];
    for (const checkpoint of checkpoints) {
      if (!checkpoint?.root) continue;
      if (!inside(this.directory, resolve(checkpoint.folder))) fail('CHECKPOINT_PATH');
      patches.push(JSON.parse(await readFile(join(checkpoint.folder, 'patch.json'), 'utf8')));
    }
    // Validate the complete reverse transaction against a virtual file tree first.
    const targets = new Map(), originals = new Map();
    for (const patch of patches) {
      const root = await realpath(patch.root);
      for (const c of patch.changes) {
        const path = resolve(root, c.path);
        if (!inside(root, path) || path === root) fail('CHECKPOINT_PATH');
        let ancestor = dirname(path);
        while (ancestor !== root) {
          const s = await lstat(ancestor).catch(e => { if (e.code !== 'ENOENT') throw e; });
          if (s?.isSymbolicLink() || (s && !s.isDirectory())) fail('CHECKPOINT_PATH');
          ancestor = dirname(ancestor);
        }
        if (!originals.has(path)) {
          const info = await lstat(path).catch(e => { if (e.code !== 'ENOENT') throw e; });
          if (info && !info.isFile()) fail('CHECKPOINT_CONFLICT', c.path);
          const data = info ? await readFile(path) : null;
          originals.set(path, data ? { data: data.toString('base64'), hash: digest(data), mode: info.mode & 0o777 } : null);
        }
        const current = targets.has(path) ? targets.get(path) : originals.get(path);
        if (current?.hash !== c.after?.hash || current?.mode !== c.after?.mode) fail('CHECKPOINT_CONFLICT', c.path);
        targets.set(path, c.before);
      }
    }
    if (!targets.size) return { files: 0 };
    const journal = join(this.directory, 'rollback-' + crypto.randomUUID());
    await this.save(journal, 'transaction.json', { status: 'prepared', originals: [...originals], targets: [...targets] });
    const put = async (path, file) => {
      if (!file) { await unlink(path).catch(e => { if (e.code !== 'ENOENT') throw e; }); return; }
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(file.data, 'base64'), { mode: file.mode });
      await chmod(path, file.mode);
    };
    try {
      for (const [path, file] of targets) await put(path, file);
      await this.save(journal, 'transaction.json', { status: 'completed', originals: [...originals], targets: [...targets] });
    } catch (error) {
      for (const [path, file] of originals) await put(path, file);
      throw error;
    }
    return { files: targets.size };
  }
}
