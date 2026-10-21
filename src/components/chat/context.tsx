"use client";

import { createContext, useContext } from "react";
import type { MessageFrame } from "@/lib/message";

/** Host actions available to every component in a message (the `issueNewTurn` / `copy` pattern). */
export interface ChatActions {
  send: (prompt: string) => void;
  busy: boolean;
}

export const ChatActionsContext = createContext<ChatActions>({ send: () => {}, busy: false });

export function useChatActions(): ChatActions {
  return useContext(ChatActionsContext);
}

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
    return false;
  }
}
