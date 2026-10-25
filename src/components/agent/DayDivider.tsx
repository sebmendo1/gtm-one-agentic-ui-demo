"use client";

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-gtm-border/70" />
      <span className="text-meta font-medium text-gtm-muted">{label}</span>
      <div className="h-px flex-1 bg-gtm-border/70" />
    </div>
  );
}
