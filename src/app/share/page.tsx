"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageBody } from "@/components/chat/MessageView";
import type { MessageFrame } from "@/lib/message";
import { Markdown } from "@/components/chat/Markdown";

type SharePayload = {
  title: string;
  markdown: string;
  frame: MessageFrame;
};

function parseHash(): SharePayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) as SharePayload;
  } catch {
    return null;
  }
}

export default function SharePage() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  useEffect(() => {
    queueMicrotask(() => setPayload(parseHash()));
  }, []);

  const frame = useMemo(() => payload?.frame ?? null, [payload]);

  return (
    <main className="min-h-dvh bg-gtm-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="font-gtm-mono text-caption uppercase tracking-widest text-gtm-muted">Shared from Go-to-agent</p>
        <h1 className="mt-2 text-2xl font-semibold">{payload?.title ?? "Meeting brief"}</h1>
        {!payload || !frame ? (
          <p className="mt-6 text-gtm-secondary">This link is empty or expired. Ask your AE to share again.</p>
        ) : (
          <div className="mt-8">
            <MessageBody markdown={payload.markdown} frame={frame} />
          </div>
        )}
        <div className="mt-10 rounded-gtm-xl border border-gtm-border bg-gtm-surface p-6">
          <Markdown markdown="**Get your own Go-to-agent** — proactive meeting prep and follow-ups on ZoomInfo GTM AI." />
          <Link href="/" className="mt-4 inline-block rounded-gtm bg-gtm-cta px-4 py-2 text-sm font-medium text-white hover:bg-gtm-cta-hover">
            Start free
          </Link>
        </div>
      </div>
    </main>
  );
}
