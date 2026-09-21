import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fail } from './definition.js';

export async function publishHalo(input, configPath, signal) {
  let destination;
  try { destination = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { fail('HALO_DESTINATION_REQUIRED'); }
  if (!/^[a-zA-Z0-9_.@-]+$/.test(destination.sshHost ?? '') || !/^\/[a-zA-Z0-9_./-]+$/.test(destination.helper ?? '')) fail('HALO_DESTINATION_INVALID');
  const article = input.article;
  if (!article || typeof article.text !== 'string' || !article.text.trim() || typeof article.title !== 'string' || !/^[a-z0-9][a-z0-9-]{2,100}$/.test(article.slug ?? '')) fail('PUBLISH_ARTICLE_INVALID');
  if (!Number.isFinite(input.review?.score) || input.review.score < 85) fail('PUBLISH_REVIEW_REQUIRED');
  const publication = input.request?.publication;
  if (publication?.slug && article.slug !== publication.slug) fail('PUBLISH_TARGET_MISMATCH');
  if (publication?.postId && !/^[a-zA-Z0-9-]+$/.test(publication.postId)) fail('PUBLISH_TARGET_INVALID');
  const payload = JSON.stringify({ title: article.title, slug: article.slug, text: article.text, category: destination.category, expectedPostId: publication?.postId, dryRun: Boolean(input.dryRun) });
  if (Buffer.byteLength(payload) > 4 * 1024 * 1024) fail('PUBLISH_SIZE_LIMIT');
  return await new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', destination.sshHost, `python3 ${destination.helper}`], { signal, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; if (out.length > 65536) child.kill(); });
    // Remote diagnostics may contain private server data; expose only a stable error code.
    child.stderr.resume();
    child.on('error', () => reject(new Error('HALO_CONNECTION_FAILED')));
    child.stdin.on('error', () => {});
    child.on('close', code => {
      if (code !== 0) return reject(new Error('HALO_PUBLISH_FAILED'));
      try {
        const result = JSON.parse(out);
        if (result.status !== (input.dryRun ? 'validated' : 'published') || (!input.dryRun && !/^https?:\/\//.test(result.url ?? ''))) throw Error();
        resolve(result);
      } catch { reject(new Error('HALO_RESPONSE_INVALID')); }
    });
    child.stdin.end(payload);
  });
}
