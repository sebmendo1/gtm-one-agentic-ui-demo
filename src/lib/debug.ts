"use client";

import { useSyncExternalStore } from "react";

// Developer details (which model wrote a reply, demo-data badges, the fixture source line) stay out of
// the default UI. `?debug=1` turns them on for the tab; `?debug=0` turns them off again.
const KEY = "gtm-debug";

function read(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("debug");
    if (param === "1" || param === "0") sessionStorage.setItem(KEY, param);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export function useDebug(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** Coverage lines as the AE sees them: the fixture emulator reads as ZoomInfo. */
export function publicCoverage(line: string): string {
  return line.replace(/^Fixture emulator \(demo data, no credits\)[^:]*:/, "ZoomInfo:");
}
