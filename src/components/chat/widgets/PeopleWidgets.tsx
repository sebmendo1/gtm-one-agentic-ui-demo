"use client";

import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { CheckIcon, DocumentDuplicateIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/20/solid";
import { useContext, useState } from "react";
import type { CommitteeMember } from "@/lib/gtm/fixtures";
import { QuietEvidenceContext, copyText, useChatActions, useFrame } from "../context";
import { WidgetCard, initials } from "./WidgetCard";

/** Selected filter chips are inverse neutral; CTA red is reserved for primary actions. */
const SELECTED = "bg-gtm-text text-gtm-bg hover:bg-gtm-secondary";

const ROLE: Record<CommitteeMember["role"], { label: string; color: "success" | "default" | "warning"; className?: string }> = {
  decision: { label: "Decision-maker", color: "default", className: "border-gtm-text font-semibold text-gtm-text" },
  champion: { label: "Champion", color: "success" },
  influencer: { label: "Influencer", color: "default" },
  blocker: { label: "Gatekeeper", color: "warning" },
};

export function CommitteeWidget() {
  const { data, componentSources, entityLabel } = useFrame();
  const { send, busy } = useChatActions();
  const [engagedOnly, setEngagedOnly] = useState(false);
  const c = data.committee;
  if (!c) return null;
  const members = c.members.filter((m) => !engagedOnly || m.engaged);
  const engaged = c.members.filter((m) => m.engaged).length;
  const high = c.multithreadRisk.startsWith("High");
  return (
    <WidgetCard
      eyebrow="Buying committee"
      title={`${c.members.length} stakeholders · ${engaged} engaged`}
      sources={componentSources.committee}
      action={
        <FormControlLabel
          control={<Switch size="small" checked={engagedOnly} onChange={(e) => setEngagedOnly(e.target.checked)} />}
          label={<span className="text-meta">Engaged only</span>}
          className="mr-0"
        />
      }
    >
      <ul className="-mx-1 flex flex-col divide-y divide-gtm-border sm:hidden">
        {members.map((m) => (
          <li key={m.name} className="gtm-enter flex items-start gap-3 px-1 py-3 first:pt-1">
            <Avatar className="mt-0.5 size-8 bg-gtm-subtle text-caption font-semibold text-gtm-secondary">{initials(m.name)}</Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs text-gtm-muted">{m.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Chip size="small" variant="outlined" color={ROLE[m.role].color} label={ROLE[m.role].label} className={ROLE[m.role].className} />
                <span className="flex items-center gap-2 text-xs text-gtm-secondary">
                  <span className={`size-2 rounded-full ${m.engaged ? "bg-gtm-success" : "bg-gtm-border"}`} />
                  {m.engaged ? "Engaged" : "Not engaged"}
                </span>
              </div>
            </div>
            <Button size="small" variant="outlined" disabled={busy} className="shrink-0" onClick={() => send(`Contact research brief on ${m.name} at ${entityLabel ?? "the account"}`)}>
              Brief me
            </Button>
          </li>
        ))}
      </ul>
      <div className="-mx-1 overflow-x-auto max-sm:hidden">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Person</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Engaged</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.name} hover className="gtm-enter">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-7 bg-gtm-subtle text-caption font-semibold text-gtm-secondary">{initials(m.name)}</Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.name}</div>
                      <div className="truncate text-xs text-gtm-muted">{m.title}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" color={ROLE[m.role].color} label={ROLE[m.role].label} className={ROLE[m.role].className} />
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 text-sm">
                    <span className={`size-2 rounded-full ${m.engaged ? "bg-gtm-success" : "bg-gtm-border"}`} />
                    {m.engaged ? "Yes" : "No"}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" disabled={busy} onClick={() => send(`Contact research brief on ${m.name} at ${entityLabel ?? "the account"}`)}>
                    Brief me
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {c.multithreadRisk && (
          <Alert severity={high ? "warning" : c.multithreadRisk.startsWith("Low") ? "success" : "info"} variant="outlined" className="py-0">
            Multithread risk: {c.multithreadRisk}
          </Alert>
        )}
        {c.gaps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.gaps.map((g) => (
              <Chip key={g} size="small" variant="outlined" label={g} className="text-gtm-secondary" />
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

function CopyRow({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const revealed = !/not returned/i.test(value);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex shrink-0 text-gtm-muted [&_svg]:size-4">{icon}</span>
      <span className={`min-w-0 break-all ${revealed ? "" : "text-gtm-muted"}`}>{value}</span>
      {revealed && (
        <Tooltip title={copied ? "Copied" : `Copy ${label}`}>
          <IconButton
            size="small"
            aria-label={`Copy ${label}`}
            onClick={async () => {
              if (await copyText(value)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? <CheckIcon className="size-4.5" /> : <DocumentDuplicateIcon className="size-4.5" />}
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}

export function ContactWidget() {
  const { data, componentSources } = useFrame();
  const { send, busy, hostHasPrimary } = useChatActions();
  const quiet = useContext(QuietEvidenceContext);
  const p = data.contact;
  if (!p) return null;
  const rows = [
    { icon: <EnvelopeIcon />, value: p.email, label: "email" },
    { icon: <PhoneIcon />, value: p.phone, label: "phone" },
  ].filter((row) => !quiet || (row.value && !/not returned/i.test(row.value)));
  return (
    <WidgetCard
      eyebrow="Contact"
      title={
        <span className="flex items-center gap-3">
          <Avatar className="size-9 bg-gtm-text text-sm font-semibold text-gtm-bg">{initials(p.name)}</Avatar>
          <span className="min-w-0">
            <span className="block truncate">{p.name}</span>
            <span className="block truncate text-meta font-normal text-gtm-secondary">
              {p.title}
              {p.company ? ` · ${p.company}` : ""}
            </span>
          </span>
        </span>
      }
      sources={componentSources.contact}
      action={
        !quiet && <Button
          size="small"
          variant={hostHasPrimary ? "outlined" : "contained"}
          color={hostHasPrimary ? "inherit" : "primary"}
          disabled={busy}
          startIcon={<EnvelopeIcon className="size-4" />}
          onClick={() => send(`Draft a short first email to ${p.name}${p.company ? ` at ${p.company}` : ""}`)}>
          Draft email
        </Button>
      }
    >
      {rows.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {rows.map((row) => (
            <CopyRow key={row.label} {...row} />
          ))}
        </div>
      )}
      {p.engagement && (
        <div className={`rounded-gtm bg-gtm-subtle px-3 py-2 text-sm ${rows.length ? "mt-3" : ""}`}>
          <span className="text-gtm-muted">Our history: </span>
          {p.engagement}
        </div>
      )}
    </WidgetCard>
  );
}

export function ComparisonWidget() {
  const { data, componentSources, entityLabel } = useFrame();
  const { send, busy } = useChatActions();
  const cmp = data.competitor;
  if (!cmp) return null;
  return (
    <WidgetCard
      eyebrow="Competitive"
      title={`Us vs ${cmp.competitor}`}
      subtitle={entityLabel ? `At ${entityLabel}` : undefined}
      sources={componentSources.comparison}
      action={
        <Button size="small" variant="outlined" disabled={busy} onClick={() => send(`Draft a competitive talk track against ${cmp.competitor}${entityLabel ? ` for ${entityLabel}` : ""}`)}>
          Talk track
        </Button>
      }
    >
      <dl className="flex flex-col divide-y divide-gtm-border sm:hidden">
        {cmp.rows.map((r) => (
          <div key={r.dimension} className="py-3 first:pt-0 last:pb-0">
            <dt className="text-sm font-medium">{r.dimension}</dt>
            <dd className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div className="min-w-0">
                <div className="mb-0.5 text-caption text-gtm-muted">Us</div>
                {r.us}
              </div>
              <div className="min-w-0 text-gtm-secondary">
                <div className="mb-0.5 text-caption text-gtm-muted">{cmp.competitor}</div>
                {r.them}
              </div>
            </dd>
          </div>
        ))}
      </dl>
      <div className="-mx-1 overflow-x-auto max-sm:hidden">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dimension</TableCell>
              <TableCell>Us</TableCell>
              <TableCell>{cmp.competitor}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cmp.rows.map((r) => (
              <TableRow key={r.dimension} hover>
                <TableCell className="text-sm font-medium">{r.dimension}</TableCell>
                <TableCell className="text-sm">{r.us}</TableCell>
                <TableCell className="text-sm text-gtm-secondary">{r.them}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </WidgetCard>
  );
}

export function TechStackWidget() {
  const { data, componentSources } = useFrame();
  const t = data.tech;
  const [active, setActive] = useState<string | null>(null);
  if (!t) return null;
  const categories = t.categories.filter((c) => !active || c.category === active);
  return (
    <WidgetCard eyebrow="Tech stack" title={`${t.categories.length} categories`} sources={componentSources.tech_stack}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip size="small" label="All" variant={active ? "outlined" : "filled"} className={active ? "" : SELECTED} onClick={() => setActive(null)} />
        {t.categories.map((c) => (
          <Chip
            key={c.category}
            size="small"
            label={c.category}
            variant={active === c.category ? "filled" : "outlined"}
            className={active === c.category ? SELECTED : ""}
            onClick={() => setActive(active === c.category ? null : c.category)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {categories.map((c) => (
          <div key={c.category} className="gtm-enter">
            <Typography variant="subtitle2">{c.category}</Typography>
            <div className="mt-1 flex flex-wrap gap-2">
              {c.tools.map((tool) => (
                <Chip key={tool} size="small" label={tool} className="bg-gtm-subtle" />
              ))}
            </div>
            {c.play && <div className="mt-2 border-l-2 border-gtm-text pl-3 text-sm text-gtm-secondary">{c.play}</div>}
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

export function GtmContextWidget() {
  const { data, componentSources } = useFrame();
  const g = data.gtmContext;
  if (!g) return null;
  const sections: [string, string[], "list" | "chips"][] = [
    ["Offerings", g.offerings, "list"],
    ["Personas", g.personas, "chips"],
    ["ICP", g.icp, "list"],
    ["Competitors", g.competitors, "chips"],
  ];
  return (
    <WidgetCard eyebrow="GTM context" title="Your organization" subtitle={g.role ? `Signed in as ${g.role}` : undefined} sources={componentSources.gtm_context}>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections
          .filter(([, items]) => items.length)
          .map(([label, items, kind]) => (
            <div key={label} className="rounded-gtm bg-gtm-subtle px-3 py-3">
              <div className="mb-2 text-xs font-medium text-gtm-muted">{label}</div>
              {kind === "chips" ? (
                <div className="flex flex-wrap gap-1">
                  {items.map((i) => (
                    <Chip key={i} size="small" variant="outlined" label={i} className="bg-gtm-surface" />
                  ))}
                </div>
              ) : (
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm marker:text-gtm-muted">
                  {items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
      </div>
    </WidgetCard>
  );
}

export function CrmDraftCard({ field, value, reason }: { field: string; value: string; reason: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="gtm-enter border-dashed">
      <CardContent className="flex items-start gap-3 p-4 last:pb-4">
        <PencilSquareIcon className="mt-0.5 size-5 shrink-0 text-gtm-secondary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-gtm-mono text-xs text-gtm-secondary">{field}</span>
            <Chip size="small" label="CRM draft · not applied" variant="outlined" className="h-5 text-caption" />
          </div>
          <div className="mt-1 text-sm font-medium">{value}</div>
          {reason && <div className="mt-0.5 text-meta text-gtm-muted">{reason}</div>}
        </div>
        <Tooltip title={copied ? "Copied" : "Copy value"}>
          <IconButton
            size="small"
            aria-label="Copy CRM draft value"
            onClick={async () => {
              if (await copyText(value)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? <CheckIcon className="size-4.5" /> : <DocumentDuplicateIcon className="size-4.5" />}
          </IconButton>
        </Tooltip>
      </CardContent>
    </Card>
  );
}
