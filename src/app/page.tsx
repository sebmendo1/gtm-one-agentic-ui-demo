"use client";

import { Fab, IconButton, Tooltip, Zoom } from "@mui/material";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import Groups2OutlinedIcon from "@mui/icons-material/Groups2Outlined";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AssistantTurn, UserBubble } from "@/components/chat/AssistantTurn";
import { Composer } from "@/components/chat/Composer";
import { ChatActionsContext } from "@/components/chat/context";
import { BrandMark, Sidebar } from "@/components/chat/Sidebar";
import { useChat } from "@/components/chat/useChat";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const EXAMPLES: { label: string; hint: string; prompt: string; icon: ReactNode }[] = [
  {
    label: "Brief me on Snowflake",
    hint: "Before a QBR — intent, scoops, next action",
    prompt: "Account research brief for Snowflake before a pre-call QBR — intent, scoops, and next action",
    icon: <ApartmentOutlinedIcon fontSize="small" />,
  },
  {
    label: "Who's in the deal at Stripe?",
    hint: "Buying committee and multithread risk",
    prompt: "Buying committee map at Stripe — who is engaged and multithread risk",
    icon: <Groups2OutlinedIcon fontSize="small" />,
  },
  {
    label: "Why reach out to Stripe now?",
    hint: "Timing thesis with outreach hooks",
    prompt: "Why now case for reaching out to Stripe this week with timing hooks",
    icon: <BoltOutlinedIcon fontSize="small" />,
  },
  {
    label: "Score Snowflake",
    hint: "ICP fit and in-market, explained",
    prompt: "Score accounts — tier Snowflake by ICP fit and in-market signals",
    icon: <SpeedOutlinedIcon fontSize="small" />,
  },
  {
    label: "Snowflake's tech stack",
    hint: "Technographics and displacement plays",
    prompt: "Tech stack snapshot for Snowflake with displacement plays",
    icon: <MemoryOutlinedIcon fontSize="small" />,
  },
  {
    label: "Us vs Gong at Snowflake",
    hint: "Competitive comparison",
    prompt: "Compare us vs Gong at Snowflake for a competitive deal",
    icon: <BusinessCenterOutlinedIcon fontSize="small" />,
  },
  {
    label: "Email Jordan Lee",
    hint: "A first email from what we know",
    prompt: "Draft a short first email to Jordan Lee at Snowflake",
    icon: <MailOutlineIcon fontSize="small" />,
  },
  {
    label: "Connect live data",
    hint: "Sign in to the bundled GTM CLI",
    prompt: "How do I sign in to the GTM CLI so this app uses live ZoomInfo data?",
    icon: <TerminalOutlinedIcon fontSize="small" />,
  },
];

export default function Home() {
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const turns = chat.active?.turns ?? [];
  const lastTurn = turns.at(-1);
  const scrollKey = `${chat.activeId}:${turns.length}:${lastTurn?.status}:${lastTurn?.draft.length ?? 0}:${lastTurn?.activity.steps.length ?? 0}`;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTo({ top: el.scrollHeight });
  }, [scrollKey, atBottom]);

  const closeOnMobile = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <ChatActionsContext.Provider value={{ send: chat.send, busy: chat.busy }}>
      <main className="flex h-dvh overflow-hidden bg-gtm-bg">
        {sidebarOpen && (
          <>
            <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
            <div className="z-30 h-full max-md:fixed max-md:inset-y-0 max-md:left-0">
              <Sidebar
                conversations={chat.conversations}
                activeId={chat.activeId}
                onOpen={(id) => {
                  chat.setActiveId(id);
                  setAtBottom(true);
                  closeOnMobile();
                }}
                onNew={() => {
                  chat.setActiveId(null);
                  closeOnMobile();
                }}
                onRemove={chat.remove}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </>
        )}

        <section className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 px-3">
            {!sidebarOpen && (
              <>
                <Tooltip title="Open sidebar">
                  <IconButton size="small" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}>
                    <ViewSidebarOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <BrandMark />
              </>
            )}
            <p className="min-w-0 truncate px-1 text-sm font-medium text-gtm-secondary">{chat.active?.title ?? ""}</p>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>

          {turns.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="m-auto flex w-full max-w-3xl flex-col items-center px-4 py-10">
                <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  What GTM decision do you need?
                </h1>
                <p className="mb-8 max-w-lg text-center text-body text-gtm-secondary">
                  Ask in plain words. I research with the GTM CLI, ask before spending credits, and show cards, tables, and
                  scores only when they help.
                </p>
                <Composer busy={chat.busy} onSend={chat.send} autoFocus />
                <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example.label}
                      type="button"
                      disabled={chat.busy}
                      onClick={() => chat.send(example.prompt)}
                      className="flex items-start gap-3 rounded-gtm-xl border border-gtm-border bg-gtm-surface px-4 py-3 text-left transition-colors hover:bg-gtm-subtle disabled:opacity-50"
                    >
                      <span className="mt-0.5 flex text-gtm-secondary">{example.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{example.label}</span>
                        <span className="block truncate text-meta text-gtm-muted">{example.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
                }}
              >
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-4 pb-10">
                  {turns.map((turn) => (
                    <div key={turn.id} className="flex flex-col gap-5">
                      <UserBubble text={turn.prompt} />
                      <AssistantTurn
                        turn={turn}
                        busy={chat.busy}
                        onAnswer={(q, o) => chat.active && chat.answerQuestion(chat.active.id, turn, q, o)}
                        onDecide={(d) => chat.active && chat.decide(chat.active.id, turn, d)}
                        onRetry={() => chat.send(turn.prompt)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Zoom in={!atBottom}>
                <Fab
                  size="small"
                  aria-label="Scroll to bottom"
                  onClick={() => {
                    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                    setAtBottom(true);
                  }}
                  className="absolute bottom-28 left-1/2 -translate-x-1/2 border border-gtm-border bg-gtm-surface text-gtm-text shadow-sm hover:bg-gtm-subtle"
                >
                  <ArrowDownwardIcon fontSize="small" />
                </Fab>
              </Zoom>
              <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3">
                <Composer busy={chat.busy} onSend={chat.send} />
                <p className="mt-2 text-center text-caption text-gtm-muted">
                  Replies cite GTM CLI evidence. Paid research always asks first.
                </p>
              </div>
            </>
          )}
        </section>
      </main>
    </ChatActionsContext.Provider>
  );
}
