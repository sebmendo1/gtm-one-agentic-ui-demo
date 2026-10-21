import "server-only";
import { google } from "@ai-sdk/google";

// ─── Gemini API key ───────────────────────────────────────────────────────────
// Put your Gemini key in `.env.local` at the repo root (never commit it):
//
//   GOOGLE_GENERATIVE_AI_API_KEY=your-key-from-https://aistudio.google.com/apikey
//   GEMINI_MODEL=gemini-3.8-flash        # optional override
//
// `@ai-sdk/google` reads GOOGLE_GENERATIVE_AI_API_KEY automatically. Restart
// `npm run dev` after editing `.env.local`. Without a key the harness still runs:
// it uses the default tool plan and a template briefing (labeled in the UI).
// Free-tier keys allow about 20 requests per model per day and a briefing uses
// 4–5 (planner steps + writer); past that the same fallbacks apply.
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function geminiModelId(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

export function geminiModel() {
  return google(geminiModelId());
}

// Harm filters on every call (docs/specs/09-guardrails.md G1). Unset categories default to Off on
// Gemini 2.5 and later, so each one is set explicitly.
const HARM_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const;

export const GEMINI_PROVIDER_OPTIONS = {
  google: {
    safetySettings: HARM_CATEGORIES.map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" as const })),
  },
};

export const SAFETY_BLOCKED = "Gemini safety filter blocked the request.";

export function geminiErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  if (message === SAFETY_BLOCKED || /content-filter|blockReason|PROHIBITED_CONTENT|\bSAFETY\b/.test(message)) {
    return "Gemini's safety filter blocked this request, so the reply uses the evidence-only format.";
  }
  if (/quota|rate.?limit|RESOURCE_EXHAUSTED|\b429\b/i.test(message)) {
    const daily = /PerDay/i.test(message) || /per day/i.test(message);
    return daily
      ? "Gemini daily free-tier quota reached for this model (about 20 requests per day; one briefing uses 4–5). Try again tomorrow, set GEMINI_MODEL to another Flash model, or enable billing at https://aistudio.google.com/usage."
      : "Gemini rate limit or quota reached. Free-tier keys allow a few requests per minute and about 20 per model per day (one briefing uses 4–5). Wait and ask again, or enable billing at https://aistudio.google.com/usage.";
  }
  if (/API key|PERMISSION_DENIED|\b40[13]\b/i.test(message)) {
    return process.env.VERCEL
      ? "Gemini rejected GOOGLE_GENERATIVE_AI_API_KEY. Check the key in Vercel Project Settings → Environment Variables and redeploy."
      : "Gemini rejected GOOGLE_GENERATIVE_AI_API_KEY. Check the key in .env.local and restart npm run dev.";
  }
  return message.slice(0, 240);
}

export interface TokenTally {
  input_tokens: number;
  output_tokens: number;
}

export function addUsage(tally: TokenTally, usage: { inputTokens: number | undefined; outputTokens: number | undefined }) {
  tally.input_tokens += usage.inputTokens ?? 0;
  tally.output_tokens += usage.outputTokens ?? 0;
}
