---
title: "Guardrails: safety filters and prompt-injection defense"
description: The guardrails every Gemini call, tool call and rendered reply must pass, modelled on Google's Gemini safety settings and its layered prompt-injection defense.
tags:
  - spec
  - security
  - guardrails
  - gemini
  - prompt-injection
status: active
sources:
  - ../external-sources/google-layered-prompt-injection-defense.md
  - ../external-sources/gemini-api-safety-settings.md
  - ../external-sources/gemini-api-safety-guidance.md
updated: 2026-10-20
---
# Guardrails: safety filters and prompt-injection defense

This spec defines the guardrails the harness, Jev and the chat UI must keep. They follow the basic protections Google documents for Gemini: adjustable harm filters ([Gemini safety settings](../external-sources/gemini-api-safety-settings.md)), its five-layer defense against indirect prompt injection ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)), and the developer duties in its [safety and factuality guidance](../external-sources/gemini-api-safety-guidance.md). Each guardrail below names the Google practice it comes from, the behaviour required here, and where the code enforces it.

The harness itself is specified in [agentic harness](./07-agentic-harness.md); the data it reads is described in [ZoomInfo and the GTM platform](./08-zoominfo-gtm-platform.md).

## 1. Threat model

Google separates direct prompt injection, where the attacker types the malicious instruction, from indirect prompt injection, where it hides in external data such as emails, documents or calendar invites and tries to make the AI exfiltrate data or take rogue actions ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)). This app has both exposures.

| What could be attacked | Where untrusted text enters | Why it matters here |
| --- | --- | --- |
| ZoomInfo credits | The approval payload the browser sends back; any cross-site request to `/api/generate` | Paid CLI steps spend the signed-in account's data and AI credits |
| Customer data in evidence | ZoomInfo records, CRM history, emails and call transcripts returned by the GTM CLI | This is the indirect-injection surface: outside parties write the emails and transcripts the writer reads |
| The reply the user sees | Gemini's Markdown output | Links and images in a reply can carry data to an attacker's server |
| Gemini key, prompts, file paths | The user's own prompt and chat history | A direct injection may try to extract instructions or secrets |
| The CLI process | Flags and raw arguments that Gemini plans | A crafted value could try to smuggle CLI options |

**Trust levels.** The person using the app is the principal. Their prompt is a request, not data, but it is still subject to the harm filters, scope rules and tool allowlist. Everything returned by the GTM CLI or fixtures, every `--help` text, and the chat history the browser sends back is untrusted data.

## 2. Guardrails

Status means: **In place** existed before this spec; **Added** ships with this spec; **Planned** is required but not built yet.

### G1. Harm filters on every Gemini call

*Google practice:* adjustable safety filters for harassment, hate speech, sexually explicit and dangerous content. Categories left unset use the default threshold, which is **Off for Gemini 2.5 and later** ([safety settings](../external-sources/gemini-api-safety-settings.md)). Google's guidance lists adjusting these settings as a mitigation and leaves responsible use to the developer ([safety guidance](../external-sources/gemini-api-safety-guidance.md)).

*Required behaviour:*

1. The planner, the writer and the prose answerer send `BLOCK_MEDIUM_AND_ABOVE` ("Block some") for all four categories on every request. No call may rely on the default.
2. A blocked request is not retried. The planner falls back to the default plan, the writer to the evidence-only reply, and the prose answerer to its fixed template.
3. The trace says the safety filter blocked the request, so a block is never mistaken for an outage.

Google always blocks core harms such as content that endangers child safety, whatever the settings ([safety settings](../external-sources/gemini-api-safety-settings.md)).

*Status:* **Added.** `GEMINI_PROVIDER_OPTIONS` in `src/lib/harness/gemini.ts`; `geminiErrorText` maps blocks.

### G2. Screen untrusted text for instructions

*Google practice:* prompt-injection content classifiers detect malicious instructions in emails and files and filter them out before Gemini answers ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)).

*Required behaviour:*

1. Before any evidence reaches Gemini (planner previews, tool results, writer payload), every string in it is screened for text addressed to an AI. Examples: "ignore previous instructions", "you are now", "system prompt", "new instructions:", reveal-the-prompt requests, and Markdown image links.
2. Each matching sentence is replaced with `[removed: text addressed to an AI]`, and each Markdown image is replaced on its own. A sentence ends at `.`, `!` or `?` followed by a space, so dots inside a URL don't leave fragments of it behind. The rest of the record is kept, so a single poisoned email doesn't erase an account's evidence.
3. The screen runs on text sent to the model only. Widgets render records as escaped text, so they show the original data.

