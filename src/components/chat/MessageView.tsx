"use client";

import { Chip, Collapse, IconButton, Tooltip } from "@mui/material";
import { ArrowPathIcon, ArrowTurnDownRightIcon, BookOpenIcon, CheckIcon, DocumentDuplicateIcon, PlusIcon } from "@heroicons/react/20/solid";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { citedIds, messagePlainText, parseMessage, pendingSection, type AssistantMessage, type MessageFrame } from "@/lib/message";
import { publicCoverage, useDebug } from "@/lib/debug";
import { repairMarkdown } from "@/lib/stream/repair";
import { Cite } from "./Cite";
import { ComposedBlock } from "./ComposedBlock";
import { FrameContext, copyText, useChatActions } from "./context";
import { Markdown } from "./Markdown";
import { CARD_DWELL_MS, CardSlot, shapeFor } from "./stream/CardSlot";
import { StandaloneCaret, caretFor } from "./stream/StreamedMarkdown";
import { useSmoothStream } from "./stream/useSmoothStream";
import { CrmDraftCard, WIDGETS } from "./widgets";

/**
 * Renders the message source as text and components in the order the writer placed them. With
 * `live`, the source streams in (docs/specs/02-design-system.md § Streaming): words fade in behind
 * a caret, and each card holds the text behind its skeleton until it has loaded.
 */
export function MessageBody({
  markdown,
  frame,
  live = false,
  done = true,
  onSettled,
}: {
  markdown: string;
  frame: MessageFrame;
  /** This reply streams in; `done` once `markdown` is final. */
  live?: boolean;
  done?: boolean;
  onSettled?: () => void;
}) {
  const holdUntil = useRef(0);
  const { text, phase } = useSmoothStream(markdown, { enabled: live, done, holdUntil });
  const streaming = phase !== "settled";
  const blocks = useMemo(() => parseMessage(text, frame, streaming), [text, frame, streaming]);
  const pending = streaming && pendingSection(text, frame);
  const cards = blocks.filter((b) => b.kind !== "text").length + (pending ? 1 : 0);

  const cardsSeen = useRef(0);
  useLayoutEffect(() => {
    if (!live || cards <= cardsSeen.current) return;
    cardsSeen.current = cards;
    holdUntil.current = performance.now() + CARD_DWELL_MS;
  }, [cards, live]);

  useEffect(() => {
    if (live && phase === "settled") onSettled?.();
  }, [live, phase, onSettled]);

  const last = blocks.at(-1);
  const caret = streaming && !pending && last?.kind === "text" ? caretFor(phase) : null;
  const animate = live;
  // Every block keeps its index as key, so a pending skeleton and the card that replaces it are one instance.
  return (
    <FrameContext.Provider value={frame}>
      <div className="flex min-w-0 flex-col gap-4">
        {blocks.map((block, i) => {
          const key = `s${i}`;
          if (block.kind === "text") {
            const tail = streaming && block === last;
            return <Markdown key={key} markdown={tail ? repairMarkdown(block.markdown) : block.markdown} animate={streaming} caret={tail ? caret : null} />;
          }
          if (block.kind === "crm_draft") {
            return (
              <CardSlot key={key} animate={animate} shape="rows">
                <CrmDraftCard {...block} />
              </CardSlot>
            );
          }
          if (block.kind === "compose") {
            return (
              <CardSlot key={key} animate={animate} shape="rows">
                <ComposedBlock title={block.title} source={block.source} />
              </CardSlot>
            );
          }
          const Widget = WIDGETS[block.component];
          return (
            <CardSlot key={key} animate={animate} shape={shapeFor(block.component)}>
              <Widget />
            </CardSlot>
          );
        })}
        {pending && <CardSlot key={`s${blocks.length}`} animate shape="rows" />}
        {streaming && blocks.length === 0 && !pending && <StandaloneCaret />}
      </div>
    </FrameContext.Provider>
  );
}

