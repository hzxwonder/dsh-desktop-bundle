// The resident of dsh-claude-code-relay: one long-lived `claude -p --input-format stream-json`
// process per dsh session. The CLI's stream-json stdin accepts one user message per line for as
// long as it stays open, so a session's turns ride one process instead of paying the CLI's
// startup — settings, skills, MCP handshake — on every turn. It also retires the per-turn
// existsSync(transcript) race: the live process IS the history.
//
// Nothing here decides how to spawn; the adapter owns that (resume vs fresh, args, env). This
// class owns only the process's second life: reuse while alive and unchanged, idle retirement,
// and clean disposal. The CLI's persisted transcript is the recovery point, so any death — idle
// retirement, an option change, an abort, a crash — costs at most one respawn.

import { CliProcess } from "./process.js";

/** How long a resident survives after its last turn before it is retired. Long enough that a
 *  follow-up question reuses the warm process, short enough that a day's abandoned sessions do
 *  not pile up idle CLIs in memory. The next turn after a retirement simply respawns. */
export const RESIDENT_IDLE_MS = 10 * 60 * 1000;

/** One dsh session's resident process. */
export class ResidentCli {
  constructor({ sessionId, idleMs = RESIDENT_IDLE_MS, log = () => {} } = {}) {
    this.sessionId = sessionId;
    this.idleMs = idleMs;
    this.log = log;
    this.proc = null;
    // The spawn key the current process was spawned under: any per-turn option it encodes (model,
    // effort, system prompt, access shield, endpoint, credential) changing means a respawn.
    this.key = "";
    // Set the moment the between-turns retirement kill is issued, so a begin() racing the exit
    // event treats the process as gone instead of reusing one that is already dying.
    this.retiring = false;
    this.idleTimer = null;
    this.inTurn = false;
    this.strays = null;
  }

  get alive() {
    return Boolean(this.proc && !this.proc.exited && !this.retiring);
  }

  /** The live process for this turn, or null when it must be spawned — it never died, was
   *  retired, or this turn would spawn it differently than the one running. */
  begin(key) {
    if (this.inTurn) {
      throw new Error(
        `session ${this.sessionId} already has a turn in flight on its resident process`,
      );
    }
    if (!this.alive || this.key !== key) {
      if (this.proc && this.key !== key && this.alive) {
        this.log("info", "resident respawned: this turn's options differ from the running process");
      }
      this.discard();
      return null;
    }
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    // Frames that trailed the previous turn's result. Usually bookkeeping of a turn already
    // closed (the caller drops them) — but after an early-delivered queue message they are the
    // CLI's answer to it, which the caller replays when dsh starts that message's turn.
    this.strays = this.proc.drainPending();
    this.proc.resumeIdle();
    this.inTurn = true;
    return this.proc;
  }

  /** Frames buffered since the previous turn's result, draining the holder. */
  takeStrays() {
    const out = this.strays ?? [];
    this.strays = null;
    return out;
  }

  /** Start holding a freshly spawned process, replacing whatever was there. */
  adopt(proc, key) {
    if (this.proc && this.proc !== proc && this.alive) this.proc.kill();
    this.proc = proc;
    this.key = key;
    this.retiring = false;
    this.inTurn = true;
  }

  /** A turn ended with its result frame: park the silence watchdog and start the retirement
   *  countdown. A process that already died (an abort, a crash) is dropped instead. */
  endTurn() {
    this.inTurn = false;
    if (!this.proc || this.proc.exited || this.retiring) {
      this.clear();
      return;
    }
    this.proc.suspendIdle();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.retiring = true;
      this.log("info", "resident retired after idle; the next turn respawns from the transcript");
      try {
        this.proc.kill();
      } catch {
        // already gone
      }
      this.clear();
    }, this.idleMs);
    this.idleTimer.unref?.();
  }

  /** Drop the process reference, killing it if it is still around. */
  discard() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.inTurn = false;
    const proc = this.proc;
    this.clear();
    try {
      proc?.kill();
    } catch {
      // already gone
    }
  }

  clear() {
    this.proc = null;
    this.key = "";
    this.retiring = false;
    this.strays = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