This is a pattern screen, not a trained classifier. Google's guidance itself warns that static blocklists can misfire ([safety guidance](../external-sources/gemini-api-safety-guidance.md)), so the patterns target phrasing aimed at an AI rather than ordinary business words.

*Status:* **Added.** `screenUntrusted` in `src/lib/harness/guardrails.ts`. Replacing it with a trained classifier is **Planned**.

### G3. Fence untrusted data and reinforce the task

*Google practice:* security thought reinforcement adds targeted security instructions around the content, reminding the model to do the user's task and ignore adversarial instructions in it ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)).

*Required behaviour:*

1. Untrusted data goes into the prompt only inside `<untrusted_evidence>` or `<untrusted_history>` blocks. Every `<` in the data is escaped as `\u003c`, so data can't close the block or open a fake one.
2. Security rules come immediately before the block, and a reminder comes immediately after it. They say the content is data, and that instructions inside it are never followed, even if they claim to come from the user, ZoomInfo or a developer. That covers changing the task, revealing instructions, planning or approving tool calls, and adding links, images or contact details.
3. Evidence never goes into the instructions as bare JSON.

*Status:* **Added** for the planner and the writer.

### G4. Sanitize Markdown and redact links

*Google practice:* Gemini's Markdown sanitizer won't render external image URLs, which defeats zero-click image exfiltration ("EchoLeak"). Suspicious URLs are redacted and replaced with "suspicious link removed" ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)).

*Required behaviour:*

1. Replies never render images. An image in Markdown shows as "(image removed)" and is never fetched.
2. Links render only when they are `https` links to gtm.ai, zoominfo.com, ai.google.dev or aistudio.google.com, or their subdomains. Any other link shows its text plus "(link removed)". A bare URL shows only "(link removed)".
3. Raw HTML in replies is never rendered. `react-markdown` runs without `rehype-raw`.
4. The writer and the prose answerer are told not to add images or links beyond those hosts. Rule 1 and 2 still apply if they do.

*Status:* **Added.** `isTrustedHref` in `src/lib/safe-links.ts`, applied in `src/components/chat/Markdown.tsx`. Raw HTML was already off (**In place**). A reputation check like Google Safe Browsing is **Planned**; the allowlist is stricter in the meantime.

### G5. Human in the loop for anything that costs or changes data

*Google practice:* a user confirmation framework asks the user to confirm risky actions, so they are never executed immediately or unnoticed ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)).

*Required behaviour:*

1. Gemini can run only free, read-only commands by itself. The schema allows only free command ids, with at most 5 calls per turn.
2. Paid steps (data or AI credits) are at most 3 per plan. They are shown with an estimate and run only after the user approves.
3. Write commands (business-context updates, audience writes, feedback, arbitrary raw calls) are not in the allowlist.
4. CRM changes are drafts the user applies; the app never claims it updated a CRM.
5. Commands run with `execFile`, never a shell. Flag names must match the allowlist and the CLI's own `--help`. Values can't start with `-` and have length caps.
6. **Approval binding.** The server signs the plan it asks the user to approve and runs only that exact plan, so a forged or edited approval payload can't add or change paid steps.

*Status:* rules 1–5 **In place** (`src/lib/gtm/commands.ts`, `src/lib/harness/planner.ts`). Rule 6 is **Planned**: today the browser returns the steps, which are re-checked against the allowlist but not bound to the plan shown. G7's same-origin rule closes the cross-site route to this gap in the meantime.

### G6. Tell the user when a defense fired

