// Demo records (docs/specs/05-fixtures.md). Served only through fixture-cli.ts so the harness
// reads them in the same envelope as the real GTM CLI.

export interface CompanyRecord {
  id: string;
  name: string;
  industry: string;
  employees: string;
  revenue: string;
  hq: string;
  website: string;
  tldr: string;
  icpFit: string;
  nextActions: string[];
}

export interface IntentTopic {
  topic: string;
  strength: string;
  mapsToUs: boolean;
  reason: string;
  score?: number;
}

export interface SignalsRecord {
  topics: IntentTopic[];
  scoops: { date: string; text: string }[];
  news: { date: string; headline: string }[];
}

export interface CommitteeMember {
  name: string;
  title: string;
  role: "decision" | "influencer" | "champion" | "blocker";
  engaged: boolean;
}

export interface CommitteeRecord {
  members: CommitteeMember[];
  gaps: string[];
  multithreadRisk: string;
  tldr: string;
}

export interface ScoresRecord {
  fit: number;
  inMarket: number;
  fitLabel: string;
  inMarketLabel: string;
  breakdown: { label: string; value: string }[];
  whyNow: string;
}

export interface TechCategory {
  category: string;
  tools: string[];
  play: string;
}

export interface TechStackRecord {
  categories: TechCategory[];
  tldr: string;
}

export interface CompetitorCompare {
  competitor: string;
  rows: { dimension: string; us: string; them: string }[];
  tldr: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  tldr: string;
  engagement: string;
}

export interface GtmContextRecord {
  offerings: string[];
  personas: string[];
  icp: string[];
  competitors: string[];
  role?: string;
}

export interface WhyNowRecord {
  thesis: string;
  hooks: string[];
  tldr: string;
}

export interface FixtureBundle {
  company?: CompanyRecord;
  signals?: SignalsRecord;
  committee?: CommitteeRecord;
  scores?: ScoresRecord;
  tech?: TechStackRecord;
  competitor?: CompetitorCompare;
  contact?: ContactRecord;
  whyNow?: WhyNowRecord;
  gtmContext?: GtmContextRecord;
}

export interface FixtureCompany {
  zoomId: string;
  key: string;
  name: string;
  domain: string;
  industry: string;
  employeeCount: string;
  revenue: string;
  city: string;
  state: string;
  country: string;
  description: string;
  icpNote: string;
  nextActions: string[];
  intent: { topic: string; signalScore: number }[];
  scoops: { publishedDate: string; description: string; type: string }[];
  news: { publishedDate: string; title: string; category: string }[];
  tech: { category: string; product: string; vendor: string }[];
  plays: { category: string; play: string }[];
}

export interface FixtureContact {
  personId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  managementLevel: string;
  email: string;
  phone: string;
  summary: string;
}

export interface FixtureEngagement {
  id: string;
  companyId: string;
  type: "meeting" | "email";
  date: string;
  subject: string;
  participants: string[];
}

export const FIXTURE_COMPANIES: FixtureCompany[] = [
  {
    zoomId: "100000101",
    key: "snowflake",
    name: "Snowflake",
    domain: "snowflake.com",
    industry: "Cloud data platform",
    employeeCount: "7,000+",
    revenue: "$2.8B ARR",
    city: "Bozeman",
    state: "MT",
    country: "United States",
    description:
      "Snowflake is scaling enterprise consumption; intent on data governance and warehouse cost control aligns with a pre-call brief focused on expansion teams.",
    icpNote: "Cloud-native data platform with active intent on analytics infrastructure; headcount is above our core ICP band.",
    nextActions: [
      "Confirm economic buyer on data platform budget",
      "Reference recent scoop on EU region expansion",
      "Multithread into RevOps lead showing intent on CDP",
    ],
    intent: [
      { topic: "Revenue Intelligence", signalScore: 88 },
      { topic: "Customer Data Platform", signalScore: 74 },
      { topic: "Legacy CRM Migration", signalScore: 52 },
    ],
    scoops: [{ publishedDate: "2026-09-12", description: "Opened new EU sovereignty region for enterprise workloads", type: "Facilities Relocation/Expansion" }],
    news: [{ publishedDate: "2026-10-01", title: "Snowflake announces AI governance toolkit for enterprise", category: "PRODUCT" }],
    tech: [
      { category: "Data warehouse", product: "Snowflake", vendor: "Snowflake Inc." },
      { category: "CRM", product: "Salesforce Sales Cloud", vendor: "Salesforce, Inc." },
      { category: "Conversation intelligence", product: "Gong", vendor: "Gong.io" },
    ],
    plays: [
      { category: "Data warehouse", play: "Expand analytics attach" },
      { category: "CRM", play: "Integration-first positioning" },
      { category: "Conversation intelligence", play: "Displacement play on renewal" },
    ],
  },
  {
    zoomId: "100000202",
    key: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    industry: "Fintech / payments",
    employeeCount: "8,000+",
    revenue: "Private",
    city: "San Francisco",
    state: "CA",
    country: "United States",
    description:
      "Stripe shows strong product-led growth signals; inbound triage should weigh payment fraud tooling intent against your ICP for revenue teams.",
    icpNote: "Large engineering org; the GTM tooling budget holder is not yet verified.",
    nextActions: [
      "Validate champion in sales operations",
      "Pull intent on conversation intelligence",
      "Check for prior CRM engagement before outreach",
    ],
    intent: [
      { topic: "Sales Engagement Platform", signalScore: 71 },
      { topic: "Payment Fraud Prevention", signalScore: 90 },
    ],
    scoops: [{ publishedDate: "2026-08-20", description: "Hiring surge in go-to-market operations", type: "Hiring Plans" }],
    news: [{ publishedDate: "2026-09-15", title: "Stripe expands revenue and finance automation suite", category: "PRODUCT" }],
    tech: [
      { category: "CRM", product: "Salesforce Sales Cloud", vendor: "Salesforce, Inc." },
      { category: "Sales engagement", product: "Outreach", vendor: "Outreach Corporation" },
    ],
    plays: [
      { category: "CRM", play: "Integration-first positioning" },
      { category: "Sales engagement", play: "Consolidate intent + sequencing on renewal" },
    ],
  },
  {
    zoomId: "100000303",
    key: "salesforce",
    name: "Salesforce",
    domain: "salesforce.com",
    industry: "CRM / enterprise software",
    employeeCount: "70,000+",
    revenue: "$34B",
    city: "San Francisco",
    state: "CA",
    country: "United States",
    description:
      "Salesforce is a strategic competitive account — frame around displacement angles in sales engagement, not net-new CRM.",
    icpNote: "Low fit as a new logo; high value for competitive intel and partner plays.",
    nextActions: [
      "Lead with integration narrative",
      "Anchor on the named competitor stack instead of generic discovery",
      "Map an executive sponsor",
    ],
    intent: [
      { topic: "Sales Engagement Platform", signalScore: 83 },
      { topic: "CRM Migration", signalScore: 61 },
    ],
    scoops: [{ publishedDate: "2026-07-01", description: "Internal reorg of enterprise GTM leadership", type: "Executive Move" }],
    news: [{ publishedDate: "2026-10-05", title: "Salesforce pushes agentic sales workflows", category: "PRODUCT" }],
    tech: [
      { category: "CRM", product: "Salesforce Sales Cloud", vendor: "Salesforce, Inc." },
      { category: "Collaboration", product: "Slack", vendor: "Salesforce, Inc." },
    ],
    plays: [
      { category: "CRM", play: "Partner, don't displace — sell on top of the incumbent" },
      { category: "Collaboration", play: "Deliver briefs where reps already work" },
    ],
  },
];

