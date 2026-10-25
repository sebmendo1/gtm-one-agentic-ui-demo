"use client";

import { CircularProgress, IconButton, InputBase, Paper, Tooltip, useMediaQuery } from "@mui/material";
import { ArrowUpIcon } from "@heroicons/react/20/solid";
import { useState, type FormEvent } from "react";

export function Composer({
  busy,
  onSend,
  autoFocus,
  placeholder,
  shortPlaceholder,
}: {
  busy: boolean;
  onSend: (text: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** Under 480px, where the full placeholder would wrap. */
  shortPlaceholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const narrow = useMediaQuery("(max-width:479px)");
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || busy) return;
    onSend(draft);
    setDraft("");
  };
  return (
    <form onSubmit={submit} className="w-full">
      <Paper
        variant="outlined"
        className="flex min-h-14 items-end gap-2 rounded-[28px] border-gtm-border py-2.5 pr-2.5 pl-5 shadow-[0_4px_16px_rgba(17,24,39,0.05)] transition-[box-shadow,border-color] focus-within:border-gtm-muted/50 focus-within:shadow-[0_6px_24px_rgba(17,24,39,0.08)] dark:bg-gtm-bg-secondary dark:shadow-none"
      >
        <InputBase
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          multiline
          maxRows={8}
          autoFocus={autoFocus}
          placeholder={
            narrow ? (shortPlaceholder ?? "Ask about this deal…") : (placeholder ?? "Ask about this deal, a buyer or your next step…")
          }
          // 16px on phones: iOS Safari zooms into any focused field smaller than that.
          inputProps={{ maxLength: 1000, "aria-label": "Message", enterKeyHint: "send" }}
          className="flex-1 py-1 text-body leading-7"
        />
        <Tooltip title="Send">
          <span>
            <IconButton
              type="submit"
              aria-label="Send"
              disabled={busy || !draft.trim()}
              className="size-9 rounded-full bg-gtm-text text-gtm-bg hover:bg-gtm-secondary disabled:bg-gtm-selected disabled:text-gtm-muted"
            >
              {busy ? <CircularProgress size={16} color="inherit" /> : <ArrowUpIcon className="size-5" />}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </form>
  );
}