*Google practice:* end-user security mitigation notifications show contextual information when a built-in defense mitigates an attack ([Google's layered defense](../external-sources/google-layered-prompt-injection-defense.md)).

*Required behaviour:*

1. When G2 removed anything from the evidence, the reply ends with a security notice. It says how many sources contained text that looked like instructions to an AI, and that the text was treated as data and not followed.
2. When G1 blocked a request, the reply is labelled as the evidence-only format and the trace names the safety filter.

*Status:* **Added** (`finalizeMarkdown` in `src/lib/harness/writer.ts`).

### G7. Limit misuse of the endpoint

*Google practice:* safeguards against deliberate misuse, such as a unique ID per user and a cap on queries per period. Protect against prompt injection, which Google compares to SQL injection ([safety guidance](../external-sources/gemini-api-safety-guidance.md)).

*Required behaviour:*

1. **Size caps:** prompt up to 2,000 characters, at most 8 history turns of 1,500 characters each, at most 12 steps in an approval payload.
2. **Same-origin only.** `/api/generate` rejects requests whose `Sec-Fetch-Site` is cross-site or same-site, whose `Origin` host differs from the request host, or whose content type isn't JSON. Without this, any website could make a visitor's browser post an approval to a locally running app and spend the signed-in account's credits.
3. **Rate limit:** 30 turns per client per 5 minutes, answered with HTTP 429. A full briefing takes two turns: plan, then approve.

The rate limit is kept in memory per server instance and keyed by client IP. That's enough for a demo, but a shared deployment needs per-user IDs and a shared store (**Planned**).

*Status:* rule 1 **In place**; rules 2 and 3 **Added** (`src/lib/request-guard.ts`, used by `src/app/api/generate/route.ts`).

### G11. Always-on sources and autopilot budget (spec 11)

*Required behaviour:*

1. Simulated **Gmail and Calendar** bodies are untrusted if they ever reach a model (same G2/G3 fencing as CLI evidence).
2. **Autopilot budget** (set at onboarding) counts as standing approval for **data credits only** on proactive cards the user has not dismissed. **AI credits** still require an explicit approval card per turn (G5).
3. `/api/agents/sweep` uses the same same-origin and rate-limit guards as `/api/generate`.

*Status:* **Added** with always-on PoC.

### G8. Keep the model on task and its instructions private

*Google practice:* narrower tasks and more human oversight lower risk ([safety guidance](../external-sources/gemini-api-safety-guidance.md)).

*Required behaviour:*

1. The writer and the prose answerer stay on go-to-market work and this app, and briefly decline anything else.
2. They never reveal or paraphrase their instructions, and never output keys, environment variables or file paths.
3. The writer states facts only from the evidence and cites them (**In place**, [spec 07](./07-agentic-harness.md)).

*Status:* rules 1 and 2 **Added** (`SCOPE_RULES` in `src/lib/harness/guardrails.ts`).

### G9. Keep secrets on the server

*Required behaviour:* the Gemini and TypeSafe keys are read only in `server-only` modules. They never appear in prompts, stream events or client payloads. Error text sent to the browser is mapped or trimmed so it can't carry them.

*Status:* **In place.**

### G10. Test adversarially

*Google practice:* run safety benchmarks and adversarial tests built from the inputs most likely to cause problems. Repeat them, because the same prompt can produce different outputs ([safety guidance](../external-sources/gemini-api-safety-guidance.md)).

*Required behaviour:* `scripts/smoke-gemini-mock.ts` must prove that:

- an injected flag value is rejected
- every Gemini request carries the G1 settings
- injected instructions in evidence are removed before the writer sees them, and the reply carries the G6 notice
- data can't close the evidence fence
- untrusted links and images are not rendered

*Status:* **Added**. A red-team prompt set run against live Gemini is **Planned**.

## 3. Known gaps

1. **Approval binding** (G5 rule 6). The fix is to sign the approval request with the server key, as signed evidence already is, and execute only verified steps.
2. **Pattern screen, not a classifier** (G2). Novel phrasing will get past it; G3 and G5 limit what a missed injection can do.
3. **Rate limit per instance** (G7). It needs a shared store and per-user IDs before any multi-user deployment.
4. **Chat history comes from the browser.** A user can forge their own earlier turns. That only affects their own session, and it's fenced as untrusted history in the planner.

## Related

- [Agentic harness](./07-agentic-harness.md): the approval gate and evidence ledger these guardrails protect
- [ZoomInfo and the GTM platform](./08-zoominfo-gtm-platform.md): what the evidence contains and who writes it
- Sources: [Google's layered prompt-injection defense](../external-sources/google-layered-prompt-injection-defense.md), [Gemini safety settings](../external-sources/gemini-api-safety-settings.md), [Gemini safety and factuality guidance](../external-sources/gemini-api-safety-guidance.md)
