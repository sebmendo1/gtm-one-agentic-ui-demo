"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { ChatBubbleLeftRightIcon, CheckIcon, EnvelopeIcon, LinkIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import type { AgentRun } from "@/lib/agents/types";
import { copyText } from "@/components/chat/context";

export type ShareChannel = "email" | "slack" | "link";

const CLOSE_AFTER_MS = 1100;

function sharePayload(run: AgentRun): string {
  if (!run.message) return "";
  const payload = {
    title: `${run.entity.company ?? "Meeting"} brief`,
    markdown: run.message.markdown,
    frame: {
      job: run.message.job,
      entityLabel: run.message.entityLabel,
      data: run.message.data,
      placements: run.message.placements,
      sources: run.message.sources,
      componentSources: run.message.componentSources,
      rootSources: run.message.rootSources,
      source: run.message.source,
      compose: run.message.compose,
      allowCrmDrafts: false,
      notFound: run.message.notFound,
    },
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function Option({
  icon,
  title,
  detail,
  sent,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  sent: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-0 flex-1 flex-col items-start gap-2 rounded-gtm-xl border p-3 text-left transition-colors disabled:cursor-default ${
        sent ? "border-gtm-success/50 bg-gtm-success/[0.06]" : "border-gtm-border hover:bg-gtm-hover"
      }`}
    >
      <span className={`flex size-8 items-center justify-center rounded-full ${sent ? "gtm-pop bg-gtm-success text-white" : "bg-gtm-subtle text-gtm-secondary"}`}>
        {sent ? <CheckIcon className="size-4.5" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gtm-text">{sent ? "Sent" : title}</span>
        <span className="block truncate text-meta text-gtm-muted">{detail}</span>
      </span>
    </button>
  );
}

export function ShareSheet({
  open,
  run,
  suggestedName,
  suggestedRole,
  suggestedEmail,
  onClose,
  onShared,
}: {
  open: boolean;
  run: AgentRun | null;
  suggestedName?: string;
  suggestedRole?: string;
  suggestedEmail?: string;
  onClose: () => void;
  onShared: (channel: ShareChannel) => void;
}) {
  const [sent, setSent] = useState<ShareChannel | null>(null);
  if (!run?.message) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/share#${sharePayload(run)}` : "/share";
  const first = suggestedName?.split(" ")[0] ?? "a teammate";
  const handle = suggestedEmail ? `@${suggestedEmail.split("@")[0]}` : "a channel";

  const share = async (channel: ShareChannel) => {
    if (channel === "link" && !(await copyText(url))) return;
    setSent(channel);
    onShared(channel);
    setTimeout(() => {
      setSent(null);
      onClose();
    }, CLOSE_AFTER_MS);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share this brief</DialogTitle>
      <DialogContent className="flex flex-col gap-4 pt-1">
        <p className="text-sm text-gtm-secondary">
          {suggestedName ? (
            <>
              <strong>{suggestedName}</strong>
              {suggestedRole ? ` (${suggestedRole})` : ""} is on the invite. Send the brief so {first} walks in prepared.
            </>
          ) : (
            "Send a read-only link. Recipients can start their own Go-to-agent."
          )}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Option
            icon={<EnvelopeIcon className="size-4.5" />}
            title={`Email ${first}`}
            detail={suggestedEmail ?? "From your Gmail"}
            sent={sent === "email"}
            disabled={Boolean(sent)}
            onClick={() => void share("email")}
          />
          <Option
            icon={<ChatBubbleLeftRightIcon className="size-4.5" />}
            title="Send in Slack"
            detail={`DM ${handle}`}
            sent={sent === "slack"}
            disabled={Boolean(sent)}
            onClick={() => void share("slack")}
          />
          <Option
            icon={<LinkIcon className="size-4.5" />}
            title="Copy link"
            detail="Read-only, no sign-in"
            sent={sent === "link"}
            disabled={Boolean(sent)}
            onClick={() => void share("link")}
          />
        </div>
        <TextField size="small" fullWidth label="Share link" value={url} slotProps={{ input: { readOnly: true } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
