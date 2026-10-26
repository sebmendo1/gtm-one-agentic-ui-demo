---
title: "Always-on Go-to-agent (mid-market AE PoC)"
description: Pinned proactive hub chat, four agents, simulated Google sources, deterministic sweeps, hub-and-spoke handoff.
tags:
  - spec
  - agent
  - poc
status: active
updated: 2026-10-24
---
# Always-on Go-to-agent

## Problem and persona

Mid-market AEs run 15–25 external meetings per week and rarely prep in time. Reactive chat only helps when they remember to ask. **Go-to-agent** is a pinned hub that watches connected sources and posts cited work before the AE asks.

**Persona:** Elena Vasquez, mid-market AE at Northwind (revenue intelligence seller; see fixture `gtm_context`). West territory, B2B SaaS accounts of 200–2,000 employees. Q4 goal: three deals in commit; one is there. Self-serve signup. **Google Calendar + Gmail** connect without IT; **Salesforce** requires admin.

## Built for the AE

The whole product speaks to one job: a mid-market AE getting deals to close. Nothing in the chrome is for operators or builders.

- **Book of deals.** Elena's three deals (`PERSONA_DEALS`, spec 05) are the spine of the experience. She confirms them at onboarding (each row has inline Edit for amount and stage), and because Salesforce is locked they are labeled "Self-reported until Salesforce connects" (after the admin invite: "Self-reported · invite sent, waiting on your Salesforce admin"). Edits persist in `workspace.deals`, and the goal count is derived from deals in Commit. Salesforce is only ever the CRM integration; the third deal is Datadog. The work panel's goal card lists each deal with stage, amount and close date under the goal progress. The work panel names the deal behind each piece of work.
- **Language.** Copy talks about deals, meetings, buyers and next steps, not "accounts or tasks" or "GTM jobs". Placeholders: hub "Ask about a deal, a meeting or a buyer…", thread "Ask about this deal, a buyer or your next step…".
- **Hub suggestions** come from her own week, not a fixed list: prep the next external meeting ("Prep me for Snowflake at 10:00 AM"), reply to the oldest unanswered buyer email ("Draft my reply to Alex Chen"), "Which deals need me?", and "Watch {account}" for a deal account that isn't watched yet.
- **"Which deals need me?"** (also "my deals", "pipeline", "my forecast") is a local intent. It lists each deal with stage, amount, close date and next step, and notes what the agent has ready or needs approved for it. It also notes that the deals are self-reported.
- **Threads** open on deal starters instead of a blank page: prep the next meeting, map the committee on the best-case deal, draft the overdue reply, and the why-now case for the pipeline deal.
- **The writer knows who it serves.** Gemini replies are written for Elena: a mid-market AE selling Northwind's revenue intelligence platform, who wants what to say on the next call, who else to bring in, and a dated next step. Setup questions get a short answer that steers back to her deals.
- **Profile row:** initials, name, and "Mid-market AE · Northwind". It has no developer setup link. CLI sign-in stays in the operator docs (spec 06).

## Activation and growth

| Moment | Definition |
|--------|------------|
| **Activation** | User completes a proactive card’s primary action (copy talk track or copy draft) on a card the agent produced unprompted. |
| **Growth — share** | Agent suggests sharing the brief with an internal attendee on the calendar invite (Sam Ortiz, Northwind SE). The share sheet offers one-tap **Email Sam**, **Send in Slack** (both mocked) and **Copy link**; each logs a hub line. `/share#…` is a read-only artifact whose **Start free** opens `/?new=1`, a fresh workspace for that page load (storage keys suffixed `:guest-…`), so the recipient onboards from scratch and the sender's workspace is untouched. |
| **Growth — CRM** | Locked Salesforce source + “Invite your admin” unlocks pipeline-aware Deal Watch (copy only in PoC). After the invite, the sidebar reads "Salesforce · Invite sent, waiting on admin". |
| **Growth — credits** | Credit meter in sidebar with "Used N of your M daily autopilot credits". Every credit-spending lookup (company enrich, signals) costs one data credit: within the daily autopilot budget it runs and is deducted (940 → 936 on the first check-in); over budget, or with autopilot off, the card asks first. Each dispatch states what it spent. Approving paid research in a thread deducts its estimate. |

## Demo clock

Not wall-clock. Default **Mon 2026-10-26 16:30** local. Presenter **Simulate overnight** → **Tue 2026-10-27 07:45**. All triggers evaluate against `demoNow` from client workspace.

## Presenting

