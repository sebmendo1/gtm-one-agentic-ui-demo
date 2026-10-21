import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { COMMANDS, type CommandDef, type CommandId } from "./commands";
import type { CliState, GtmBackend, RunResult } from "./backend";

const STATUS_TTL_MS = 60_000;
const MAX_BUFFER = 8 * 1024 * 1024;

/** `@zoominfo/gtm-ai-cli` ships as one self-contained ES module; next.config.ts traces it into the server build. */
const BUNDLED_CLI = path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "@zoominfo", "gtm-ai-cli", "dist", "index.js");

type CliCommand = { file: string; prefix: string[]; origin: "GTM_CLI_BIN" | "bundled" | "PATH" };

/** `GTM_CLI_BIN` wins, then the bundled package (run with this Node), then `gtm` on PATH. */
function cliCommand(): CliCommand {
  const custom = process.env.GTM_CLI_BIN?.trim();
  if (custom) return { file: custom, prefix: [], origin: "GTM_CLI_BIN" };
  if (existsSync(BUNDLED_CLI)) return { file: process.execPath, prefix: [BUNDLED_CLI], origin: "bundled" };
  return { file: "gtm", prefix: [], origin: "PATH" };
}

function exec(argv: string[], timeoutMs: number): Promise<RunResult> {
  const started = Date.now();
  const cli = cliCommand();
  return new Promise((resolve) => {
    execFile(
      /*turbopackIgnore: true*/ cli.file,
      [...cli.prefix, ...argv],
      { timeout: timeoutMs, maxBuffer: MAX_BUFFER, env: process.env, windowsHide: true },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
        let json: unknown = null;
        try {
          json = stdout.trim() ? JSON.parse(stdout) : null;
        } catch {
          json = null;
        }
        resolve({
          ok: !err,
          exitCode: err ? (typeof err.code === "number" ? err.code : null) : 0,
          stdout,
          stderr: err?.code === "ENOENT" ? "ENOENT: gtm binary not found" : stderr,
          json,
          ms: Date.now() - started,
          timedOut: Boolean(err?.killed),
        });
      },
    );
  });
}

let cachedStatus: { at: number; state: CliState; detail: string } | null = null;
const helpCache = new Map<string, string | null>();
let rawToolsCache: unknown[] | null = null;

async function status(): Promise<{ state: CliState; detail: string }> {
  if (cachedStatus && Date.now() - cachedStatus.at < STATUS_TTL_MS) return cachedStatus;
  const { origin } = cliCommand();
  const version = await exec(["--version"], 10_000);
  let next: { state: CliState; detail: string };
  if (!version.ok) {
    next = {
      state: "not_installed",
      detail:
        origin === "GTM_CLI_BIN"
          ? `GTM_CLI_BIN (${process.env.GTM_CLI_BIN}) did not run.`
          : "The bundled GTM CLI is missing. Run npm install (it ships as @zoominfo/gtm-ai-cli).",
    };
  } else {
    const label = `GTM CLI ${version.stdout.trim()} (${origin === "bundled" ? "bundled" : origin})`;
    const whoami = await exec(["auth", "whoami"], 15_000);
    next = whoami.ok
      ? { state: "ready", detail: `${label} · ${whoami.stdout.trim().split("\n")[0] ?? "signed in"}` }
      : { state: "unauthenticated", detail: `${label} is installed but not signed in. Run: npm run gtm -- auth login` };
  }
  cachedStatus = { at: Date.now(), ...next };
  return next;
}

async function help(command: CommandId): Promise<string | null> {
  if (helpCache.has(command)) return helpCache.get(command) ?? null;
  const def: CommandDef = COMMANDS[command];
  let text: string | null = null;
  if (def.raw) {
    if (!rawToolsCache) {
      const listed = await exec(["raw", "list-tools", "-f", "json"], 20_000);
      const json = listed.json as { data?: unknown[] } | unknown[] | null;
      rawToolsCache = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    }
    const entry = rawToolsCache.find((t) => JSON.stringify(t).includes(`"${def.mcpTool}"`));
    text = entry ? JSON.stringify(entry).slice(0, 4000) : null;
  } else {
    const result = await exec([...def.path, "--help"], 15_000);
    text = result.ok ? (result.stdout || result.stderr).slice(0, 4000) : null;
  }
  helpCache.set(command, text);
  return text;
}

export const realCliBackend: GtmBackend & { status: typeof status } = {
  kind: "gtm-cli",
  status,
  help,
  run: exec,
};
