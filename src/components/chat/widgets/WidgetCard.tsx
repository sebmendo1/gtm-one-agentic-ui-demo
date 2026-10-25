"use client";

import { Card, CardContent, Chip, Typography } from "@mui/material";
import { useContext, type ReactNode } from "react";
import { SourceChips } from "../Cite";
import { QuietEvidenceContext, useFrame } from "../context";

export function WidgetCard({
  eyebrow,
  title,
  subtitle,
  sources,
  action,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  sources?: string[];
  action?: ReactNode;
  children: ReactNode;
}) {
  const frame = useFrame();
  const quiet = useContext(QuietEvidenceContext);
  return (
    <Card className="gtm-enter w-full">
      <CardContent className="p-4 last:pb-4 sm:p-5 sm:last:pb-5">
        {/* flex-auto sizes the title to its full width, so the action wraps below instead of truncating it. */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-auto">
            <div className="flex items-center gap-2">
              <span className="gtm-eyebrow whitespace-nowrap">{eyebrow}</span>
              {frame.source === "fixtures" && !quiet && (
                <Chip size="small" label="Demo data" variant="outlined" className="h-5 text-caption text-gtm-muted" />
              )}
            </div>
            <Typography variant="h6" component="div" className="mt-0.5 truncate">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" component="div">
                {subtitle}
              </Typography>
            )}
          </div>
          {action && <div className="max-w-full shrink-0">{action}</div>}
        </div>
        {children}
        <SourceChips ids={sources} />
      </CardContent>
    </Card>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
