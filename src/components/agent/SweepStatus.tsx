"use client";

import { Alert, Button } from "@mui/material";

export function SweepError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      I couldn&apos;t finish checking your sources. {message}
    </Alert>
  );
}
