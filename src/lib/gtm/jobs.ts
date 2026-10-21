export const GTM_JOBS = {
  account_brief:
    "Account Research: a full intelligence brief on a company before a call or QBR",
  buying_committee: "Buying Committee: map decision-makers, gaps, and multithread risk at an account",
  intent_monitor: "Intent Monitor: see which intent topics map to our offerings vs competitor categories",
  why_now: "Why Now: build a timing thesis and outreach hooks for reaching out now",
  score_accounts: "Score Accounts: tier an account by ICP fit and in-market signals with explainable scores",
  tech_stack: "Tech Stack Snapshot: technographics and displacement or integration angles",
  competitor: "Competitor Analysis: fact-led comparison against a named competitor",
  contact_brief: "Contact Research: intelligence brief on one buyer or champion",
  draft: "Draft: write an email, call agenda, talk track, or other outreach copy for an account or person, from research already gathered",
  gtm_context: "GTM Context: our organization's offerings, personas, ICP, and competitors",
} as const;

export type GtmJob = keyof typeof GTM_JOBS;

export const GTM_PURPOSES = {
  pre_call: "Preparing for a discovery call, executive briefing, or QBR",
  inbound_triage: "Triaging an inbound lead — route to AE vs nurture",
  competitive: "Competitive deal prep or displacement conversation",
  renewal: "Renewal, expansion, or churn-risk conversation",
} as const;

export type GtmPurpose = keyof typeof GTM_PURPOSES;