- Present from `npm run demo` (production build and server), not `next dev`: no compile pauses and no dev indicator.
- `?demo=1` shows the **Demo** button; Option+D opens presenter controls on any URL. **Replay first run** starts at onboarding, **Reset demo** starts at the hub with the evening cards, and **Simulate overnight** posts the morning signals. **Restart demo**, under Data credits in the sidebar, does the same as Replay first run after a confirm, and needs no `?demo=1`.
- The hub, sweep, onboarding and local intents need no network. Research turns need TypeSafe and Gemini, but each degrades instead of failing (spec 07 § Latency).

## Agents (catalog)

| Agent | Trigger | Job | Paid steps (PoC) |
|-------|---------|-----|------------------|
| Meeting Prep | External calendar event within 24h | `account_brief` | None in sweep (free lookups + template only) |
| Deal Watch | New overnight signal on watched account | `why_now` | None in sweep |
| Follow-up Nudge | Inbound email unanswered >3 days | `draft` | None in sweep |
| Account Map | First calendar sighting of account (once) | `buying_committee` | `contacts_enrich` → **needs_approval** card |

## Specialists and dispatch

Go-to-agent works like a chief of staff: each sweep it checks her sources, hands each job to a small named specialist (the four agents above), and posts **one dispatch message** listing them. Specialists do one job each and break it into small tasks; she is pulled in only for results to act on and paid steps to approve. The pattern follows Grok Build's subagent blocks: a compact lifecycle row per sub-agent in the parent conversation, which opens into that sub-agent's own transcript.

Run states: `running`, `ready`, `needs_approval`, `done`, `snoozed`, `dismissed`.

**Tasks.** The runner breaks every run into 3–5 `AgentTask`s (`src/lib/agents/tasks.ts`) and writes a one-line `summary` ("Drafted a reply to Alex Chen"). A task is a short verb phrase with its source, a detail line, its status (`done`, `empty`, `waiting`, `skipped`), its cost, the ledger ids it produced, and the CLI commands it ran. Every run starts by reading its trigger (Read the thread / Read the meeting / Read the signal), folds id-only company lookups into the task that uses them, and ends with a write task. Account Map, for example, runs: Read the meeting · Find stakeholders · Check who we've engaged · Spot what changed · Map the committee. Paid steps waiting on approval show as `waiting` tasks. Only the run's paid steps show a credit cost. When the approval finishes in the thread, the waiting tasks complete and the summary updates.

**Dispatch message.** A Go-to-agent message (header: avatar, name, sweep time), one sentence on what it checked ("Checked your calendar, inbox and ZoomInfo signals. Three specialists picked up work; one needs you."), then one row per specialist. Runs that share a sweep's demo time form one dispatch.

- **Row:** status mark (red dot = new, hollow dot = seen, amber dot = needs you, green check = done) · 24px agent avatar · agent name · summary · "5 tasks" or amber "Needs you" · chevron. One line on desktop; name over summary on mobile.
- **Open row:** a click expands it in place under a thin guide line: the trigger line in muted text, then the result rendered quietly (no citation chips, "Grounded in" line, widget source rows, Demo data tag, "Not returned" contact rows, or widget buttons that repeat the primary action). Results taller than about 260px clamp with "Show more". Actions in one row: the primary action, **Open thread**, **View N tasks**, the next step as muted text, and Snooze / Not useful icons (undo snackbar). Opening a row marks it seen. A work-panel click opens and highlights the row.
- **needs_approval:** the open row shows the amber approval summary (server-written lead, paid steps, estimate) with **Review and approve**, which opens the thread where the real approval runs. The hub never shows approve buttons that don't spend.
- **done:** green check; the open row offers Share (Meeting Prep) and Open thread.
- **Live:** during a sweep, each specialist appears as a working row (spinner, avatar, name, its current task with a shimmer, "2 of 5") and steps through its tasks about 300ms apart before it lands as a finished row. Before the first specialist starts, a Go-to-agent row reads "Reading your sources…".

**Work view.** **View N tasks** opens a right sheet (520px, full width on mobile) holding the specialist's transcript: a title bar (avatar, name, status · task count · time, close), **Assignment** (Go-to-agent handed this off at 4:30 PM, plus the trigger), **Tasks** as a vertical timeline (status icon, label, detail, source · cost · evidence ids, and each CLI command in mono), and **Result**: the full cited message, with citation chips and source rows. Footer: the primary action and Open thread. This is where the evidence the hub hides lives.

## Hub layout (main chat)

