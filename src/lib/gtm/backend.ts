import "server-only";
import { COMMANDS, type CommandDef, type CommandId } from "./commands";
import { realCliBackend } from "./cli";
import { fixtureBackend } from "./fixture-cli";

export type SourceKind = "gtm-cli" | "fixtures";

export type CliState = "ready" | "not_installed" | "unauthenticated" | "skipped";

export interface RunResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
  ms: number;
  timedOut: boolean;
}

export interface GtmBackend {
  kind: SourceKind;
  help(command: CommandId): Promise<string | null>;
  run(argv: string[], timeoutMs: number): Promise<RunResult>;
}

export interface BackendChoice {
  backend: GtmBackend;
  cli: CliState;
  detail: string;
}

/** The CLI signs in through a browser and stores its token under ~/.config, which a Vercel function never has. */
export function dataSourceMode(): "auto" | "cli" | "fixtures" {
  const mode = (process.env.GTM_DATA_SOURCE ?? (process.env.VERCEL ? "fixtures" : "auto")).toLowerCase();
  return mode === "cli" || mode === "fixtures" ? mode : "auto";
}

/**
 * `auto` uses the real `gtm` binary when it is installed and `gtm auth whoami` succeeds,
 * otherwise the fixture emulator. `cli` never falls back, so missing auth surfaces as
 * `unauthorized` evidence instead of demo data.
 */
export async function chooseBackend(): Promise<BackendChoice> {
  const mode = dataSourceMode();
  if (mode === "fixtures") {
    return { backend: fixtureBackend, cli: "skipped", detail: "GTM_DATA_SOURCE=fixtures" };
  }
  const status = await realCliBackend.status();
  if (status.state === "ready" || mode === "cli") {
    return { backend: realCliBackend, cli: status.state, detail: status.detail };
  }
  return { backend: fixtureBackend, cli: status.state, detail: status.detail };
}

export function timeoutFor(command: CommandId): number {
  const def: CommandDef = COMMANDS[command];
  return def.timeoutMs ?? 30_000;
}
