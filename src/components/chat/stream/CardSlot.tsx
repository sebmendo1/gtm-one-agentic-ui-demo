"use client";

import { Card, CardContent, Skeleton } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import type { UiComponentId } from "@/lib/message";

/** How long a streamed card shows its skeleton before the real card fades in. */
export const CARD_DWELL_MS = 650;

export type CardShape = "tiles" | "rows";

const TILE_CARDS: ReadonlySet<UiComponentId> = new Set(["company", "scores", "intent"]);

export function shapeFor(component: UiComponentId): CardShape {
  return TILE_CARDS.has(component) ? "tiles" : "rows";
}

/** Same container as `WidgetCard`, filled with a shimmering outline of the card's layout. */
export function CardSkeleton({ shape }: { shape: CardShape }) {
  return (
    <Card className="gtm-enter w-full" role="status" aria-label="Loading card">
      <CardContent className="p-4 last:pb-4 sm:p-5 sm:last:pb-5" aria-hidden>
        <Skeleton animation="wave" variant="text" width={72} height={16} />
        <Skeleton animation="wave" variant="text" width="42%" height={28} className="mt-0.5" />
        {shape === "tiles" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} animation="wave" variant="rounded" height={56} className="rounded-gtm" />
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {["62%", "48%", "56%"].map((width) => (
              <div key={width} className="flex items-center gap-3">
                <Skeleton animation="wave" variant="circular" width={32} height={32} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <Skeleton animation="wave" variant="text" width={width} height={18} />
                  <Skeleton animation="wave" variant="text" width="32%" height={16} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-1.5">
          <Skeleton animation="wave" variant="rounded" width={104} height={20} className="rounded-full" />
          <Skeleton animation="wave" variant="rounded" width={88} height={20} className="rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A GenUI card's place in a streaming reply. While `animate` is on, the skeleton shows for at
 * least CARD_DWELL_MS and until the card's content exists; otherwise the card renders directly.
 */
export function CardSlot({ animate, shape, children }: { animate: boolean; shape: CardShape; children?: ReactNode }) {
  const [loaded, setLoaded] = useState(!animate);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setLoaded(true), CARD_DWELL_MS);
    return () => clearTimeout(timer);
  }, [loaded]);
  return loaded && children ? children : <CardSkeleton shape={shape} />;
}
