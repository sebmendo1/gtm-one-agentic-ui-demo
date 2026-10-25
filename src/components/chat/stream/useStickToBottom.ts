"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Scrolling down to within this of the bottom re-attaches. */
const REATTACH_PX = 24;
const UP_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);

/**
 * Sticky auto-scroll for a streaming timeline (docs/specs/02-design-system.md § Streaming). While
 * attached, every growth of the content keeps the newest line in view. Any upward gesture detaches
 * at once. Scrolling back down to the bottom, or calling `stick`, re-attaches.
 */
export function useStickToBottom() {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  /** Content grew while detached: the jump button pulses. */
  const [unread, setUnread] = useState(false);
  const stuck = useRef(true);

  const detach = useCallback(() => {
    if (!stuck.current) return;
    stuck.current = false;
    setAtBottom(false);
  }, []);

  const stick = useCallback(
    (behavior: ScrollBehavior = "instant") => {
      stuck.current = true;
      setAtBottom(true);
      setUnread(false);
      scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior });
    },
    [scrollEl],
  );

  useEffect(() => {
    if (!scrollEl || !contentEl) return;
    let height = contentEl.offsetHeight;
    let lastTop = scrollEl.scrollTop;
    let dragging = false;
    let touchY = 0;

    const observer = new ResizeObserver(() => {
      const next = contentEl.offsetHeight;
      const grew = next > height;
      height = next;
      if (stuck.current) scrollEl.scrollTop = scrollEl.scrollHeight;
      else if (grew) setUnread(true);
    });
    observer.observe(contentEl);

    const onScroll = () => {
      const top = scrollEl.scrollTop;
      const gap = scrollEl.scrollHeight - top - scrollEl.clientHeight;
      if (top > lastTop && gap <= REATTACH_PX && !stuck.current) {
        stuck.current = true;
        setAtBottom(true);
        setUnread(false);
      } else if (top < lastTop && dragging) {
        detach();
      }
      lastTop = top;
    };
    const canScrollUp = () => scrollEl.scrollTop > 0;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && canScrollUp()) detach();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if ((e.touches[0]?.clientY ?? 0) > touchY + 2 && canScrollUp()) detach();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (UP_KEYS.has(e.key) && canScrollUp()) detach();
    };
    // A press on the container itself is its scrollbar; content clicks land on children.
    const onPointerDown = (e: PointerEvent) => {
      dragging = e.target === scrollEl;
    };
    const onPointerUp = () => {
      dragging = false;
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    scrollEl.addEventListener("wheel", onWheel, { passive: true });
    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchmove", onTouchMove, { passive: true });
    scrollEl.addEventListener("keydown", onKeyDown);
    scrollEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      observer.disconnect();
      scrollEl.removeEventListener("scroll", onScroll);
      scrollEl.removeEventListener("wheel", onWheel);
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove);
      scrollEl.removeEventListener("keydown", onKeyDown);
      scrollEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [scrollEl, contentEl, detach]);

  return { scrollRef: setScrollEl, contentRef: setContentEl, atBottom, unread: unread && !atBottom, stick, detach };
}
