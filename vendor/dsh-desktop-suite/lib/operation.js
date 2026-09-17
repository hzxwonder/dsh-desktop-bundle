/**
 * One bounded package operation over the Desktop `desktopPnpm` service.
 *
 * The service deliberately owns only process truth: it starts at most one
 * package operation per Cordis generation, exposes the streams, and resolves
 * `done` after the complete subprocess tree is gone. This wrapper owns what the
 * caller must supply instead: a deadline, drained and bounded diagnostics,
 * explicit cancellation, and the teardown wait before the generation disposes.
 */

const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_MAX_OUTPUT_CHARS = 16 * 1024;

function capture(stream, limit) {
  let text = '';
  let bytes = 0;
  let truncated = false;
  stream.setEncoding?.('utf8');
  stream.on('data', chunk => {
    const value = String(chunk);
    bytes += Buffer.byteLength(value);
    text += value;
    if (text.length > limit) {
      text = text.slice(-limit);
      truncated = true;
    }
  });
  // A stream error must not become an unhandled event: the outcome, not the
  // stream, decides whether the operation succeeded.
  stream.on('error', () => {});
  return {text: () => text, truncated: () => truncated, bytes: () => bytes};
}

/**
 * Drain a settled stream's final chunks. `done` resolves once the subprocess
 * tree is gone, which can still leave the closing chunk of a pipe queued, so
 * wait for the end of the stream but never longer than a short grace period.
 */
async function settled(stream, graceMs = 250) {
  if (stream.readableEnded === true || stream.destroyed === true) return;
  await Promise.race([
    new Promise(resolve => {
      stream.once('end', resolve);
      stream.once('close', resolve);
      stream.once('error', resolve);
    }),
    new Promise(resolve => setTimeout(resolve, graceMs).unref()),
  ]);
}

export class DesktopPackageOperations {
  constructor(ctx, {timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS} = {}) {
    this.ctx = ctx;
    this.timeoutMs = timeoutMs;
    this.maxOutputChars = maxOutputChars;
    this.active = undefined;
    this.last = undefined;
  }

  get busy() {
    return this.active !== undefined;
  }

  /** Bounded record of the most recent settled operation, for status reads. */
  get lastOutcome() {
    return this.last;
  }

  /**
   * Run one `dsh plugin` invocation against the active profile. Throws before
   * starting anything when the service is busy or rejects the request, and
   * resolves with the complete outcome otherwise.
   */
  async runPlugin(argv, {invokingDir, signal} = {}) {
    if (this.active !== undefined) throw new Error('DESKTOP_SUITE_BUSY');
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline]);
    let handle;
    try {
      handle = this.ctx.desktopPnpm.runPlugin(argv, invokingDir, combined);
    } catch (error) {
      throw new Error(`DESKTOP_SUITE_REJECTED: ${error?.message ?? error}`);
    }
    this.active = handle;
    const stdout = capture(handle.stdout, this.maxOutputChars);
    const stderr = capture(handle.stderr, this.maxOutputChars);
    let outcome;
    try {
      outcome = await handle.done;
    } catch (error) {
      throw new Error(`DESKTOP_SUITE_SPAWN_FAILED: ${error?.message ?? error}`);
    } finally {
      if (this.active === handle) this.active = undefined;
    }
    await Promise.all([settled(handle.stdout), settled(handle.stderr)]);
    const record = {
      argv: [...argv],
      exitCode: Number.isInteger(outcome?.exitCode) ? outcome.exitCode : null,
      signal: typeof outcome?.signal === 'string' ? outcome.signal : null,
      timedOut: deadline.aborted,
      aborted: combined.aborted,
      truncated: stdout.truncated() || stderr.truncated(),
      stdoutBytes: stdout.bytes(),
      stderrBytes: stderr.bytes(),
      stdout: stdout.text(),
      stderr: stderr.text(),
    };
    // A zero exit code is necessary but not sufficient: a terminating signal
    // means the operation was killed even when the wrapper reported success.
    record.ok = record.exitCode === 0 && record.signal === null;
    this.last = record;
    return record;
  }

  cancel() {
    const handle = this.active;
    if (handle === undefined) return;
    try {
      handle.cancel();
    } catch {
      // Cancellation races with settlement; `done` still reports the truth.
    }
  }

  /** Cancel the active operation and wait for its subprocess tree to exit. */
  async dispose() {
    const handle = this.active;
    if (handle === undefined) return;
    this.cancel();
    await handle.done.catch(() => {});
  }
}
