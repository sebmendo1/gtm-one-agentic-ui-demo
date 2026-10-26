"use client";

import { Button, Checkbox, CircularProgress, Slider, Switch } from "@mui/material";
import { BoltIcon, BriefcaseIcon, CalendarIcon, EnvelopeIcon, EyeIcon, LockClosedIcon, PencilIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, CheckIcon } from "@heroicons/react/20/solid";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CALENDAR_EVENTS,
  DEFAULT_WATCHLIST,
  DEMO_START_MS,
  INBOX_THREADS,
  PERSONA_DEALS,
  PERSONA_GOAL,
  PERSONA_PROFILE,
  accountLabel,
  type DealStage,
  type PersonaDeal,
} from "@/lib/agents/fixtures";
import { formatDayTime } from "@/lib/agents/time";
import type { WorkspaceBudget } from "@/lib/agents/types";
import { dealFor, formatAmount, formatCloseDate } from "@/lib/agents/work";
import { AgentAvatar } from "./AgentAvatar";

const FIRST_NAME = PERSONA_PROFILE.name.split(" ")[0];

const STEPS = [
  { title: `Welcome, ${FIRST_NAME}.`, subtitle: "Confirm the deals you're working this quarter." },
  { title: "Connect your day.", subtitle: "I read your calendar and inbox. Nothing sends without your OK." },
  { title: "Choose accounts to watch.", subtitle: "I'll post buying signals for these overnight." },
  { title: "Set your autopilot.", subtitle: "What I can spend without asking." },
];

const MEETINGS = CALENDAR_EVENTS.filter((e) => e.external).sort((a, b) => a.startMs - b.startMs);
const ACCOUNTS = [...new Set([...MEETINGS.map((e) => e.accountKey).filter((k): k is string => !!k), ...DEFAULT_WATCHLIST])];
const WAITING = INBOX_THREADS.filter((t) => t.unanswered);
const WAITING_DAYS = WAITING[0] ? Math.floor((DEMO_START_MS - WAITING[0].receivedMs) / 86_400_000) : 0;
const MAX_CREDITS = 25;

const STAGE_ORDER: DealStage[] = ["Commit", "Best case", "Pipeline"];

function pipelineOf(deals: PersonaDeal[]): number {
  return deals.reduce((sum, d) => sum + d.amount, 0);
}
const STAGE_BAR: Record<DealStage, string> = {
  Commit: "bg-gtm-success",
  "Best case": "bg-gtm-warning",
  Pipeline: "bg-gtm-muted/50",
};

/** Google connect plays out as two reads, so each source visibly lands before the next starts. */
type ConnectPhase = "idle" | "calendar" | "inbox" | "done";
const CALENDAR_MS = 900;
const INBOX_MS = 1700;
const LAUNCH_MS = 2100;

function delay(ms: number): CSSProperties {
  return { "--gtm-delay": `${ms}ms` } as CSSProperties;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Eases a number up from zero once `run` turns on. */
function useCountUp(target: number, run = true, ms = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = prefersReducedMotion() ? 1 : Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, run, ms]);
  return run ? value : 0;
}

function useTimers() {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);
  return (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, prefersReducedMotion() ? 0 : ms));
  };
}

