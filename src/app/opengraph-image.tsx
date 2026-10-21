import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: agentic account research on ZoomInfo GTM AI`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Light-theme GTM tokens (docs/specs/02-design-system.md).
const TOKENS = { bg: "#ffffff", bgSecondary: "#f8f9ff", text: "#111827", secondary: "#4b5563", border: "#e5e7eb", cta: "#df201a" };

export default async function Image() {
  const [semiBold, regular, mono] = await Promise.all(
    ["Figtree-SemiBold.ttf", "Figtree-Regular.ttf", "JetBrainsMono-Medium.ttf"].map((file) => readFile(join(process.cwd(), "assets", file))),
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: TOKENS.bgSecondary,
          fontFamily: "Figtree",
          color: TOKENS.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: TOKENS.cta,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "JetBrains Mono",
              fontSize: 30,
              fontWeight: 500,
            }}
          >
            G
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em" }}>GTM AI</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: 980 }}>
            What GTM decision do you need?
          </div>
          <div style={{ fontSize: 30, color: TOKENS.secondary, lineHeight: 1.4, maxWidth: 960 }}>
            Account research on ZoomInfo GTM AI: cited answers, one approval before credits, cards only when they help.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["Gemini", "ZoomInfo GTM CLI", "TypeSafe Jev"].map((label) => (
            <div
              key={label}
              style={{
                fontSize: 24,
                padding: "8px 20px",
                borderRadius: 999,
                border: `1px solid ${TOKENS.border}`,
                background: TOKENS.bg,
                color: TOKENS.secondary,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: semiBold, weight: 600, style: "normal" },
        { name: "Figtree", data: regular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