Single column, newest at the bottom, composer pinned below. There is no greeting or summary header: the column opens straight on the agent's messages, and the first day divider dates them. Order inside the column:

1. **Timeline:** day dividers, then dispatch messages (§ Specialists and dispatch) and hub turns interleaved in the order they arrived. Hub turns are the user's own messages (right-aligned bubbles) and agent replies: a reply to the user's message is plain text under the bubble (no header); a message the agent posts on its own (a log line with no prompt) carries the Go-to-agent header. Local intents (`watch X`, `stop watching X`, `what's on today`) and agent log lines ("Now watching Stripe", "Invite sent") are agent replies in this same timeline, so the user's typed text is never dropped.
2. **Working state:** while a sweep runs, its dispatch message shows the live specialist row. Sweep errors show inline with Retry.
3. **Composer:** suggestion chips above it when idle, drawn from her week ("Prep me for Snowflake tomorrow…", "Which deals need me?", …; see § Built for the AE), then the composer and the evidence footnote.

The hub header shows the agent status: a green dot "Active · checked {time}", or an amber pulsing "Working…" during a sweep.

## Work panel (right sidebar, Go-to-agent only)

A 320px right panel summarizing all pending and finished work. It appears only on the Go-to-agent chat, never in threads. Expanded by default from `lg` up, and it collapses to a rail (§ Collapsible sidebars). The header button carries the "Needs you" count; below `lg` it opens a right-side drawer.

| Section | Contents |
|---------|----------|
| **Goal** | Quarter goal and progress (fixture) |
| **Needs you** | Approvals and ready cards not yet acted on, each with the next step ("Review before 10:00 AM", "Reply to Alex Chen", "Approve ~2 data credits") |
| **Up next** | Next external meetings with prep status: Brief ready / Prepping on next check / "Brief preps Thu 2:00 PM, a day ahead" |
| **In progress** | The running sweep step or the hub question being researched; otherwise "Idle · last checked {time}" |
| **Done** | Completed cards and growth milestones (shared, invited) |
| **Watching** | Watched accounts |
| **Setup** | Checklist of milestones (connect, first sweep, act on a brief, share, invite admin) with progress; hidden once complete |

Clicking a card-backed row scrolls the timeline to that card and highlights it briefly; on the drawer it also closes the drawer.

Open heads-ups sit at the top of **Needs you**, marked with a bolt icon. The follow-up the agent committed to when the reply was sent ("Watching for Alex Chen's reply · Bump drafts Wed 9:00 AM if it's quiet") shows under **In progress**.

## Collapsible sidebars

From `md` up, the left sidebar collapses to a 60px rail. The rail keeps the expand toggle, New thread, Go-to-agent with its unread badge, one letter tile per thread, a data-credit ring, Restart demo and the avatar. From `lg` up, the work panel collapses to a 56px rail. That rail keeps the goal ring and one icon per section, with counts (Needs you in red); clicking any rail item expands the panel. Width animates over 300ms; the expanded content keeps its full width while it is revealed, so it slides like a drawer instead of reflowing.

Collapse from the panel's own toggle, the header buttons, or ⌘B / Ctrl+B for the left sidebar. Both choices persist in `gtm-layout-v1`. Below `md` the left sidebar is an overlay, and below `lg` the work panel is a drawer, as before. Both always open expanded.

## Heads-ups (proactive)

Besides the scheduled check-ins, the agent raises **heads-ups** on its own: things it noticed between check-ins, with the reason and a single decision. Each lands as its own Go-to-agent message with a **Heads-up** pill. First comes a short "noticing" beat (a shimmer such as "Looking at who's on tomorrow's Snowflake invite…", 1.4s), then a tinted card. The card shows "Noticed on my own · {source and why now}", the body, and a primary and a secondary action. Once the AE decides, the actions collapse into one confirmation line. Away from the hub, a heads-up also shows a top toast ("Heads-up from Go-to-agent. …" with View) and counts in the Go-to-agent badge.

| Heads-up | Raised when | Primary action |
|----------|-------------|----------------|
| **Loop in your SE** | 4s after the evening check-in goes quiet: the Snowflake brief is ready, Sam Ortiz is on the invite, and nothing has been shared | Share brief with Sam (opens the share sheet; resolves once sent by email, Slack or link) |
| **Before your meeting** | 4s after the morning check-in goes quiet | Open the brief: focuses the Snowflake brief, which now leads with the overnight intent spike |

