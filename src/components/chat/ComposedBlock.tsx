"use client";

import {
  Button,
  Chip,
  LinearProgress,
  Slider,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useMemo, useState, type ReactNode } from "react";
import { DATA_ROOTS } from "@/lib/genui/catalog";
import { compileComposed, type PropValue, type UiNode } from "@/lib/genui/compile";
import { evalExpr, formatValue, type Scope } from "@/lib/genui/expr";
import { isTrustedHref } from "@/lib/safe-links";
import { copyText, useChatActions, useFrame } from "./context";
import { WidgetCard } from "./widgets/WidgetCard";

// Static class maps so Tailwind sees every class: spacing follows the 4px scale (SPACE_STEPS).
const GAP: Record<number, string> = { 0: "gap-0", 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 5: "gap-5", 6: "gap-6", 8: "gap-8" };
const PAD: Record<number, string> = { 0: "p-0", 1: "p-1", 2: "p-2", 3: "p-3", 4: "p-4", 5: "p-5", 6: "p-6", 8: "p-8" };
const COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };
const ALIGN: Record<string, string> = { start: "items-start", center: "items-center", end: "items-end", between: "items-center justify-between" };
const TITLE: Record<string, string> = { sm: "text-sm font-semibold", md: "text-body font-semibold", lg: "text-lg font-semibold tracking-tight" };
const TONE: Record<string, string> = { default: "text-gtm-text", secondary: "text-gtm-secondary", muted: "text-gtm-muted" };
const SIZE: Record<string, string> = { sm: "text-meta", md: "text-sm" };
const MAX_ROWS = 20;

interface Ui {
  state: Record<string, unknown>;
  setState: (name: string, value: unknown) => void;
}

function value(prop: PropValue | undefined, scope: Scope): unknown {
  if (!prop) return undefined;
  return prop.kind === "expr" ? evalExpr(prop.expr, scope) : prop.value;
}

function text(prop: PropValue | undefined, scope: Scope): string {
  const v = value(prop, scope);
  return v === undefined ? "" : formatValue(v);
}

function str(prop: PropValue | undefined, fallback: string): string {
  return prop?.kind === "str" ? prop.value : fallback;
}

function num(prop: PropValue | undefined, fallback: number): number {
  return prop?.kind === "num" ? prop.value : fallback;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[,$%]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function field(item: unknown, name: string): unknown {
  return item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, name) ? (item as Record<string, unknown>)[name] : item;
}

/** `"value:Label,value:Label"` → pairs; a bare entry is both value and label. */
function pairs(spec: string): [string, string][] {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf(":");
      return at < 0 ? [part, part] : [part.slice(0, at).trim(), part.slice(at + 1).trim()];
    });
}

function ComposedTabs({ node, scope, ui }: { node: Extract<UiNode, { kind: "el" }>; scope: Scope; ui: Ui }) {
  const [active, setActive] = useState(0);
  const tabs = node.children.filter((c): c is Extract<UiNode, { kind: "el" }> => c.kind === "el" && c.tag === "tab");
  if (!tabs.length) return null;
  const current = tabs[Math.min(active, tabs.length - 1)]!;
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={Math.min(active, tabs.length - 1)} onChange={(_, i: number) => setActive(i)} variant="scrollable" className="min-h-0">
        {tabs.map((t, i) => (
          <Tab key={i} label={text(t.props.label, scope)} className="min-h-0 px-3 py-2 text-meta normal-case" />
        ))}
      </Tabs>
      <div className="flex flex-col gap-2">{renderAll(current.children, scope, ui)}</div>
    </div>
  );
}

