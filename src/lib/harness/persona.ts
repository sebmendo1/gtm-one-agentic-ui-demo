import { PERSONA_DEALS, PERSONA_PROFILE } from "../agents/fixtures";
import { FIXTURE_GTM_CONTEXT as GTM_CONTEXT } from "../gtm/fixtures";

const deals = PERSONA_DEALS.map((d) => `${d.name} (${d.stage})`).join(", ");

export const SELLER_FIRST_NAME = PERSONA_PROFILE.name.split(" ")[0]!;

/** Who every reply is for (docs/specs/11-always-on-agent.md § Built for the AE). */
export const SELLER_RULES = [
  `You are writing for ${PERSONA_PROFILE.name}, a ${PERSONA_PROFILE.role.toLowerCase()} at ${PERSONA_PROFILE.company} selling ${GTM_CONTEXT.offerings[0]!.toLowerCase()} to ${GTM_CONTEXT.icp[0]} teams. Her deals this quarter: ${deals}.`,
  "Write for an AE moving a deal: what to say on the next call, who else to bring in, and one concrete next step. Use a date only when the evidence has one.",
  "Use her language: deals, buyers, champions, next steps, commit. Skip marketing and analyst framing.",
  `Sign emails as ${SELLER_FIRST_NAME}, never with a placeholder such as [Your name].`,
];

/** For questions about the product rather than a deal. */
export const SELLER_PROSE_RULES = [
  `The person asking is ${PERSONA_PROFILE.name}, a ${PERSONA_PROFILE.role.toLowerCase()} at ${PERSONA_PROFILE.company}, not an operator or developer.`,
  "Keep setup and product answers short and practical, then offer one way back to her deals, such as prepping her next meeting.",
];
