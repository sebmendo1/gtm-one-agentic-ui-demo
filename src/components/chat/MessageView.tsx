"use client";

import { Button, Chip, IconButton, Tooltip } from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import { useMemo, useState } from "react";
import { citedIds, messagePlainText, parseMessage, type AssistantMessage, type MessageFrame } from "@/lib/message";
import { Cite } from "./Cite";
import { ComposedBlock } from "./ComposedBlock";
import { FrameContext, copyText, useChatActions } from "./context";
import { Markdown } from "./Markdown";
import { CrmDraftCard, WIDGETS } from "./widgets";

/** Renders the message source as text and components in the order the writer placed them. */
export function MessageBody({ markdown, frame, streaming }: { markdown: string; frame: MessageFrame; streaming: boolean }) {
  const blocks = useMemo(() => parseMessage(markdown, frame, streaming), [markdown, frame, streaming]);
  return (
    <FrameContext.Provider value={frame}>
      <div className="flex min-w-0 flex-col gap-4">
        {blocks.map((block, i) => {
          if (block.kind === "text") return <Markdown key={`t${i}`} markdown={block.markdown} />;
          if (block.kind === "crm_draft") return <CrmDraftCard key={`c${i}`} {...block} />;
          if (block.kind === "compose") return <ComposedBlock key={`v${i}`} title={block.title} source={block.source} />;
          const Widget = WIDGETS[block.component];
          return <Widget key={block.component} />;
        })}
        {streaming && <span className="-mt-3 ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-gtm-text" aria-hidden />}
      </div>
    </FrameContext.Provider>
  );
}

export function MessageFooter({ message, onRetry }: { message: AssistantMessage; onRetry: () => void }) {
  const { send, busy } = useChatActions();
  const [copied, setCopied] = useState(false);
  const cited = citedIds(message.markdown);
  return (
    <FrameContext.Provider value={message}>
      <div className="mt-3 flex flex-col gap-3">
        {(cited.length > 0 || message.coverage.length > 0) && (
          <details className="group rounded-gtm-xl border border-gtm-border px-3 py-2 text-meta">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-gtm-secondary">
              <span className="font-medium">Sources & coverage</span>
              <span className="flex flex-wrap gap-0.5">
                {cited.slice(0, 4).map((id) => (
                  <Cite key={id} ids={[id]} />
                ))}
              </span>
              <span className="ml-auto text-gtm-muted group-open:rotate-180">⌄</span>
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-gtm-secondary">
              {message.coverage.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex flex-wrap items-center gap-1 text-gtm-muted">
          <Tooltip title={copied ? "Copied" : "Copy reply"}>
            <IconButton
              size="small"
              aria-label="Copy reply"
              onClick={async () => {
                if (await copyText(messagePlainText(message.markdown))) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }
              }}
            >
              {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Ask again">
            <span>
              <IconButton size="small" aria-label="Ask again" disabled={busy} onClick={onRetry}>
                <ReplayIcon fontSize="inherit" />
              </IconButton>
            </span>
          </Tooltip>
          <span className="ml-1 flex items-center gap-1 text-xs">
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 13 }} />
            {message.writer.kind === "gemini" ? `Written by Gemini (${message.writer.model})` : (message.writer.note ?? "Template reply")}
          </span>
          {message.source === "fixtures" && <Chip size="small" label="Demo fixtures" variant="outlined" className="ml-1 h-5 text-caption" />}
          {message.source === "gtm-cli" && <Chip size="small" label="Live · GTM CLI" color="success" variant="outlined" className="ml-1 h-5 text-caption" />}
        </div>

        {message.followUps.length > 0 && (
          <div className="flex flex-col items-start gap-1">
            {message.followUps.map((f) => (
              <Button
                key={f.label}
                size="small"
                color="inherit"
                disabled={busy}
                startIcon={<SubdirectoryArrowRightIcon className="text-gtm-muted" />}
                className="rounded-full px-3 font-medium text-gtm-secondary hover:bg-gtm-subtle"
                onClick={() => send(f.prompt)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </FrameContext.Provider>
  );
}