function ComposedButton({ node, scope }: { node: Extract<UiNode, { kind: "el" }>; scope: Scope }) {
  const { send, busy } = useChatActions();
  const [copied, setCopied] = useState(false);
  const label = text(node.props.label, scope);
  const message = text(node.props.message, scope);
  const action = str(node.props.action, "ask");
  if (action === "open") {
    if (!isTrustedHref(message) || !message.startsWith("https://")) return null;
    return (
      <Button size="small" variant="outlined" color="inherit" href={message} target="_blank" rel="noreferrer noopener" className="self-start">
        {label}
      </Button>
    );
  }
  if (action === "copy") {
    return (
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        className="self-start"
        onClick={async () => {
          if (await copyText(message)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? "Copied" : label}
      </Button>
    );
  }
  return (
    <Button size="small" variant="outlined" disabled={busy || !message} onClick={() => send(message)} className="self-start">
      {label}
    </Button>
  );
}

function renderAll(nodes: UiNode[], scope: Scope, ui: Ui): ReactNode[] {
  return nodes.map((node, i) => renderNode(node, scope, ui, i));
}

function renderNode(node: UiNode, scope: Scope, ui: Ui, key: number): ReactNode {
  if (node.kind === "text") return node.value;
  if (node.kind === "expr") return formatValue(evalExpr(node.expr, scope));
  const p = node.props;
  const children = () => renderAll(node.children, scope, ui);
  switch (node.tag) {
    case "box": {
      const row = str(p.direction, "col") === "row";
      return (
        <div
          key={key}
          className={[
            "flex min-w-0",
            row ? "flex-row flex-wrap" : "flex-col",
            GAP[num(p.gap, 2)],
            p.padding ? PAD[num(p.padding, 0)] : "",
            value(p.border, scope) ? "rounded-gtm border border-gtm-border" : "",
            p.align ? ALIGN[str(p.align, "start")] : row ? "items-center" : "",
          ].join(" ")}
        >
          {children()}
        </div>
      );
    }
    case "grid":
      return (
        <div key={key} className={`grid ${COLS[num(p.cols, 2)]} ${GAP[num(p.gap, 2)]}`}>
          {children()}
        </div>
      );
    case "title":
      return (
        <div key={key} className={TITLE[str(p.size, "md")]}>
          {children()}
        </div>
      );
    case "text":
      return (
        <p key={key} className={`${TONE[str(p.tone, "default")]} ${SIZE[str(p.size, "md")]}`}>
          {children()}
        </p>
      );
    case "eyebrow":
      return (
        <span key={key} className="gtm-eyebrow">
          {children()}
        </span>
      );
    case "stat":
      return (
        <div key={key} className="min-w-0 rounded-gtm bg-gtm-subtle px-3 py-2">
          <div className="text-caption text-gtm-muted">{text(p.label, scope)}</div>
          <div className="truncate text-sm font-medium tabular-nums">{text(p.value, scope)}</div>
          {p.caption && <div className="text-caption text-gtm-muted">{text(p.caption, scope)}</div>}
        </div>
      );
    case "badge": {
      const tone = str(p.tone, "neutral");
      return (
        <Chip
          key={key}
          size="small"
          label={text(p.label, scope)}
          color={tone === "success" ? "success" : tone === "warning" ? "warning" : "default"}
          variant={tone === "neutral" ? "outlined" : "filled"}
          className={`h-5 self-start text-caption ${tone === "emphasis" ? "bg-gtm-text text-gtm-bg" : ""}`}
        />
      );
    }
    case "progress": {
      const max = num(p.max, 100);
      const v = toNumber(value(p.value, scope));
      return (
        <div key={key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-meta">
            <span className="text-gtm-secondary">{text(p.label, scope)}</span>
            <span className="font-gtm-mono text-xs text-gtm-muted tabular-nums">{formatValue(v)}</span>
          </div>
          <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, (v / max) * 100))} color="inherit" className="h-1.5 rounded-full bg-gtm-subtle text-gtm-secondary" />
        </div>
      );
    }
    case "bars": {
      const items = value(p.data, scope);
      if (!Array.isArray(items)) return null;
      const labelKey = str(p.label, "label");
      const valueKey = str(p.value, "value");
      const rows = items.slice(0, MAX_ROWS).map((item) => ({ label: formatValue(field(item, labelKey)), v: toNumber(field(item, valueKey)) }));
      const max = p.max ? num(p.max, 100) : Math.max(1, ...rows.map((r) => r.v));
      return (
        <div key={key} className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-meta">
              <span className="truncate text-gtm-secondary" title={r.label}>
                {r.label}
              </span>
              <div className="h-1.5 rounded-full bg-gtm-subtle">
                <div className="h-full rounded-full bg-gtm-secondary" style={{ width: `${Math.max(0, Math.min(100, (r.v / max) * 100))}%` }} />
              </div>
              <span className="font-gtm-mono text-xs text-gtm-muted tabular-nums">{formatValue(r.v)}</span>
            </div>
          ))}
        </div>
      );
    }
    case "table": {
      const rows = value(p.rows, scope);
      if (!Array.isArray(rows)) return null;
      const columns = pairs(text(p.columns, scope));
      return (
        <TableContainer key={key} className="rounded-gtm border border-gtm-border">
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map(([f, header]) => (
                  <TableCell key={f}>{header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(0, MAX_ROWS).map((row, i) => (
                <TableRow key={i}>
                  {columns.map(([f]) => (
                    <TableCell key={f} className="text-sm">
                      {formatValue(field(row, f))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }
    case "list": {
      const items = value(p.items, scope);
      if (!Array.isArray(items)) return null;
      const f = p.field ? str(p.field, "") : null;
      const Tag = value(p.ordered, scope) ? "ol" : "ul";
      return (
        <Tag key={key} className={`flex flex-col gap-1 pl-5 text-sm ${Tag === "ol" ? "list-decimal" : "list-disc"} marker:text-gtm-muted`}>
          {items.slice(0, MAX_ROWS).map((item, i) => (
            <li key={i}>{formatValue(f ? field(item, f) : item)}</li>
          ))}
        </Tag>
      );
    }
    case "each": {
      const items = value(p.of, scope);
      if (!Array.isArray(items)) return null;
      const as = str(p.as, "item");
      const out: ReactNode[] = [];
      for (const item of items) {
        if (out.length >= num(p.limit, MAX_ROWS)) break;
        const inner = { ...scope, [as]: item };
        if (p.where && !value(p.where, inner)) continue;
        out.push(...renderAll(node.children, inner, ui).map((child, j) => <div key={`${out.length}-${j}`} className="contents">{child}</div>));
      }
      return out.length ? <div key={key} className="contents">{out}</div> : null;
    }
    case "if":
      return value(p.test, scope) ? (
        <div key={key} className="contents">
          {children()}
        </div>
      ) : null;
    case "slider": {
      const name = str(p.state, "");
      const min = num(p.min, 0);
      const max = num(p.max, 100);
      const current = toNumber(ui.state[name]);
      return (
        <div key={key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-meta">
            <span className="text-gtm-secondary">{text(p.label, scope)}</span>
            <span className="font-gtm-mono text-xs tabular-nums">{formatValue(current)}</span>
          </div>
          <Slider
            size="small"
            sx={{ color: "var(--gtm-text)" }}
            min={min}
            max={max}
            step={num(p.step, 1)}
            value={Math.max(min, Math.min(max, current))}
            onChange={(_, v) => ui.setState(name, v as number)}
            aria-label={text(p.label, scope) || name}
          />
        </div>
      );
    }
    case "segmented": {
      const name = str(p.state, "");
      return (
        <ToggleButtonGroup
          key={key}
          size="small"
          exclusive
          value={String(ui.state[name] ?? "")}
          onChange={(_, v: string | null) => v !== null && ui.setState(name, v)}
          className="self-start"
        >
          {pairs(text(p.options, scope)).map(([v, label]) => (
            <ToggleButton key={v} value={v} className="px-3 py-1 text-xs normal-case">
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      );
    }
    case "tabs":
      return <ComposedTabs key={key} node={node} scope={scope} ui={ui} />;
    case "button":
      return <ComposedButton key={key} node={node} scope={scope} />;
    case "divider":
      return <hr key={key} className="border-gtm-border" />;
    case "state":
    case "tab":
      return null;
  }
}

/**
 * A view the writer composed from catalog primitives, bound to this message's frame data. State
 * (sliders, segmented choices, tabs) lives here, so interacting never calls the model.
 */
export function ComposedBlock({ title, source }: { title: string | null; source: string }) {
  const frame = useFrame();
  const compiled = useMemo(() => compileComposed(source, title), [source, title]);
  const data = useMemo<Scope>(
    () => Object.fromEntries(Object.keys(DATA_ROOTS).map((root) => [root, frame.data[root as keyof typeof DATA_ROOTS]])),
    [frame.data],
  );
  const [state, setStateMap] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(compiled.states.map((s) => [s.name, evalExpr(s.init, data)])),
  );
  if (!compiled.nodes.length) return null;
  const ui: Ui = { state, setState: (name, v) => setStateMap((prev) => ({ ...prev, [name]: v })) };
  const sources = [...new Set(compiled.roots.flatMap((root) => frame.rootSources?.[root] ?? []))];
  return (
    <WidgetCard eyebrow="Custom view" title={title ?? "View"} sources={sources}>
      <div className="flex flex-col gap-3">{renderAll(compiled.nodes, { ...data, ...state }, ui)}</div>
    </WidgetCard>
  );
}