export function Onboarding({
  onComplete,
}: {
  onComplete: (input: { watchlist: string[]; budget: WorkspaceBudget; deals: PersonaDeal[] }) => void;
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "back">("next");
  const [phase, setPhase] = useState<ConnectPhase>("idle");
  const [launching, setLaunching] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [deals, setDeals] = useState<PersonaDeal[]>(PERSONA_DEALS);
  const [budget, setBudget] = useState<WorkspaceBudget>({ dataCreditsPerDay: 10, allowDataAutopilot: true });
  const later = useTimers();

  const connected = phase === "done";
  const connecting = phase === "calendar" || phase === "inbox";
  const last = step === STEPS.length - 1;

  const go = (to: number) => {
    setDir(to > step ? "next" : "back");
    setStep(to);
  };

  const connect = () => {
    if (phase !== "idle") return;
    setPhase("calendar");
    later(CALENDAR_MS, () => setPhase("inbox"));
    later(INBOX_MS, () => setPhase("done"));
  };

  const launch = () => {
    setDir("next");
    setLaunching(true);
    later(LAUNCH_MS, () => onComplete({ watchlist, budget, deals }));
  };

  const toggleAccount = (key: string) => {
    setWatchlist((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const primary = () => {
    if (step === 1 && !connected) connect();
    else if (last) launch();
    else go(step + 1);
  };

  const slide = dir === "next" ? "gtm-slide-next" : "gtm-slide-back";
  const title = launching ? "You're all set." : STEPS[step].title;
  const subtitle = launching ? "Starting your first check-in…" : STEPS[step].subtitle;

  return (
    <div className="flex min-h-0 w-full flex-1">
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm font-medium text-gtm-text">
            <AgentAvatar size={24} pulse={connecting || launching} />
            Go-to-agent
          </span>
          <Progress step={step} total={STEPS.length} done={launching} />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div key={launching ? "launch" : step}>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance text-gtm-text">
              <span className={`block ${slide}`}>{title}</span>
              <span className={`block text-gtm-muted ${slide}`} style={delay(70)}>
                {subtitle}
              </span>
            </h1>

            <div className={`mt-7 ${slide}`} style={delay(140)}>
              {launching ? (
                <LaunchList watchlist={watchlist} budget={budget} deals={deals} />
              ) : (
                <>
                  {step === 0 && <DealsStep deals={deals} onChange={setDeals} />}
                  {step === 1 && <ConnectStep phase={phase} onConnect={connect} />}
                  {step === 2 && <AccountsStep watchlist={watchlist} onToggle={toggleAccount} />}
                  {step === 3 && <AutopilotStep budget={budget} onChange={setBudget} />}
                </>
              )}
            </div>
          </div>

          {!launching && (
            <div className="mt-8 flex items-center gap-2">
              {step > 0 && (
                <Button color="inherit" className="text-gtm-secondary" onClick={() => go(step - 1)}>
                  Back
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                className="ml-auto min-w-36"
                disabled={connecting || (step === 2 && watchlist.length === 0)}
                startIcon={connecting ? <CircularProgress size={14} color="inherit" /> : undefined}
                onClick={primary}
              >
                {connecting ? "Connecting…" : step === 1 && !connected ? "Connect Google" : last ? "Start Go-to-agent" : "Continue"}
              </Button>
            </div>
          )}
        </div>
      </section>

      <aside className="hidden w-[44%] max-w-xl shrink-0 flex-col justify-center border-l border-gtm-border bg-gtm-bg-secondary px-10 lg:flex">
        <Preview step={step} phase={phase} launching={launching} watchlist={watchlist} budget={budget} deals={deals} />
      </aside>
    </div>
  );
}

function Progress({ step, total, done }: { step: number; total: number; done: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={done ? total : step + 1}
      aria-valuetext={done ? "Setup complete" : `Step ${step + 1} of ${total}`}
      className="flex items-center gap-1"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`relative h-1 overflow-hidden rounded-full bg-gtm-border transition-[width] duration-500 ease-out motion-reduce:transition-none ${i === step && !done ? "w-8" : "w-4"}`}
        >
          <span
            className={`absolute inset-0 origin-left rounded-full transition-[transform,background-color] duration-500 ease-out motion-reduce:transition-none ${done ? "bg-gtm-success" : "bg-gtm-text"} ${i <= step || done ? "scale-x-100" : "scale-x-0"}`}
            style={{ transitionDelay: done ? `${i * 90}ms` : undefined }}
          />
        </span>
      ))}
    </div>
  );
}

function StageBar({ deals, height = "h-1.5", start = 0 }: { deals: PersonaDeal[]; height?: string; start?: number }) {
  return (
    <div className={`flex w-full gap-0.5 overflow-hidden rounded-full ${height}`} aria-hidden>
      {STAGE_ORDER.map((stage, i) => {
        const amount = deals.filter((d) => d.stage === stage).reduce((s, d) => s + d.amount, 0);
        return <span key={stage} className={`gtm-grow-x ${STAGE_BAR[stage]}`} style={{ ...delay(start + i * 120), flexGrow: amount }} />;
      })}
    </div>
  );
}

function DealEditor({ deal, onSave }: { deal: PersonaDeal; onSave: (deal: PersonaDeal) => void }) {
  const [amount, setAmount] = useState(String(Math.round(deal.amount / 1000)));
  const [stage, setStage] = useState<DealStage>(deal.stage);
  const save = () => onSave({ ...deal, stage, amount: Math.max(1, Number(amount) || 0) * 1000 });
  return (
    <form
      className="gtm-enter flex flex-wrap items-center gap-2 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <span className="w-full text-sm font-medium text-gtm-text">{deal.name}</span>
      <label className="flex h-8 items-center gap-1 rounded-gtm border border-gtm-border bg-gtm-bg px-2 text-sm focus-within:border-gtm-text">
        <span className="text-gtm-muted">$</span>
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`${deal.name} amount in thousands`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
          className="w-12 bg-transparent text-gtm-text tabular-nums outline-none"
        />
        <span className="text-gtm-muted">k</span>
      </label>
      <span className="flex gap-1" role="radiogroup" aria-label={`${deal.name} stage`}>
        {STAGE_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={stage === s}
            onClick={() => setStage(s)}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-meta font-medium transition-colors ${
              stage === s ? "border-gtm-text bg-gtm-text text-gtm-bg" : "border-gtm-border text-gtm-secondary hover:bg-gtm-hover"
            }`}
          >
            <span className={`size-1.5 rounded-full ${STAGE_BAR[s]}`} aria-hidden />
            {s}
          </button>
        ))}
      </span>
      <Button type="submit" size="small" variant="contained" color="primary" className="ml-auto">
        Save
      </Button>
    </form>
  );
}

function DealsStep({ deals, onChange }: { deals: PersonaDeal[]; onChange: (deals: PersonaDeal[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const total = pipelineOf(deals);
  const pipeline = useCountUp(total / 1000);
  const committed = deals.filter((d) => d.stage === "Commit").length;
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-gtm-text tabular-nums">
            <span aria-hidden>{`$${pipeline}k`}</span>
            <span className="sr-only">{formatAmount(total)}</span>
          </p>
          <p className="text-meta text-gtm-muted">open pipeline</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-tight text-gtm-text tabular-nums">
            {committed}
            <span className="text-gtm-muted"> / {PERSONA_GOAL.target}</span>
          </p>
          <p className="text-meta text-gtm-muted">in commit for {PERSONA_GOAL.quarterLabel}</p>
        </div>
      </div>
      <StageBar deals={deals} start={250} />
      <ul className="mt-4 divide-y divide-gtm-border rounded-gtm-xl border border-gtm-border bg-gtm-surface" aria-label="Deals you're working">
        {deals.map((deal, i) =>
          editing === deal.accountKey ? (
            <li key={deal.accountKey}>
              <DealEditor
                deal={deal}
                onSave={(next) => {
                  onChange(deals.map((d) => (d.accountKey === next.accountKey ? next : d)));
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={deal.accountKey} className="gtm-slide-next group flex items-center gap-3 py-2 pr-2 pl-4 text-sm" style={delay(220 + i * 80)}>
              <span className={`size-2 shrink-0 rounded-full ${STAGE_BAR[deal.stage]}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium text-gtm-text">{deal.name}</span>
              <span className="shrink-0 text-meta text-gtm-muted tabular-nums">
                {formatAmount(deal.amount)} · {deal.stage} · {formatCloseDate(deal.closeMs)}
              </span>
              <button
                type="button"
                aria-label={`Edit ${deal.name}`}
                onClick={() => setEditing(deal.accountKey)}
                className="flex size-8 shrink-0 items-center justify-center rounded-gtm text-gtm-muted transition-colors hover:bg-gtm-hover hover:text-gtm-text"
              >
                <PencilIcon className="size-4" />
              </button>
            </li>
          ),
        )}
      </ul>
      <p className="gtm-enter mt-3 text-meta text-pretty text-gtm-muted" style={delay(520)}>
        From your signup answers. Edit anything that&apos;s off; Salesforce replaces this list once your admin connects it.
      </p>
    </div>
  );
}