export const FIXTURE_CONTACTS: FixtureContact[] = [
  { personId: "200001", companyId: "100000101", firstName: "Morgan", lastName: "Patel", jobTitle: "VP Data Platform", managementLevel: "VP Level Exec", email: "morgan.patel@snowflake.com", phone: "+1 406 555 0101", summary: "Owns the data platform budget and vendor consolidation." },
  { personId: "200002", companyId: "100000101", firstName: "Riley", lastName: "Kim", jobTitle: "Director RevOps", managementLevel: "Director", email: "riley.kim@snowflake.com", phone: "+1 406 555 0102", summary: "Runs revenue operations tooling; sponsored the last pilot." },
  { personId: "200003", companyId: "100000101", firstName: "Sam", lastName: "Ortiz", jobTitle: "Procurement Manager", managementLevel: "Manager", email: "sam.ortiz@snowflake.com", phone: "+1 406 555 0103", summary: "Procurement gate for software over $100k." },
  { personId: "200004", companyId: "100000101", firstName: "Jordan", lastName: "Lee", jobTitle: "Director, Enterprise Data", managementLevel: "Director", email: "jordan.lee@snowflake.com", phone: "+1 406 555 0142", summary: "Owns evaluation of GTM data tools tied to warehouse consumption metrics." },
  { personId: "200005", companyId: "100000202", firstName: "Alex", lastName: "Chen", jobTitle: "Head of Sales Ops", managementLevel: "Director", email: "alex.chen@stripe.com", phone: "+1 415 555 0198", summary: "Operational sponsor for sales tooling pilots." },
  { personId: "200006", companyId: "100000202", firstName: "Taylor", lastName: "Brooks", jobTitle: "Chief Revenue Officer", managementLevel: "C Level Exec", email: "taylor.brooks@stripe.com", phone: "+1 415 555 0199", summary: "Final approver for revenue tooling." },
  { personId: "200007", companyId: "100000303", firstName: "Jamie", lastName: "Fox", jobTitle: "SVP Sales Productivity", managementLevel: "VP Level Exec", email: "jamie.fox@salesforce.com", phone: "+1 415 555 0301", summary: "Leads sales productivity programs." },
  { personId: "200008", companyId: "100000303", firstName: "Casey", lastName: "Wu", jobTitle: "Enterprise Architect", managementLevel: "Director", email: "casey.wu@salesforce.com", phone: "+1 415 555 0302", summary: "Architecture review for any new GTM vendor." },
];

export const FIXTURE_ENGAGEMENTS: FixtureEngagement[] = [
  { id: "eng-1", companyId: "100000101", type: "meeting", date: "2026-10-08", subject: "Pilot readout with RevOps", participants: ["Riley Kim", "Morgan Patel"] },
  { id: "eng-2", companyId: "100000101", type: "email", date: "2026-09-02", subject: "Marketing nurture — governance webinar", participants: ["Jordan Lee"] },
  { id: "eng-3", companyId: "100000202", type: "email", date: "2026-10-03", subject: "Demo deck request", participants: ["Alex Chen"] },
];

export const FIXTURE_GTM_CONTEXT: GtmContextRecord = {
  role: "Account Executive",
  offerings: ["Revenue intelligence platform", "Conversation insights", "Intent-powered audiences", "Sales engagement"],
  personas: ["VP Sales", "RevOps Director", "Sales Development Leader"],
  icp: ["B2B SaaS 200–5000 employees", "US & EU", "Sales-led GTM motion"],
  competitors: ["Salesforce Sales Cloud", "Gong", "Clari"],
};
