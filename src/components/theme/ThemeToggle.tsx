"use client";

import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";
import { useState } from "react";

const MODES = [
  { id: "light", label: "Light", icon: <LightModeOutlinedIcon fontSize="small" /> },
  { id: "dark", label: "Dark", icon: <DarkModeOutlinedIcon fontSize="small" /> },
  { id: "system", label: "System", icon: <SettingsBrightnessOutlinedIcon fontSize="small" /> },
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
          {resolved === "dark" ? <DarkModeOutlinedIcon fontSize="small" /> : <LightModeOutlinedIcon fontSize="small" />}
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
            {mode === m.id && <CheckIcon fontSize="small" className="ml-3 text-gtm-muted" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
