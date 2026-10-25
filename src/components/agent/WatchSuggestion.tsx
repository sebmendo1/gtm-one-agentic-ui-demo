"use client";

import { Button } from "@mui/material";

export function WatchSuggestion({
  company,
  onWatch,
  onDismiss,
}: {
  company: string;
  onWatch: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="gtm-enter flex flex-wrap items-center gap-2 rounded-gtm-xl border border-dashed border-gtm-border bg-gtm-bg-secondary px-4 py-3 text-sm">
      <span className="text-gtm-secondary">Watch {company} for overnight signals?</span>
      <Button size="small" variant="contained" color="primary" onClick={onWatch}>
        Watch account
      </Button>
      <Button size="small" color="inherit" onClick={onDismiss}>
        Not now
      </Button>
    </div>
  );
}
