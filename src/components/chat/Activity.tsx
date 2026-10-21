"use client";

import { Chip, CircularProgress, Collapse } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useEffect, useState, type ReactNode } from "react";
import { GTM_JOBS } from "@/lib/gtm/jobs";
import { UI_COMPONENTS, isUiComponent } from "@/lib/message";
import type { EvidenceSummary, SectionDropReason, SectionTrace, Trace } from "@/lib/spec";

const STATUS_ICON: Record<EvidenceSummary["status"], ReactNode> = {
  ok: <CheckCircleOutlineIcon className="text-gtm-success" sx={{ fontSize: 16 }} />,
  empty: <RadioButtonUncheckedIcon className="text-gtm-muted" sx={{ fontSize: 16 }} />,
  denied: <BlockIcon className="text-gtm-warning" sx={{ fontSize: 16 }} />,
  unauthorized: <LockOutlinedIcon className="text-gtm-accent" sx={{ fontSize: 16 }} />,
  unavailable: <ErrorOutlineIcon className="text-gtm-warning" sx={{ fontSize: 16 }} />,
  error: <ErrorOutlineIcon className="text-gtm-accent" sx={{ fontSize: 16 }} />,
  skipped: <RadioButtonUncheckedIcon className="text-gtm-muted" sx={{ fontSize: 16 }} />,
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function sectionLabel(id: string): string {
  if (id === "compose") return "Custom view";
  return isUiComponent(id) ? UI_COMPONENTS[id].label : id.replaceAll("_", " ");
}

const DROP_REASON: Record<SectionDropReason, string> = {
  omitted: "not needed",
  below_threshold: "not confident enough",
  overlap: "repeats another view",
  cap: "over the limit",
  text_mode: "text-only reply",
  not_placed: "not written",
  invalid: "failed validation",
};

/** The GenUI section counter: how many views the reply shows against the limit, and why others were left out. */
function SectionSummary({ sections }: { sections: SectionTrace }) {
  const cut = sections.dropped.filter((d) => d.reason !== "omitted" && d.reason !== "text_mode");
  return (
    <div>
      <span className="text-gtm-muted">GenUI sections </span>
      {sections.shown} of {sections.limit} max
      {sections.allowed !== sections.shown && <span className="text-gtm-muted"> · {sections.allowed} allowed</span>}
      {cut.length > 0 && (
        <div className="text-xs text-gtm-muted">
          Left out: {cut.map((d) => `${sectionLabel(d.id)} (${DROP_REASON[d.reason]}${d.detail ? `: ${d.detail}` : ""})`).join(" · ")}
        </div>
      )}
      {sections.compose && sections.compose.diagnostics.length > 0 && (
        <div className="text-xs text-gtm-muted">
          Custom view: {sections.compose.nodes} elements · fixed {sections.compose.diagnostics.length} issue
          {sections.compose.diagnostics.length === 1 ? "" : "s"} ({sections.compose.diagnostics.slice(0, 3).map((d) => d.detail).join("; ")})
        </div>
      )}
    </div>
  );
}

export interface ActivityState {
  labels: string[];
  steps: EvidenceSummary[];
  startedAt: number;
  ms: number | null;
  /** What is happening right now — a phase or the step that is running. */
  current?: string | null;
}

function useElapsed(startedAt: number, live: boolean): number {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!live) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [live]);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** Like a "thinking" disclosure: live while working, then a one-line summary that expands. */
export function Activity({ activity, trace, live }: { activity: ActivityState; trace: Trace | null; live: boolean }) {
  const [open, setOpen] = useState(false);
  const steps = trace?.harness?.steps.length ? trace.harness.steps : activity.steps;
  const elapsed = useElapsed(activity.startedAt, live);
  const current = activity.current ?? activity.labels.at(-1) ?? "Thinking";
  const secs = activity.ms === null ? null : Math.max(1, Math.round(activity.ms / 1000));
  const calls = steps.length;
  const reused = steps.filter((s) => s.carried).length;
  const summary = calls
    ? `${reused === calls ? "Reused" : "Researched with"} ${calls} GTM call${calls === 1 ? "" : "s"}${reused && reused < calls ? ` (${reused} reused)` : ""}${secs ? ` · ${secs}s` : ""}`
    : secs
      ? `Thought for ${secs}s`
      : "Thought it through";
  const h = trace?.harness;
  const errors = [h?.planner.error, h?.writer.error].filter((e): e is string => Boolean(e));

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pr-2 text-meta text-gtm-muted transition-colors hover:text-gtm-text"
        aria-expanded={open}
      >
        {live ? <CircularProgress size={12} thickness={6} color="inherit" /> : null}
        {live ? (
          <>
            <span key={current} className="gtm-shimmer" aria-live="polite">
              {current}…
            </span>
            {elapsed >= 2 && <span className="font-gtm-mono text-caption tabular-nums">{elapsed}s</span>}
          </>
        ) : (
          <span>{summary}</span>
        )}
        <ExpandMoreIcon sx={{ fontSize: 16 }} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Collapse in={open}>
        <div className="mt-1 ml-2 flex flex-col gap-3 border-l border-gtm-border py-1 pl-4 text-meta">
          {activity.labels.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-gtm-secondary">
              {activity.labels.map((label, i) => (
                <li key={`${label}-${i}`}>{label}</li>
              ))}
            </ul>
          )}
          {steps.length > 0 && (
            <ul className="flex flex-col gap-2">
              {steps.map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex">{STATUS_ICON[s.status]}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gtm-text">{s.reason || s.command}</span>
                      <span className="font-gtm-mono text-caption text-gtm-muted">
                        {s.id} · {s.status}
                        {s.status === "ok" ? ` · ${s.count}` : ""}
                      </span>
                      {s.carried ? (
                        <Chip size="small" label="Reused from earlier" variant="outlined" className="h-4 text-caption text-gtm-muted" />
                      ) : (
                        s.cost !== "free" && <Chip size="small" label={s.cost === "ai" ? "AI credits" : "Data credits"} variant="outlined" className="h-4 text-caption" />
                      )}
                    </div>
                    <code className="block truncate font-gtm-mono text-caption text-gtm-muted" title={s.display}>
                      {s.display}
                    </code>
                    {s.error && <div className="text-xs text-gtm-muted">{s.error}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {trace && (
            <div className="flex flex-col gap-1 text-gtm-secondary">
              <div>
                <span className="text-gtm-muted">Jev · job </span>
                {GTM_JOBS[trace.job.choice]?.split(":")[0]} ({pct(trace.job.confidence)})
                {trace.purpose && (
                  <>
                    <span className="text-gtm-muted"> · purpose </span>
                    {trace.purpose.choice.replaceAll("_", " ")}
                  </>
                )}
              </div>
              {trace.ui && (
                <div>
                  <span className="text-gtm-muted">Jev · reply </span>
                  {trace.ui.mode.choice === "visual" ? "text + components" : "text only"} ({pct(trace.ui.mode.confidence)})
                  {trace.ui.picks.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {trace.ui.picks.map((p) => (
                        <Chip
                          key={p.id}
                          size="small"
                          variant={p.placement === "omit" ? "outlined" : "filled"}
                          label={`${sectionLabel(p.id)}: ${p.placement} ${pct(p.confidence)}`}
                          className={`h-5 text-caption ${p.placement === "omit" ? "text-gtm-muted" : ""}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {trace.ui?.sections && <SectionSummary sections={trace.ui.sections} />}
              {h && (
                <div>
                  <span className="text-gtm-muted">Planner </span>
                  {h.planner.kind === "gemini" ? `Gemini (${h.planner.model})` : "default plan"}
                  <span className="text-gtm-muted"> · writer </span>
                  {h.writer.kind === "gemini" ? `Gemini (${h.writer.model})` : h.writer.kind}
                  <span className="text-gtm-muted"> · data </span>
                  {h.source === "fixtures" ? `fixtures (CLI ${h.cli.replaceAll("_", " ")})` : "GTM CLI"}
                </div>
              )}
              {h?.cliDetail && <div className="text-xs text-gtm-muted">{h.cliDetail}</div>}
              {errors.map((e) => (
                <div key={e} className="text-xs text-gtm-warning">
                  {e}
                </div>
              ))}
              {h && (h.geminiUsage.input_tokens > 0 || h.geminiUsage.output_tokens > 0) && (
                <div className="text-xs text-gtm-muted">
                  Gemini tokens {h.geminiUsage.input_tokens} in / {h.geminiUsage.output_tokens} out
                </div>
              )}
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}