Each heads-up fires once per workspace. Idle heads-ups wait while a sweep or a research turn runs. Presenter controls add **Send a heads-up now**, which fires the next eligible one without the wait.

## Activation: Approve & send

The Alex Chen reply is the activation moment. Its card shows the draft, then attachment chips for what the draft promises (**Northwind demo deck.pdf** 4.2 MB, **Pilot one-pager.pdf** 310 KB). The primary action is **Approve & send** (paper-plane icon); **Copy draft** is secondary. Sending is simulated and nothing leaves the browser.

On send, the card turns into a green confirmation: "Sent to Alex Chen · 4:30 PM. From your Gmail, with 2 attachments. I'll watch for a reply and draft a bump Wed 9:00 AM if it's quiet." A toast says "Sent to Alex Chen". The item moves to **Done** ("Reply sent to Alex Chen · Sent Mon 4:30 PM"), and **In progress** gains "Watching for Alex Chen's reply · Bump drafts Wed 9:00 AM if it's quiet". The Connect step says up front that nothing sends without her OK.

The contact card's **Draft email** never appears on a message that already is a draft, or on agent cards, so it can't contradict the reply.

## While you were away

The morning check-in posts as a Go-to-agent message with a **While you were away** pill: "Overnight I kept an eye on the accounts you watch. Two signals came in from ZoomInfo." Each Deal Watch signal is its own card:

- **Header:** "ZoomInfo signal · 3:40 AM".
- **Body:** "Snowflake · Intent spike on Revenue Intelligence (88 → 91)", then what it means: "That lines up with your expansion pitch. I added it to your brief for today at 10:00 AM." For a meeting more than a day out, the promise is future tense: "I'll work it into your brief for Fri 2:00 PM."
- **Actions:** **Add to talk track** (the card settles to "Added to your Snowflake talk track" and moves to Done), **Dismiss**, and **View N tasks**.

The overnight jump is reachable without presenter controls. Once the evening check-in is in and the hub is idle, the timeline ends with "I'll check again at 7:00 AM · **See tomorrow morning**".

## Counts, dates and labels

- **One badge count.** The header's Agent work badge, the sidebar's Go-to-agent badge and the rail all show `needsYouCount`: ready or approval cards plus open heads-ups.
- **Dispatch sentence.** While specialists land, the sentence stays "Checking your calendar, inbox and accounts, and handing the work to specialists." The final count is stated once the check-in finishes.
- **Dates.** Dates render as "Oct 3" (`humanDate`), never ISO. The follow-up trigger reads "Alex Chen at Stripe emailed Oct 3, 23 days ago — still no reply". Up next labels prep times explicitly ("Brief preps Thu 2:00 PM, a day ahead"); the Stripe call is Fri 2:00 PM everywhere.
- **Contact rows.** Rows without a value ("Not returned") are omitted, never shown with no action.
- **Developer labels.** "Written by Gemini…", "Demo fixtures", "Demo data" and the fixture-emulator coverage line are hidden by default. `?debug=1` shows them for the tab and `?debug=0` hides them again.

## Task drawer

Each task leads with what it did and where: "Read Alex Chen's thread in Gmail", "Looked up Alex Chen in ZoomInfo", "Drafted the reply from the thread and history". Under it come the result, then a confidence line from a fixed rule, then the cost ("1 data credit" or "Free"):

| Task | Confidence line |
|------|-----------------|
| Read of her own Gmail or calendar | "Direct from your Gmail" / "Direct from your calendar" |
| ZoomInfo result backed by two or more records | "High confidence · N sources" |
| ZoomInfo result backed by one record | "Confirmed · 1 source" |
| The write-up | "Based on N findings above" |
| Empty or waiting | "Nothing on record" / "Waiting on your approval" |

Raw `gtm …` commands and evidence ids sit behind a collapsed **Show technical details** toggle.

## Setup checklist

Every incomplete Setup item is clickable and goes to the action that completes it:

- **First check-in:** runs the check-in now.
- **Act on a brief:** focuses the Alex Chen reply.
- **Share with a teammate:** opens the share sheet on the Snowflake brief.
- **Invite your Salesforce admin:** sends the invite.

## Hub and spoke

- **Hub (main chat):** sidebar “Go-to-agent” is the primary conversation (see Hub layout).
- **Threads (sub-chats):** nested under Go-to-agent in the sidebar; one account or task per thread. **Open thread** on a card opens its thread, creating it the first time and reusing it after that; origin chip shown in the thread.
- **Spoke → hub:** “Watch {account}?” adds watchlist + an agent reply in the hub timeline.
- **Paid approval on card:** resumes via existing `/api/generate` approval path inside the thread.
- **Reset demo** clears the workspace, the hub timeline, and all threads, then returns to Monday evening with onboarding done. **Replay first run** clears the same and starts at onboarding.