type Tick = "pending" | "working" | "done";

function TickMark({ state }: { state: Tick }) {
  if (state === "working") {
    return (
      <span className="flex size-4 items-center justify-center text-gtm-muted">
        <CircularProgress size={12} thickness={6} color="inherit" aria-label="Working" />
      </span>
    );
  }
  if (state === "done") {
    return (
      <span className="gtm-pop flex size-4 items-center justify-center rounded-full bg-gtm-success text-white">
        <CheckIcon className="size-3" aria-label="Done" />
      </span>
    );
  }
  return <span className="m-1 size-2 rounded-full border border-gtm-border" aria-hidden />;
}

function ScopeRow({ state, label, detail, working }: { state: Tick; label: string; detail: string; working: string }) {
  return (
    <li className="flex items-center gap-2.5 text-meta">
      <TickMark state={state} />
      <span className="font-medium text-gtm-text">{label}</span>
      <span key={state} className={state === "working" ? "gtm-shimmer" : state === "done" ? "gtm-enter text-gtm-secondary" : "text-gtm-muted"}>
        {state === "working" ? working : state === "done" ? detail : "Waiting"}
      </span>
    </li>
  );
}

function ConnectStep({ phase, onConnect }: { phase: ConnectPhase; onConnect: () => void }) {
  const connected = phase === "done";
  const calendar: Tick = phase === "calendar" ? "working" : phase === "idle" ? "pending" : "done";
  const inbox: Tick = phase === "inbox" ? "working" : phase === "done" ? "done" : "pending";
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`rounded-gtm-xl border bg-gtm-surface px-4 py-3 transition-[border-color,box-shadow] duration-500 ${connected ? "border-gtm-success/50 shadow-[0_0_0_3px_color-mix(in_srgb,var(--gtm-success)_12%,transparent)]" : "border-gtm-border"}`}
      >
        <div className="flex items-center gap-3">
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-gtm bg-gtm-bg-secondary text-sm font-semibold text-gtm-text" aria-hidden>
            G
            {connected && (
              <span className="gtm-pop absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-gtm-success text-white ring-2 ring-gtm-surface">
                <CheckIcon className="size-3" />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gtm-text">Google Workspace</p>
            <p className="text-meta text-gtm-muted">Customer meetings and buyer email</p>
          </div>
          {connected ? (
            <span className="gtm-pop flex items-center gap-1 text-meta font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircleIcon className="size-4" aria-hidden />
              Connected
            </span>
          ) : phase === "idle" ? (
            <Button variant="outlined" color="inherit" size="small" className="border-gtm-border text-gtm-text" onClick={onConnect}>
              Connect
            </Button>
          ) : (
            <span className="gtm-shimmer text-meta font-medium">Connecting…</span>
          )}
        </div>
        <div className={`grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${phase === "idle" ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
          <div className="overflow-hidden">
            <ul className="mt-3 flex flex-col gap-2 border-t border-gtm-border pt-3" aria-live="polite">
              <ScopeRow
                state={calendar}
                label="Calendar"
                working="Reading this week…"
                detail={`${MEETINGS.length} customer meetings this week`}
              />
              <ScopeRow
                state={inbox}
                label="Gmail"
                working="Looking for slow replies…"
                detail={`${WAITING.length} buyer waiting ${WAITING_DAYS} days`}
              />
            </ul>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-gtm-xl border border-dashed border-gtm-border px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-gtm text-gtm-muted" aria-hidden>
          <LockClosedIcon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gtm-secondary">Salesforce</p>
          <p className="text-meta text-gtm-muted">Your CRM admin can connect it later</p>
        </div>
      </div>
      <p className="mt-1 text-meta text-gtm-muted">This demo uses a sample calendar and inbox, not your real account.</p>
    </div>
  );
}

function AccountsStep({ watchlist, onToggle }: { watchlist: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {ACCOUNTS.map((key, i) => {
        const deal = dealFor(accountLabel(key));
        const meeting = MEETINGS.find((e) => e.accountKey === key);
        const on = watchlist.includes(key);
        return (
          <label
            key={key}
            style={delay(180 + i * 80)}
            className={`gtm-slide-next flex cursor-pointer items-center gap-3 rounded-gtm-xl border px-4 py-2.5 transition-[border-color,background-color,transform] duration-200 active:scale-[0.99] ${on ? "border-gtm-text/40 bg-gtm-surface" : "border-gtm-border hover:bg-gtm-surface"}`}
          >
            <span
              className={`relative flex size-8 shrink-0 items-center justify-center rounded-gtm text-sm font-semibold transition-colors duration-300 ${on ? "bg-gtm-text text-gtm-bg" : "bg-gtm-bg-secondary text-gtm-secondary"}`}
              aria-hidden
            >
              {accountLabel(key)[0]}
              {on && (
                <span className="gtm-pop absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-gtm-surface text-gtm-text ring-1 ring-gtm-border">
                  <EyeIcon className="size-2.5" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gtm-text">{accountLabel(key)}</span>
              <span className="block truncate text-meta text-gtm-muted">
                {[deal && `${deal.stage} deal`, meeting && `meeting ${formatDayTime(meeting.startMs)}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Checkbox checked={on} onChange={() => onToggle(key)} edge="end" />
          </label>
        );
      })}
      <p className="mt-1 text-meta text-gtm-muted" aria-live="polite">
        <span key={watchlist.length} className="gtm-pop inline-block font-medium text-gtm-text tabular-nums">
          {watchlist.length}
        </span>{" "}
        {watchlist.length === 1 ? "account" : "accounts"} watched. Signals land in your hub each morning.
      </p>
    </div>
  );
}

