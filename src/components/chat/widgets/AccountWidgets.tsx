"use client";

import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  LinearProgress,
  Link,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { useMemo, useState } from "react";
import { useChatActions, useFrame } from "../context";
import { WidgetCard, initials } from "./WidgetCard";

const START_BUILDING = "https://gtm.ai/start-building?tool=gtm-cli&useCase=account-research";

function fitColor(label: string): "success" | "warning" | "default" {
  return /great/i.test(label) ? "success" : /moderate/i.test(label) ? "warning" : "default";
}

export function CompanyWidget() {
  const { data, componentSources } = useFrame();
  const c = data.company;
  if (!c) return null;
  const stats: [string, string][] = [
    ["Employees", c.employees],
    ["Revenue", c.revenue],
    ["HQ", c.hq],
    ["Industry", c.industry],
  ];
  return (
    <WidgetCard
      eyebrow="Company"
      title={
        <span className="flex items-center gap-3">
          <Avatar variant="rounded" className="size-8 bg-gtm-text text-sm font-semibold text-gtm-bg">
            {initials(c.name)}
          </Avatar>
          {c.name}
        </span>
      }
      action={
        c.website && c.website !== "—" ? (
          <Link href={`https://${c.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" underline="hover" className="text-sm">
            {c.website}
          </Link>
        ) : null
      }
      sources={componentSources.company}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-gtm bg-gtm-subtle px-3 py-2">
            <div className="text-caption text-gtm-muted">{label}</div>
            <div className="line-clamp-2 text-sm font-medium break-words" title={value}>
              {value}
            </div>
          </div>
        ))}
      </div>
      {c.icpFit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-meta text-gtm-secondary">ICP fit</span>
          <Chip size="small" label={c.icpFit} color={fitColor(c.icpFit)} variant="outlined" className="max-w-full" />
        </div>
      )}
    </WidgetCard>
  );
}

type TopicFilter = "all" | "ours" | "other";

export function IntentWidget() {
  const { data, componentSources, entityLabel } = useFrame();
  const { send, busy } = useChatActions();
  const [filter, setFilter] = useState<TopicFilter>("all");
  const topics = data.signals?.topics ?? [];
  const shown = topics.filter((t) => filter === "all" || (filter === "ours") === t.mapsToUs);
  const ours = topics.filter((t) => t.mapsToUs).length;
  return (
    <WidgetCard
      eyebrow="Intent"
      title={`${topics.length} topics · ${ours} map to us`}
      sources={componentSources.intent}
      action={
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v: TopicFilter | null) => v && setFilter(v)}>
          <ToggleButton value="all" className="px-3 py-0.5 text-xs">All</ToggleButton>
          <ToggleButton value="ours" className="px-3 py-0.5 text-xs">Ours</ToggleButton>
          <ToggleButton value="other" className="px-3 py-0.5 text-xs">Adjacent</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      <div className="flex flex-col gap-3">
        {shown.map((t) => (
          <div key={t.topic} className="gtm-enter">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 text-sm font-medium break-words">{t.topic}</span>
                <Chip
                  size="small"
                  label={t.mapsToUs ? "Our offering" : "Adjacent"}
                  color={t.mapsToUs ? "success" : "default"}
                  variant={t.mapsToUs ? "filled" : "outlined"}
                  className="h-5 shrink-0 text-caption"
                />
              </div>
              <span className="shrink-0 pt-0.5 font-gtm-mono text-xs text-gtm-muted">{t.score ?? "—"}</span>
            </div>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, t.score ?? 0)}
              color={t.mapsToUs ? "success" : "inherit"}
              className="mt-2 h-1.5 rounded-full bg-gtm-subtle text-gtm-muted"
            />
          </div>
        ))}
        {shown.length === 0 && <Typography variant="body2" color="text.secondary">No topics in this filter.</Typography>}
      </div>
      {ours > 0 && (
        <Button
          size="small"
          className="mt-3"
          startIcon={<AutoAwesomeOutlinedIcon />}
          disabled={busy}
          onClick={() => send(`Why now case for reaching out to ${entityLabel ?? "this account"} based on its intent on our offerings`)}
        >
          Turn this into a why-now case
        </Button>
      )}
    </WidgetCard>
  );
}

export function SignalsWidget() {
  const { data, componentSources, entityLabel } = useFrame();
  const { send, busy } = useChatActions();
  const items = useMemo(
    () =>
      [
        ...(data.signals?.scoops ?? []).map((s) => ({ kind: "Scoop" as const, date: s.date, text: s.text })),
        ...(data.signals?.news ?? []).map((n) => ({ kind: "News" as const, date: n.date, text: n.headline })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [data.signals],
  );
  return (
    <WidgetCard eyebrow="Signals" title="What changed" sources={componentSources.signals}>
      <ol className="relative ml-2 border-l border-gtm-border">
        {items.map((item) => (
          <li key={`${item.kind}-${item.text}`} className="group relative pb-4 pl-5 last:pb-0">
            <span className="absolute top-1 -left-[7px] flex size-3.5 items-center justify-center rounded-full border border-gtm-border bg-gtm-surface">
              <span className={`size-1.5 rounded-full ${item.kind === "Scoop" ? "bg-gtm-text" : "bg-gtm-muted"}`} />
            </span>
            <div className="flex items-center gap-2 text-xs text-gtm-muted">
              {item.kind === "Scoop" ? <BoltOutlinedIcon sx={{ fontSize: 14 }} /> : <NewspaperOutlinedIcon sx={{ fontSize: 14 }} />}
              <span className="font-gtm-mono">{item.date || "undated"}</span>
              <span>· {item.kind}</span>
            </div>
            <div className="mt-0.5 flex items-start justify-between gap-2">
              <span className="text-sm">{item.text}</span>
              <Tooltip title="Draft outreach from this">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Draft outreach from this signal"
                    disabled={busy}
                    className="-mt-1 shrink-0 pointer-fine:opacity-60 pointer-fine:group-hover:opacity-100"
                    onClick={() => send(`Draft a short outreach email to ${entityLabel ?? "this account"} referencing: ${item.text} (${item.date})`)}
                  >
                    <SendOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </div>
          </li>
        ))}
      </ol>
    </WidgetCard>
  );
}

export function NextActionsWidget() {
  const { data, componentSources, entityLabel } = useFrame();
  const { send, busy } = useChatActions();
  const actions = data.company?.nextActions ?? [];
  const [done, setDone] = useState<Set<number>>(() => new Set());
  return (
    <WidgetCard
      eyebrow="Next actions"
      title={`${done.size} of ${actions.length} done`}
      sources={componentSources.next_actions}
      action={
        <Button size="small" variant="outlined" href={START_BUILDING} target="_blank" rel="noreferrer" endIcon={<ArrowOutwardIcon />}>
          Open in GTM AI
        </Button>
      }
    >
      <LinearProgress
        variant="determinate"
        color="success"
        value={actions.length ? (done.size / actions.length) * 100 : 0}
        className="mb-2 h-1 rounded-full bg-gtm-subtle"
      />
      <ul className="flex flex-col">
        {actions.map((action, i) => (
          <li key={action} className="group flex items-center gap-1 rounded-gtm py-0.5 pr-1 hover:bg-gtm-subtle">
            <Checkbox
              size="small"
              checked={done.has(i)}
              onChange={() =>
                setDone((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              slotProps={{ input: { "aria-label": action } }}
            />
            <span className={`min-w-0 flex-1 text-sm ${done.has(i) ? "text-gtm-muted line-through" : ""}`}>{action}</span>
            <Button
              size="small"
              disabled={busy}
              className="shrink-0 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
              onClick={() => send(`Help me with this next step for ${entityLabel ?? "the account"}: ${action}`)}
            >
              Help me
            </Button>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

function Gauge({ label, value, caption }: { label: string; value: number; caption: string }) {
  // A low score is not an error: it reads in neutral grey, never CTA or error red.
  const color = value >= 75 ? "success" : value >= 55 ? "warning" : "inherit";
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Box className="relative inline-flex shrink-0">
        <CircularProgress variant="determinate" value={100} size={64} thickness={4} className="absolute text-gtm-subtle" />
        <CircularProgress variant="determinate" value={value} size={64} thickness={4} color={color} className={color === "inherit" ? "text-gtm-muted" : ""} />
        <span className="absolute inset-0 flex items-center justify-center text-base font-semibold">{value}</span>
      </Box>
      <div>
        <div className="text-xs text-gtm-muted">{label}</div>
        <div className="text-sm font-medium">{caption}</div>
      </div>
    </div>
  );
}

function tier(score: number): { label: string; color: "success" | "warning" | "default" } {
  if (score >= 75) return { label: "Tier A — prioritize", color: "success" };
  if (score >= 55) return { label: "Tier B — nurture with intent", color: "warning" };
  return { label: "Tier C — monitor", color: "default" };
}

export function ScoresWidget() {
  const { data, componentSources } = useFrame();
  const s = data.scores;
  const [fitWeight, setFitWeight] = useState(60);
  const [open, setOpen] = useState(false);
  if (!s) return null;
  const blended = Math.round((s.fit * fitWeight + s.inMarket * (100 - fitWeight)) / 100);
  const t = tier(blended);
  return (
    <WidgetCard eyebrow="Score" title={data.company?.name ?? "Account score"} sources={componentSources.scores}>
      <div className="grid grid-cols-2 gap-4">
        <Gauge label="ICP fit" value={s.fit} caption={s.fitLabel} />
        <Gauge label="In-market" value={s.inMarket} caption={s.inMarketLabel} />
      </div>
      <div className="mt-4 rounded-gtm bg-gtm-subtle px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-meta text-gtm-secondary">
            Weighting: fit {fitWeight}% · in-market {100 - fitWeight}%
          </span>
          <Chip size="small" color={t.color} label={`${blended} · ${t.label}`} className="max-w-full" />
        </div>
        <Slider
          size="small"
          value={fitWeight}
          min={0}
          max={100}
          step={5}
          onChange={(_, v) => setFitWeight(v as number)}
          aria-label="Weight of ICP fit versus in-market"
          className="mt-1"
          sx={{ color: "var(--gtm-text)" }}
        />
      </div>
      <Button size="small" className="mt-2" onClick={() => setOpen((o) => !o)} endIcon={<ExpandMoreIcon className={open ? "rotate-180" : ""} />}>
        {open ? "Hide" : "Show"} how it&apos;s scored
      </Button>
      <Collapse in={open}>
        <ul className="mt-1 flex flex-col gap-2">
          {s.breakdown.map((row) => (
            <li key={row.label} className="text-sm">
              <span className="text-gtm-muted">{row.label}: </span>
              {row.value}
            </li>
          ))}
        </ul>
      </Collapse>
    </WidgetCard>
  );
}

export function WhyNowWidget() {
  const { data, componentSources, entityLabel } = useFrame();
  const { send, busy } = useChatActions();
  const w = data.whyNow;
  if (!w) return null;
  return (
    <WidgetCard eyebrow="Why now" title="Timing thesis" sources={componentSources.why_now}>
      <blockquote className="border-l-2 border-gtm-text pl-3 text-body">{w.thesis}</blockquote>
      <div className="mt-4 flex flex-col gap-2">
        {w.hooks.map((hook) => (
          <div key={hook} className="flex items-center justify-between gap-3 rounded-gtm bg-gtm-subtle px-3 py-2">
            <span className="text-sm">{hook}</span>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              className="shrink-0"
              onClick={() => send(`Draft a short outreach email to ${entityLabel ?? "this account"} using this hook: ${hook}`)}
            >
              Use hook
            </Button>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
