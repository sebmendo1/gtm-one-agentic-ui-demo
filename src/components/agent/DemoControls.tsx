"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useEffect, useRef } from "react";

export function DemoControls({
  open,
  onClose,
  onSimulateOvernight,
  onReset,
  onReplay,
  onHeadsUp,
}: {
  open: boolean;
  onClose: () => void;
  onSimulateOvernight: () => void;
  onReset: () => void;
  onReplay: () => void;
  onHeadsUp: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Presenter controls</DialogTitle>
      <DialogContent className="flex flex-col gap-2 pt-1">
        <Button variant="outlined" onClick={() => { onHeadsUp(); onClose(); }}>
          Send a heads-up now
        </Button>
        <Button variant="outlined" onClick={() => { onSimulateOvernight(); onClose(); }}>
          Simulate overnight
        </Button>
        <Button variant="outlined" onClick={() => { onReplay(); onClose(); }}>
          Replay first run
        </Button>
        <Button color="inherit" onClick={() => { onReset(); onClose(); }}>
          Reset demo
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Opens demo controls with ?demo=1 or Option+D */
export function useDemoControlsHotkey(onOpen: () => void) {
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        openRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function DemoControlsTrigger({ onOpen }: { onOpen: () => void }) {
  useDemoControlsHotkey(onOpen);
  if (typeof window === "undefined") return null;
  const show = new URLSearchParams(window.location.search).get("demo") === "1";
  if (!show) return null;
  return (
    <button type="button" className="fixed bottom-4 right-4 z-40 rounded-full bg-gtm-subtle px-3 py-1 text-caption text-gtm-muted shadow-sm" onClick={onOpen}>
      Demo
    </button>
  );
}
