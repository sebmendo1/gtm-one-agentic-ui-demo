"use client";

import { CircularProgress, IconButton, InputBase, Paper, Tooltip } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useState, type FormEvent } from "react";

export function Composer({ busy, onSend, autoFocus }: { busy: boolean; onSend: (text: string) => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useState("");
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
        className="flex items-end gap-2 rounded-[28px] py-2 pr-2 pl-5 shadow-[0_8px_28px_rgba(17,24,39,0.06)] transition-shadow focus-within:shadow-[0_10px_32px_rgba(17,24,39,0.1)] dark:shadow-none"
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
          placeholder="Ask about an account, a person, or what to do next…"
          inputProps={{ maxLength: 1000, "aria-label": "Message" }}
          className="flex-1 py-1.5 text-body leading-6"
        />
        <Tooltip title="Send">
          <span>
            <IconButton
              type="submit"
              aria-label="Send"
              disabled={busy || !draft.trim()}
              className="size-9 bg-gtm-text text-gtm-bg hover:bg-gtm-secondary disabled:bg-gtm-subtle disabled:text-gtm-muted"
            >
              {busy ? <CircularProgress size={16} color="inherit" /> : <ArrowUpwardIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </form>
  );
}
