"use client";

import { Chip, Tooltip } from "@mui/material";
import { useContext } from "react";
import { FrameContext } from "./context";

function shortLabel(label: string | undefined): string {
  return label?.split(" · ")[0] ?? "source";
}

/** Inline citation pill: the first source's name, `+n` for more, full ids in the tooltip. */
export function Cite({ ids }: { ids: string[] }) {
  const frame = useContext(FrameContext);
  const clean = ids.filter(Boolean);
  if (!clean.length) return null;
  const sources = frame?.sources ?? {};
  const title = clean.map((id) => `${id} · ${sources[id] ?? "evidence"}`).join("\n");
  return (
    <Tooltip title={<span className="whitespace-pre-line">{title}</span>} arrow>
      <Chip
        component="span"
        size="small"
        data-cite
        label={`${shortLabel(sources[clean[0]!])}${clean.length > 1 ? ` +${clean.length - 1}` : ""}`}
        className="mx-0.5 h-5 cursor-default rounded-full bg-gtm-subtle align-[1px] font-gtm-mono text-caption text-gtm-secondary"
      />
    </Tooltip>
  );
}

/** Source pills under a component. */
export function SourceChips({ ids }: { ids: string[] | undefined }) {
  if (!ids?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1">
      <span className="mr-1 text-caption text-gtm-muted">Sources</span>
      {ids.map((id) => (
        <Cite key={id} ids={[id]} />
      ))}
    </div>
  );
}
