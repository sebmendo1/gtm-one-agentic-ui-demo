"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import type { AgentRun } from "@/lib/agents/types";
import { copyText } from "@/components/chat/context";

function sharePayload(run: AgentRun): string {
  if (!run.message) return "";
  const payload = {
    title: run.entity.company ?? "Meeting brief",
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

export function ShareSheet({
  open,
  run,
  suggestedName,
  suggestedRole,
  onClose,
  onShared,
}: {
  open: boolean;
  run: AgentRun | null;
  suggestedName?: string;
  suggestedRole?: string;
  onClose: () => void;
  onShared: () => void;
}) {
  if (!run?.message) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/share#${sharePayload(run)}` : "/share";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share this brief</DialogTitle>
      <DialogContent className="flex flex-col gap-3 pt-1">
        <p className="text-sm text-gtm-secondary">
          {suggestedName ? (
            <>
              <strong>{suggestedName}</strong>
              {suggestedRole ? ` (${suggestedRole})` : ""} is on the invite. Share the brief so they walk in prepared.
            </>
          ) : (
            "Send a read-only link. Recipients can sign up for their own Go-to-agent."
          )}
        </p>
        <TextField size="small" fullWidth label="Share link" value={url} slotProps={{ input: { readOnly: true } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={async () => {
            await copyText(url);
            onShared();
            onClose();
          }}
        >
          Copy link
        </Button>
      </DialogActions>
    </Dialog>
  );
}