export function MessageFooter({ message, onRetry }: { message: AssistantMessage; onRetry: () => void }) {
  const { send, busy } = useChatActions();
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const debug = useDebug();
  const cited = citedIds(message.markdown);
  const hasSources = cited.length > 0 || message.coverage.length > 0;
  return (
    <FrameContext.Provider value={message}>
      <div className="mt-2 flex flex-col">
        <div className="-ml-1.5 flex flex-wrap items-center gap-x-0.5 gap-y-1 text-gtm-muted">
          <Tooltip title={copied ? "Copied" : "Copy reply"}>
            <IconButton
              size="small"
              aria-label="Copy reply"
              className="text-gtm-muted hover:text-gtm-text"
              onClick={async () => {
                if (await copyText(messagePlainText(message.markdown))) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }
              }}
            >
              {copied ? <CheckIcon className="size-4.5" /> : <DocumentDuplicateIcon className="size-4.5" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Ask again">
            <span>
              <IconButton size="small" aria-label="Ask again" disabled={busy} onClick={onRetry} className="text-gtm-muted hover:text-gtm-text">
                <ArrowPathIcon className="size-4.5" />
              </IconButton>
            </span>
          </Tooltip>
          {hasSources && (
            <button
              type="button"
              onClick={() => setSourcesOpen((o) => !o)}
              aria-expanded={sourcesOpen}
              className={`ml-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-gtm-border px-2.5 text-meta font-medium transition-colors hover:bg-gtm-hover hover:text-gtm-text pointer-coarse:h-9 ${sourcesOpen ? "bg-gtm-hover text-gtm-text" : "text-gtm-secondary"}`}
            >
              <BookOpenIcon className="size-4" />
              Sources
              {cited.length > 0 && <span className="text-gtm-muted tabular-nums">{cited.length}</span>}
            </button>
          )}
          {debug && (
            <span className="ml-auto flex items-center gap-2 pl-2 text-xs max-sm:ml-1.5 max-sm:w-full max-sm:pl-0">
              <span className="flex items-center gap-1">
                <SparklesIcon className="size-3.5" />
                {message.writer.kind === "gemini" ? `Written by Gemini (${message.writer.model})` : (message.writer.note ?? "Template reply")}
              </span>
              {message.source === "fixtures" && <Chip size="small" label="Demo fixtures" variant="outlined" className="h-5 text-caption" />}
              {message.source === "gtm-cli" && <Chip size="small" label="Live · GTM CLI" color="success" variant="outlined" className="h-5 text-caption" />}
            </span>
          )}
        </div>

        {hasSources && (
          <Collapse in={sourcesOpen}>
            <div className="mt-2 rounded-gtm-xl border border-gtm-border p-4 text-meta">
              {cited.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cited.map((id) => (
                    <Cite key={id} ids={[id]} />
                  ))}
                </div>
              )}
              {message.coverage.length > 0 && (
                <ul className={`flex flex-col gap-1.5 break-words text-gtm-secondary ${cited.length > 0 ? "mt-3" : ""}`}>
                  {message.coverage.map((line) => (
                    <li key={line}>{debug ? line : publicCoverage(line)}</li>
                  ))}
                </ul>
              )}
            </div>
          </Collapse>
        )}

        {message.followUps.length > 0 && (
          <ul className="mt-4 flex flex-col border-t border-gtm-border/70" aria-label="Follow-ups">
            {message.followUps.map((f) => (
              <li key={f.label} className="border-b border-gtm-border/70">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(f.prompt)}
                  className="group/fu flex min-h-10 w-full items-center gap-2 py-2 text-left text-sm text-gtm-secondary transition-colors hover:text-gtm-text disabled:opacity-50"
                >
                  <ArrowTurnDownRightIcon className="size-4 shrink-0 text-gtm-muted" />
                  <span className="min-w-0 flex-1">{f.label}</span>
                  <PlusIcon className="size-4 shrink-0 text-gtm-muted opacity-0 transition-opacity group-hover/fu:opacity-100 pointer-coarse:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FrameContext.Provider>
  );
}
