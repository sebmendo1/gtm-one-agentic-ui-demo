import "server-only";
import { streamText } from "ai";
import type { HistoryEntry } from "../spec";
import { GEMINI_PROVIDER_OPTIONS, SAFETY_BLOCKED, addUsage, geminiErrorText, geminiModel, type TokenTally } from "./gemini";
import { SCOPE_RULES } from "./guardrails";
import { PLATFORM_RULES, knowledgeDocs } from "./knowledge";

const TEMPLATE = `This app already includes the GTM CLI, so there's nothing to install — you only need to sign in:

1. **Sign in** from the project folder: \`npm run gtm -- auth login\`. It opens browser OAuth with ZoomInfo (no API keys).
2. **Check it:** \`npm run gtm -- auth whoami\`.
3. **Ask again.** With \`GTM_DATA_SOURCE=auto\` the app switches from demo data to live ZoomInfo data within a minute of signing in.

New to ZoomInfo? Create a free account on [Start Building](https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research).

Using Cursor or another AI client instead? Connect the [ZoomInfo MCP server](https://gtm.ai/docs/mcp/clients/cursor). More in the [command reference](https://gtm.ai/docs/cli/commands).`;

export async function answerProse(input: {
  description: string;
  history: HistoryEntry[];
  usage: TokenTally;
  modelId: string;
  useGemini: boolean;
  onDelta: (text: string) => void;
}): Promise<{ markdown: string; writer: { kind: "gemini" | "template"; model: string | null }; error?: string }> {
  if (!input.useGemini) return { markdown: TEMPLATE, writer: { kind: "template", model: null } };
  try {
    const docs = await knowledgeDocs();
    const result = streamText({
      model: geminiModel(),
      temperature: 0.2,
      maxRetries: 1,
      providerOptions: GEMINI_PROVIDER_OPTIONS,
      instructions: [
        "You are GTM AI, a conversational assistant. You answer questions about ZoomInfo and GTM AI: the GTM platform and its products, Context Agents, Skills, the Context Graph, data and credits, installing the GTM CLI or ZoomInfo MCP, and how this chat app works.",
        ...SCOPE_RULES,
        "Answer only from the references below. If they do not cover the question, say so and link https://gtm.ai/docs. Where the knowledge base marks something as inferred or unconfirmed, say so.",
        "Reply like a helpful colleague in chat. GitHub-flavored Markdown: short paragraphs or numbered steps, commands in inline code or fenced code blocks, no headings for short answers.",
        ...PLATFORM_RULES,
        "Reference — ZoomInfo and GTM AI knowledge base:",
        docs.knowledgeBase,
        "Reference — how this app uses the GTM platform (spec 08):",
        docs.platform,
        "Reference — install and connect (spec 06):",
        docs.setup,
        "This app: Gemini plans GTM CLI calls and writes cited replies; Jev (TypeSafe) decides whether and which interactive components to show; paid CLI steps need one approval. The GTM CLI is bundled with this app, so never tell the user to install it here; they only sign in with `npm run gtm -- auth login` from the project folder. Without a signed-in CLI it uses demo fixtures (Snowflake, Stripe, Salesforce, Jordan Lee, Alex Chen).",
      ].join("\n"),
      messages: [
        ...input.history.map((h) => ({ role: h.role, content: h.text })),
        { role: "user" as const, content: input.description },
      ],
    });
    let text = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        text += part.text;
        input.onDelta(part.text);
      } else if (part.type === "error") {
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }
    addUsage(input.usage, await result.totalUsage);
    if ((await result.finishReason) === "content-filter") throw new Error(SAFETY_BLOCKED);
    return { markdown: text.trim(), writer: { kind: "gemini", model: input.modelId } };
  } catch (error) {
    return { markdown: TEMPLATE, writer: { kind: "template", model: null }, error: `Gemini answer failed: ${geminiErrorText(error)}` };
  }
}