## First run

Full-screen split layout, no numbered stepper. The left column holds the brand mark, a segmented progress bar (four short bars; the current one is wider; announced as "Step n of 4"), and one vertically centered step: a two-tone heading (statement, then a muted line), the step's controls, and Back / Continue in one row. From `lg` up the right panel is a live preview of "Your Go-to-agent" that fills in as she answers, so each step visibly gives the agent something:

| Step | Heading | Controls | Preview row it fills |
|------|---------|----------|----------------------|
| 1 | Welcome, Elena. / Confirm the deals you're working this quarter. | Her three deals in one list (amount · stage · close date) with inline Edit (amount, stage), the Q4 goal, and the note "From your signup answers. Edit anything that's off; Salesforce replaces this list once your admin connects it." | Deals: "3 open · $252k pipeline" |
| 2 | Connect your day. / I read your calendar and inbox. Nothing sends without your OK. | Google Workspace row with Connect (simulated); the primary button reads **Connect Google** until connected. Salesforce is a dashed, locked row | Meetings and Inbox ("Alex Chen waiting 23 days for a reply") |
| 3 | Choose accounts to watch. / I'll post buying signals for these overnight. | Selectable account rows (stage · next meeting) with a checkbox; Continue needs at least one | Watching |
| 4 | Set your autopilot. / What I can spend without asking. | A switch for data-credit autopilot and a daily limit slider (1–25); AI research always asks | Autopilot |

**Start Go-to-agent** completes setup and streams the first sweep into the hub.

**Motion.** Every beat confirms what the agent just learned. All of it uses the `gtm-*` utilities in `globals.css` and switches off under reduced motion, where the timed phases also run instantly.

- **Steps** slide in from the direction of travel. The heading, subtitle and body follow 70ms apart, and the current progress segment fills from the left.
- **Deals:** the pipeline total counts up, and a stage bar (commit, best case, pipeline) grows in segment by segment.
- **Connect:** the primary button shows "Connecting…" and is disabled. Calendar reads first ("Reading this week…", then "3 customer meetings this week") and Gmail second ("Looking for slow replies…", then "1 buyer waiting 23 days"). Each scope ticks from a spinner to a popped check. The Google card then turns green with a "Connected" badge.
- **Accounts:** the tile of a watched account inverts and gains an eye badge, and the watched count pops.
- **Autopilot:** a 25-bar credit meter lights up to the limit as the slider moves; turning the switch off collapses the limit.
- **Preview:** a row shows a shimmer while its data is loading. When the data lands, the row flashes green, its icon pops a check, and its detail expands (stage legend, meeting list, waiting reply, account chips, credit bar). The "n of 5 set" counter pops.
- **Launch (about 2.1s):** the heading becomes "You're all set." and a checklist of the four setup results ticks in 260ms apart, then "Handing your first jobs to specialists…" shows. The progress bar turns green, the preview card lifts, and its rows flash in turn. Then the hub opens.

## Sweep API

`POST /api/agents/sweep` — body `{ now, watchlist, connections, budget, seenRunKeys }`. NDJSON `{ type: "agent_run", run }` then `{ type: "done" }`. Deterministic for fixed `now`. **No Gemini, no TypeSafe** on sweep path.

## Walkthrough (Ryan)

1. Frame AE + Google (not CRM).  
2. First run &lt;2 min: confirm (or edit) deals, simulated Google connect, choose accounts, budget, streamed sweep (credits 940 → 936).  
3. Pause: the agent raises "Sam hasn't seen tomorrow's Snowflake brief" unprompted. **Approve & send** the Alex Chen reply (activation), then **Email Sam** the brief (growth).  
4. Open the shared brief and click **Start free**: fresh onboarding in its own workspace.  
5. Back in the hub: invite the Salesforce admin, then **See tomorrow morning** for the "While you were away" signals and the pre-meeting heads-up.  
6. **Restart demo** from the sidebar.

## Acceptance

- Sweep produces expected cards at Tue 07:45 with keys unset.  
- Citations resolve to ledger ids.  
- No paid step without approval/budget; AI credits always ask in harness.  
- Email/calendar bodies fenced as untrusted if ever sent to a model.  
- Hub matches Figma frame `1313:1551` (sidebar pin, GTM One, recents).
