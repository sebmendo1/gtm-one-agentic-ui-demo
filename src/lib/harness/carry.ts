import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlaceholderContext } from "../gtm/commands";
import type { GtmJob } from "../gtm/jobs";
import type { SignedEvidence } from "../spec";
import type { Entity, Evidence, Ledger } from "./evidence";

// Evidence carried between turns (docs/specs/07-agentic-harness.md § Evidence carry). The server is
// stateless, so the client holds the ledger; an HMAC keeps it from being edited on the way back.

const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_RECORD_CHARS = 12_000;
const MAX_TOTAL_CHARS = 150_000;

export interface CarriedEvidence {
  v: 1;
  job: GtmJob;
  entity: Entity;
  ctx: PlaceholderContext;
  source: "gtm-cli" | "fixtures";
  items: Evidence[];
  at: number;
}

function secret(): string {
  const key = process.env.HARNESS_SECRET?.trim() || process.env.TYPESAFE_API_KEY?.trim();
  if (!key) throw new Error("HARNESS_SECRET or TYPESAFE_API_KEY must be set to sign evidence.");
  return `gtm-evidence:${key}`;
}

function mac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function trimRecords(records: unknown[], budget: number): unknown[] {
  const kept: unknown[] = [];
  let used = 0;
  for (const record of records) {
    const size = JSON.stringify(record)?.length ?? 0;
    if (size > MAX_RECORD_CHARS || used + size > budget) break;
    kept.push(record);
    used += size;
  }
  return kept;
}

export function signEvidence(input: { job: GtmJob; ledger: Ledger }): SignedEvidence {
  const { job, ledger } = input;
  let remaining = MAX_TOTAL_CHARS;
  const items = ledger.items.map((item) => {
    const records = trimRecords(item.records, remaining);
    remaining -= JSON.stringify(records).length;
    return { ...item, records, count: records.length < item.records.length ? item.count : records.length };
  });
  const body: CarriedEvidence = {
    v: 1,
    job,
    entity: ledger.entity,
    ctx: ledger.ctx,
    source: ledger.backend.kind,
    items,
    at: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return { payload, sig: mac(payload) };
}

export function verifyEvidence(signed: SignedEvidence | null | undefined): CarriedEvidence | null {
  if (!signed) return null;
  const expected = Buffer.from(mac(signed.payload));
  const actual = Buffer.from(signed.sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const body = JSON.parse(Buffer.from(signed.payload, "base64url").toString("utf8")) as CarriedEvidence;
    if (body.v !== 1 || !Array.isArray(body.items) || Date.now() - body.at > MAX_AGE_MS) return null;
    return body;
  } catch {
    return null;
  }
}

function norm(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Carried evidence only applies when this turn is about the same account (or, without one, person). */
export function sameSubject(a: Entity, b: Entity): boolean {
  if (a.domain && b.domain) return norm(a.domain) === norm(b.domain);
  if (a.company && b.company) return norm(a.company) === norm(b.company);
  if (a.contact && b.contact) return norm(a.contact) === norm(b.contact);
  return false;
}