function CreditMeter({ value, on }: { value: number; on: boolean }) {
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden>
      {Array.from({ length: MAX_CREDITS }, (_, i) => {
        const lit = on && i < value;
        return (
          <span
            key={i}
            className={`gtm-enter w-full rounded-sm transition-[height,background-color] duration-300 ease-out motion-reduce:transition-none ${lit ? "h-5 bg-gtm-text" : "h-2 bg-gtm-border"}`}
            style={{ ...delay(200 + i * 18), transitionDelay: `${i * 8}ms` }}
          />
        );
      })}
    </div>
  );
}

function AutopilotStep({ budget, onChange }: { budget: WorkspaceBudget; onChange: (fn: (b: WorkspaceBudget) => WorkspaceBudget) => void }) {
  const on = budget.allowDataAutopilot;
  return (
    <div className="rounded-gtm-xl border border-gtm-border bg-gtm-surface px-4 py-3">
      <label className="flex cursor-pointer items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gtm-text">Spend data credits without asking</span>
          <span className="block text-meta text-gtm-muted">Contact and company lookups. AI research always asks.</span>
        </span>
        <Switch checked={on} onChange={(e) => onChange((b) => ({ ...b, allowDataAutopilot: e.target.checked }))} edge="end" />
      </label>
      <div className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out motion-reduce:transition-none ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="mt-4 border-t border-gtm-border pt-4">
            <p className="flex items-baseline justify-between text-meta text-gtm-secondary">
              <span id="credit-cap">Daily limit</span>
              <span className="font-medium text-gtm-text tabular-nums">
                <span key={budget.dataCreditsPerDay} className="gtm-pop inline-block">
                  {budget.dataCreditsPerDay}
                </span>{" "}
                of {MAX_CREDITS} credits
              </span>
            </p>
            <div className="mt-3">
              <CreditMeter value={budget.dataCreditsPerDay} on={on} />
            </div>
            <Slider
              aria-labelledby="credit-cap"
              value={budget.dataCreditsPerDay}
              min={1}
              max={MAX_CREDITS}
              step={1}
              disabled={!on}
              onChange={(_, v) => onChange((b) => ({ ...b, dataCreditsPerDay: v as number }))}
            />
          </div>
        </div>
      </div>
      {!on && <p className="gtm-enter mt-3 text-meta text-gtm-muted">I&apos;ll ask before every lookup that costs credits.</p>}
    </div>
  );
}

