"use client";

import { IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import { memo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkCitations } from "@/lib/message";
import { isTrustedHref } from "@/lib/safe-links";
import { Cite } from "./Cite";
import { copyText } from "./context";

function CodeBlock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre ref={ref}>{children}</pre>
      <Tooltip title={copied ? "Copied" : "Copy"}>
        <IconButton
          size="small"
          aria-label="Copy code"
          className="absolute top-1 right-1 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
          onClick={async () => {
            if (await copyText(ref.current?.innerText ?? "")) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
        </IconButton>
      </Tooltip>
    </div>
  );
}

function Removed({ what }: { what: "link" | "image" }) {
  return <span className="text-gtm-muted">({what} removed)</span>;
}

// Images never render and only allowlisted links stay clickable (docs/specs/09-guardrails.md G4).
const components: Components = {
  a: ({ href, children }) => {
    if (href?.startsWith("cite:")) return <Cite ids={href.slice(5).split(",")} />;
    if (isTrustedHref(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    }
    if (href?.startsWith("mailto:")) return <span>{children}</span>;
    return typeof children === "string" && children === href ? (
      <Removed what="link" />
    ) : (
      <span>
        {children} <Removed what="link" />
      </span>
    );
  },
  img: () => <Removed what="image" />,
  table: ({ children }) => (
    <TableContainer component={Paper} variant="outlined" className="rounded-gtm-xl">
      <Table size="small">{children}</Table>
    </TableContainer>
  ),
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableCell>{children}</TableCell>,
  td: ({ children }) => <TableCell className="text-sm">{children}</TableCell>,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
};

function urlTransform(url: string): string {
  return url.startsWith("cite:") ? url : defaultUrlTransform(url);
}

export const Markdown = memo(function Markdown({ markdown }: { markdown: string }) {
  return (
    <div className="gtm-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
        {linkCitations(markdown)}
      </ReactMarkdown>
    </div>
  );
});
