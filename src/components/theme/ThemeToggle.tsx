"use client";

import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/20/solid";
import { useState } from "react";

const MODES = [
  { id: "light", label: "Light", icon: <SunIcon className="size-5" /> },
  { id: "dark", label: "Dark", icon: <MoonIcon className="size-5" /> },
  { id: "system", label: "System", icon: <ComputerDesktopIcon className="size-5" /> },
] as const;

/** App-wide appearance. MUI stores the choice and sets `.light` / `.dark` on <html>. */
export function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const resolved = mode === "system" ? systemMode : mode;
  return (
    <>
      <Tooltip title="Appearance">
        <IconButton aria-label="Appearance" size="small" onClick={(e) => setAnchor(e.currentTarget)} disabled={!mode}>
          {resolved === "dark" ? <MoonIcon className="size-5" /> : <SunIcon className="size-5" />}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: "min-w-40 mt-1" } }}
      >
        {MODES.map((m) => (
          <MenuItem
            key={m.id}
            selected={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setAnchor(null);
            }}
          >
            <ListItemIcon>{m.icon}</ListItemIcon>
            <ListItemText>{m.label}</ListItemText>
            {mode === m.id && <CheckIcon className="ml-3 size-4 text-gtm-muted" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
