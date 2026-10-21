// The composed-UI catalog (docs/specs/03-genui-components.md § Composed UI). The writer picks from
// these primitives; the compiler validates against them; the renderer draws only these.

/**
 * - `text`: a literal string or an expression.
 * - `data`: must be an expression reading evidence (a frame data root, loop item, or state) — never a
 *   typed-in value, so the model can't retype numbers.
 * - `expr`: any expression. `ident`: a bare name. `enum`: one of `values`. `space`: the 4px spacing scale.
 */
export type PropSpec =
  | { type: "text" | "data" | "expr" | "ident"; required?: boolean }
  | { type: "enum"; values: readonly string[]; required?: boolean }
  | { type: "number"; min: number; max: number; required?: boolean }
  | { type: "space" }
  | { type: "bool" };

export interface PrimitiveSpec {
  props: Record<string, PropSpec>;
  /** `blocks` holds other primitives; `inline` holds text and `{expr}` only; `none` is self-closing. */
  children: "blocks" | "inline" | "none";
  describe: string;
}

const space: PropSpec = { type: "space" };
const tone = (...values: string[]): PropSpec => ({ type: "enum", values });

export const SPACE_STEPS = [0, 1, 2, 3, 4, 5, 6, 8] as const;

export const COMPOSE_CATALOG = {
  box: {
    props: { direction: tone("col", "row"), gap: space, padding: space, border: { type: "bool" }, align: tone("start", "center", "end", "between") },
    children: "blocks",
    describe: "layout container; gap/padding on the 4px scale (gap={2} = 8px)",
  },
  grid: { props: { cols: { type: "number", min: 1, max: 4 }, gap: space }, children: "blocks", describe: "responsive grid, 1–4 columns" },
  title: { props: { size: tone("sm", "md", "lg") }, children: "inline", describe: "heading text" },
  text: { props: { tone: tone("default", "secondary", "muted"), size: tone("sm", "md") }, children: "inline", describe: "paragraph text" },
  eyebrow: { props: {}, children: "inline", describe: "small mono uppercase label" },
  stat: {
    props: { label: { type: "text", required: true }, value: { type: "data", required: true }, caption: { type: "text" } },
    children: "none",
    describe: "one labeled value",
  },
  badge: {
    props: { label: { type: "text", required: true }, tone: tone("neutral", "success", "warning", "emphasis") },
    children: "none",
    describe: "small status pill",
  },
  progress: {
    props: { label: { type: "text" }, value: { type: "data", required: true }, max: { type: "number", min: 1, max: 1000 } },
    children: "none",
    describe: "horizontal meter",
  },
  bars: {
    props: { data: { type: "data", required: true }, label: { type: "ident", required: true }, value: { type: "ident", required: true }, max: { type: "number", min: 1, max: 1000 } },
    children: "none",
    describe: "bar chart over an array; label/value name fields of each item",
  },
  table: {
    props: { rows: { type: "data", required: true }, columns: { type: "text", required: true } },
    children: "none",
    describe: 'table over an array; columns="field:Header,field:Header"',
  },
  list: {
    props: { items: { type: "data", required: true }, field: { type: "ident" }, ordered: { type: "bool" } },
    children: "none",
    describe: "bulleted list of an array (or one field of each item)",
  },
  each: {
    props: { of: { type: "data", required: true }, as: { type: "ident", required: true }, where: { type: "expr" }, limit: { type: "number", min: 1, max: 20 } },
    children: "blocks",
    describe: "repeat children per item; the item is in scope under `as`",
  },
  if: { props: { test: { type: "expr", required: true } }, children: "blocks", describe: "render children when test is true" },
  state: {
    props: { name: { type: "ident", required: true }, value: { type: "expr", required: true } },
    children: "none",
    describe: "declare local state (changes never call the model)",
  },
  slider: {
    props: { state: { type: "ident", required: true }, min: { type: "number", min: -1e6, max: 1e6 }, max: { type: "number", min: -1e6, max: 1e6 }, step: { type: "number", min: 0.01, max: 1e5 }, label: { type: "text" } },
    children: "none",
    describe: "number input bound to a state",
  },
  segmented: {
    props: { state: { type: "ident", required: true }, options: { type: "text", required: true } },
    children: "none",
    describe: 'choice bound to a state; options="value:Label,value:Label"',
  },
  tabs: { props: {}, children: "blocks", describe: "tabbed panels; children must be <tab>" },
  tab: { props: { label: { type: "text", required: true } }, children: "blocks", describe: "one panel inside <tabs>" },
  button: {
    props: { label: { type: "text", required: true }, action: tone("ask", "copy", "open"), message: { type: "text", required: true } },
    children: "none",
    describe: 'action: "ask" sends message as the user\'s next turn; "copy" copies it; "open" opens an https URL',
  },
  divider: { props: {}, children: "none", describe: "hairline separator" },
} as const satisfies Record<string, PrimitiveSpec>;

export type PrimitiveName = keyof typeof COMPOSE_CATALOG;

export function isPrimitive(name: string): name is PrimitiveName {
  return Object.prototype.hasOwnProperty.call(COMPOSE_CATALOG, name);
}

/** Frame data roots an expression may read, and the evidence sections behind each (for source chips). */
export const DATA_ROOTS = {
  company: ["firmographics", "tldr"],
  signals: ["intent", "scoops"],
  committee: ["members", "gaps", "risk"],
  scores: ["firmographics", "intent"],
  tech: ["stack", "plays"],
  competitor: ["comparison"],
  contact: ["profile", "engagement"],
  whyNow: ["thesis", "hooks"],
  gtmContext: ["offerings", "personas", "icp", "competitors"],
} as const;

export type DataRoot = keyof typeof DATA_ROOTS;

/** Catalog summary for the writer's prompt. */
export function catalogPrompt(): string {
  return (Object.entries(COMPOSE_CATALOG) as [string, PrimitiveSpec][])
    .map(([name, spec]) => {
      const props = Object.entries(spec.props)
        .map(([p, s]) => {
          const t = s.type === "enum" ? s.values.join("|") : s.type === "number" ? `${s.min}–${s.max}` : s.type;
          return `${p}${"required" in s && s.required ? "*" : ""}:${t}`;
        })
        .join(" ");
      return `- <${name}${props ? ` ${props}` : ""}>${spec.children === "none" ? " (self-closing)" : ""} — ${spec.describe}`;
    })
    .join("\n");
}
