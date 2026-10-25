"use client";

import { createContext, useContext } from "react";
import type { MessageFrame } from "@/lib/message";

/** Host actions available to every component in a message (the `issueNewTurn` / `copy` pattern). */
export interface ChatActions {
  send: (prompt: string) => void;
  busy: boolean;
  /** The host already shows a primary action (proactive cards), so widget calls to action stay secondary. */
  hostHasPrimary?: boolean;
}

export const ChatActionsContext = createContext<ChatActions>({ send: () => {}, busy: false });

export function useChatActions(): ChatActions {
  return useContext(ChatActionsContext);
}

/** Proactive cards hide citation chips, source rows and the demo tag; the thread shows the full evidence. */
export const QuietEvidenceContext = createContext(false);

export const FrameContext = createContext<MessageFrame | null>(null);

export function useFrame(): MessageFrame {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("useFrame must be used inside a message");
  return frame;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Embedded webviews and unfocused documents reject the async API; the legacy path still works there.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