/** The closing beat: each answer checks off in order, then the hub takes over. */
function LaunchList({ watchlist, budget, deals }: { watchlist: string[]; budget: WorkspaceBudget; deals: PersonaDeal[] }) {
  const items = [
    `${deals.length} deals confirmed · ${formatAmount(pipelineOf(deals))} pipeline`,
    `Google connected · ${MEETINGS.length} meetings, ${WAITING.length} reply waiting`,
    `Watching ${watchlist.map(accountLabel).join(", ")}`,
    budget.allowDataAutopilot ? `Autopilot up to ${budget.dataCreditsPerDay} data credits a day` : "Autopilot off · I'll ask before spending",
  ];
  return (
    <div>
      <ul className="flex flex-col gap-3" aria-live="polite">
        {items.map((item, i) => (
          <li key={item} className="gtm-slide-next flex items-center gap-3 text-sm text-gtm-text" style={delay(200 + i * 260)}>
            <span className="gtm-pop flex size-5 shrink-0 items-center justify-center rounded-full bg-gtm-success text-white" style={delay(260 + i * 260)}>
              <CheckIcon className="size-3.5" aria-hidden />
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="gtm-enter mt-7" style={delay(1250)}>
        <div className="h-1 overflow-hidden rounded-full bg-gtm-border">
          <span className="gtm-grow-x block h-full rounded-full bg-gtm-text" style={{ ...delay(1250), animationDuration: "800ms" }} />
        </div>
        <p className="gtm-shimmer mt-2 text-meta">Handing your first jobs to specialists…</p>
      </div>
    </div>
  );
}

type RowState = "pending" | "active" | "working" | "ready";

/** A live sketch of the hub that fills in as each step is answered. */
function Preview({
  step,
  phase,
  launching,
  watchlist,
  budget,
  deals,
}: {
  step: number;
  phase: ConnectPhase;
  launching: boolean;
  watchlist: string[];
  budget: WorkspaceBudget;
  deals: PersonaDeal[];
}) {
  const pipeline = useCountUp(pipelineOf(deals) / 1000);
  const meetingsCount = useCountUp(MEETINGS.length, phase === "inbox" || phase === "done", 500);
  const waiting = WAITING[0];

  const stateOf = (ready: boolean, activeStep: number, working = false): RowState =>
    ready ? "ready" : working ? "working" : step === activeStep ? "active" : "pending";

  const rows: { key: string; icon: ReactNode; label: string; state: RowState; placeholder: string; working?: string; summary: ReactNode; detail?: ReactNode }[] = [
    {
      key: "deals",
      icon: <BriefcaseIcon />,
      label: "Deals",
      state: "ready",
      placeholder: "",
      summary: (
        <>
          {deals.length} open ·{" "}
          <span className="tabular-nums" aria-hidden>
            {`$${pipeline}k`}
          </span>
          <span className="sr-only">{formatAmount(pipelineOf(deals))}</span> pipeline
        </>
      ),
      detail: (
        <div className="pt-2">
          <StageBar deals={deals} height="h-1" start={200} />
          <p className="mt-1.5 flex gap-3 text-caption text-gtm-muted">
            {STAGE_ORDER.map((stage) => (
              <span key={stage} className="flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${STAGE_BAR[stage]}`} aria-hidden />
                {stage}
              </span>
            ))}
          </p>
        </div>
      ),
    },
    {
      key: "meetings",
      icon: <CalendarIcon />,
      label: "Meetings",
      state: stateOf(phase === "inbox" || phase === "done", 1, phase === "calendar"),
      placeholder: "Connect Google to prep meetings",
      working: "Reading your calendar…",
      summary: (
        <>
          <span className="tabular-nums" aria-hidden>
            {meetingsCount}
          </span>
          <span className="sr-only">{MEETINGS.length}</span> customer meetings this week
        </>
      ),
      detail: (
        <ul className="flex flex-col gap-1 pt-2">
          {MEETINGS.map((m, i) => (
            <li key={m.id} className="gtm-slide-next flex items-center gap-2 text-meta text-gtm-secondary" style={delay(120 + i * 110)}>
              <span className="size-1 rounded-full bg-gtm-muted" aria-hidden />
              <span className="font-medium text-gtm-text">{accountLabel(m.accountKey ?? "")}</span>
              <span className="text-gtm-muted">{formatDayTime(m.startMs)}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: "inbox",
      icon: <EnvelopeIcon />,
      label: "Inbox",
      state: stateOf(phase === "done" && !!waiting, 1, phase === "inbox"),
      placeholder: "Connect Google to catch slow replies",
      working: "Looking for slow replies…",
      summary: `${waiting?.fromName} waiting ${WAITING_DAYS} days for a reply`,
      detail: waiting && (
        <p className="gtm-slide-next truncate pt-1 text-meta text-gtm-muted" style={delay(140)}>
          “{waiting.subject}” · I&apos;ll draft it tonight
        </p>
      ),
    },
    {
      key: "watching",
      icon: <EyeIcon />,
      label: "Watching",
      state: stateOf(step >= 2 && watchlist.length > 0, 2),
      placeholder: "Choose accounts to watch",
      summary: `${watchlist.length} ${watchlist.length === 1 ? "account" : "accounts"}, checked every morning`,
      detail: (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {watchlist.map((key, i) => (
            <span
              key={key}
              className="gtm-pop inline-flex h-6 items-center gap-1 rounded-full border border-gtm-border bg-gtm-bg px-2 text-caption font-medium text-gtm-text"
              style={delay(i * 70)}
            >
              <span className="size-1.5 rounded-full bg-gtm-emphasis" aria-hidden />
              {accountLabel(key)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "autopilot",
      icon: <BoltIcon />,
      label: "Autopilot",
      state: stateOf(step >= 3, 3),
      placeholder: "Set what I can spend",
      summary: budget.allowDataAutopilot ? `Up to ${budget.dataCreditsPerDay} data credits a day` : "Asks before every spend",
      detail: (
        <div className="pt-2">
          <div className="h-1 overflow-hidden rounded-full bg-gtm-border">
            <span
              className="gtm-grow-x block h-full rounded-full bg-gtm-text transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${budget.allowDataAutopilot ? (budget.dataCreditsPerDay / MAX_CREDITS) * 100 : 0}%` }}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div aria-label="Preview of your Go-to-agent">
      <p className="text-caption font-medium tracking-wide text-gtm-muted uppercase">Your Go-to-agent</p>
      <div
        className={`mt-3 rounded-gtm-xl border bg-gtm-surface p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-500 ease-out ${launching ? "-translate-y-1 border-gtm-success/50 shadow-lg" : "border-gtm-border"}`}
      >
        <div className="flex items-center gap-3">
          <span className="relative">
            <AgentAvatar size={32} pulse={phase === "calendar" || phase === "inbox" || launching} />
            {launching && (
              <span className="gtm-pop absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-gtm-success text-white ring-2 ring-gtm-surface" style={delay(1300)}>
                <CheckIcon className="size-3" aria-hidden />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p key={launching ? "ready" : "setup"} className="gtm-enter text-sm font-medium text-gtm-text">
              {launching ? `Ready for ${FIRST_NAME}` : `Working for ${FIRST_NAME}`}
            </p>
            <p className="text-meta text-gtm-muted">
              {PERSONA_PROFILE.roleShort} · {PERSONA_PROFILE.company}
            </p>
          </div>
          <span className="ml-auto text-caption text-gtm-muted tabular-nums">
            <span key={rows.filter((r) => r.state === "ready").length} className="gtm-pop inline-block font-medium text-gtm-text">
              {rows.filter((r) => r.state === "ready").length}
            </span>{" "}
            of {rows.length} set
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {rows.map(({ key, ...row }, i) => (
            <PreviewRow key={key} {...row} flashDelay={launching ? 200 + i * 220 : null} />
          ))}
        </ul>
      </div>
      <p key={launching ? "go" : "wait"} className={`mt-4 text-meta ${launching ? "gtm-shimmer" : "gtm-enter text-gtm-muted"}`}>
        {launching ? "Starting your first check-in…" : "Your first briefs arrive right after setup. Nothing goes out without your OK."}
      </p>
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  state,
  placeholder,
  working,
  summary,
  detail,
  flashDelay,
}: {
  icon: ReactNode;
  label: string;
  state: RowState;
  placeholder: string;
  working?: string;
  summary: ReactNode;
  detail?: ReactNode;
  flashDelay: number | null;
}) {
  const ready = state === "ready";
  return (
    <li className={`relative -mx-2 rounded-gtm-lg px-2 py-2 transition-opacity duration-300 ${state === "pending" ? "opacity-45" : ""}`}>
      {ready && <span key={flashDelay === null ? "landed" : "launch"} className="gtm-flash pointer-events-none absolute inset-0 rounded-gtm-lg" style={delay(flashDelay ?? 0)} aria-hidden />}
      <div className="relative flex items-start gap-3">
        <span
          className={`relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-300 [&>svg]:size-4 ${ready ? "bg-gtm-bg-secondary text-gtm-text" : state === "working" ? "gtm-pulse border border-gtm-border text-gtm-text" : "border border-dashed border-gtm-border text-gtm-muted"}`}
          aria-hidden
        >
          {icon}
          {ready && (
            <span className="gtm-pop absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-gtm-success text-white ring-2 ring-gtm-surface">
              <CheckIcon className="size-2.5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-caption font-medium text-gtm-muted">
            {label}
            {state === "active" && <span className="gtm-pulse size-1.5 rounded-full bg-gtm-emphasis text-gtm-emphasis" aria-label="Up next" />}
          </p>
          {ready ? (
            <span key="ready" className="gtm-enter block truncate text-sm text-gtm-text">
              {summary}
            </span>
          ) : state === "working" ? (
            <span key="working" className="gtm-shimmer block text-sm">
              {working}
            </span>
          ) : (
            <span key="placeholder" className="block text-sm text-gtm-muted">
              {placeholder}
            </span>
          )}
          {detail && (
            <div className={`grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${ready ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">{ready && detail}</div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
