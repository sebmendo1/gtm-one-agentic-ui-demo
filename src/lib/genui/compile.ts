// Compiles a composed-UI block (`<ui:compose>` … `</ui:compose>`) into a validated tree. Shared by the
// server (validation and diagnostics) and the client (rendering). Invalid parts are removed, not fatal.
import { COMPOSE_CATALOG, DATA_ROOTS, SPACE_STEPS, isPrimitive, type DataRoot, type PrimitiveName, type PropSpec } from "./catalog";
import { parseExpr, rootsOf, type Expr } from "./expr";

export type PropValue =
  | { kind: "str"; value: string }
  | { kind: "num"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "expr"; expr: Expr };

export type UiNode =
  | { kind: "text"; value: string }
  | { kind: "expr"; expr: Expr }
  | { kind: "el"; tag: PrimitiveName; props: Record<string, PropValue>; children: UiNode[] };

export type DiagnosticCode =
  | "syntax"
  | "unknown_component"
  | "unknown_prop"
  | "invalid_literal"
  | "missing_prop"
  | "literal_data"
  | "unknown_ref"
  | "misplaced"
  | "limit";

export interface Diagnostic {
  code: DiagnosticCode;
  detail: string;
}

export interface Composed {
  title: string | null;
  nodes: UiNode[];
  states: { name: string; init: Expr }[];
  /** Frame data roots the block reads, for its source chips. */
  roots: DataRoot[];
  diagnostics: Diagnostic[];
}

const MAX_NODES = 150;
const MAX_DEPTH = 8;
const IDENT = /^[A-Za-z_][\w]*$/;

type RawAttr = { kind: "str"; value: string } | { kind: "expr"; source: string } | { kind: "bare" };
type RawNode = { kind: "text"; value: string } | { kind: "expr"; source: string } | { kind: "el"; tag: string; attrs: Record<string, RawAttr>; children: RawNode[] };

/** Reads a `{…}` expression starting at `start` (the `{`), honoring nested braces and strings. */
function readBraced(src: string, start: number): { source: string; end: number } | null {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const close = src.indexOf(c, i + 1);
      if (close < 0) return null;
      i = close;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { source: src.slice(start + 1, i), end: i + 1 };
  }
  return null;
}

function parseMarkup(src: string, diagnostics: Diagnostic[]): RawNode[] {
  const root: RawNode & { kind: "el" } = { kind: "el", tag: "#root", attrs: {}, children: [] };
  const stack: (RawNode & { kind: "el" })[] = [root];
  let text = "";
  const flush = () => {
    if (text.trim()) stack.at(-1)!.children.push({ kind: "text", value: text.replace(/\s+/g, " ") });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === "{") {
      const braced = readBraced(src, i);
      if (!braced) {
        diagnostics.push({ code: "syntax", detail: "unterminated {expression}" });
        break;
      }
      flush();
      stack.at(-1)!.children.push({ kind: "expr", source: braced.source });
      i = braced.end;
      continue;
    }
    if (c === "<" && src[i + 1] === "/") {
      const m = src.slice(i).match(/^<\/([a-z_]+)\s*>/);
      if (!m) {
        diagnostics.push({ code: "syntax", detail: "malformed closing tag" });
        i += 2;
        continue;
      }
      flush();
      const at = stack.findLastIndex((n) => n.tag === m[1]);
      if (at <= 0) diagnostics.push({ code: "syntax", detail: `</${m[1]}> has no opening tag` });
      else {
        if (at !== stack.length - 1) diagnostics.push({ code: "syntax", detail: `<${stack.at(-1)!.tag}> was not closed` });
        stack.length = at;
      }
      i += m[0].length;
      continue;
    }
    if (c === "<" && /[a-z]/.test(src[i + 1] ?? "")) {
      flush();
      const name = src.slice(i + 1).match(/^[a-z_]+/)![0];
      let j = i + 1 + name.length;
      const attrs: Record<string, RawAttr> = {};
      let selfClosing = false;
      let closed = false;
      while (j < src.length) {
        while (/\s/.test(src[j] ?? "")) j++;
        if (src.startsWith("/>", j)) {
          selfClosing = true;
          closed = true;
          j += 2;
          break;
        }
        if (src[j] === ">") {
          closed = true;
          j++;
          break;
        }
        const attr = src.slice(j).match(/^[A-Za-z_][\w-]*/);
        if (!attr) break;
        j += attr[0].length;
        if (src[j] !== "=") {
          attrs[attr[0]] = { kind: "bare" };
          continue;
        }
        j++;
        if (src[j] === '"') {
          const end = src.indexOf('"', j + 1);
          if (end < 0) break;
          attrs[attr[0]] = { kind: "str", value: src.slice(j + 1, end) };
          j = end + 1;
        } else if (src[j] === "{") {
          const braced = readBraced(src, j);
          if (!braced) break;
          attrs[attr[0]] = { kind: "expr", source: braced.source };
          j = braced.end;
        } else break;
      }
      if (!closed) {
        diagnostics.push({ code: "syntax", detail: `<${name}> tag is incomplete` });
        break;
      }
      const el: RawNode & { kind: "el" } = { kind: "el", tag: name, attrs, children: [] };
      stack.at(-1)!.children.push(el);
      if (!selfClosing) stack.push(el);
      i = j;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  if (stack.length > 1) diagnostics.push({ code: "syntax", detail: `<${stack.at(-1)!.tag}> was not closed` });
  return root.children;
}

interface Ctx {
  diagnostics: Diagnostic[];
  states: Set<string>;
  roots: Set<DataRoot>;
  nodes: number;
}

function exprOf(source: string, ctx: Ctx, where: string): Expr | null {
  try {
    return parseExpr(source);
  } catch (error) {
    ctx.diagnostics.push({ code: "syntax", detail: `${where}: ${(error as Error).message}` });
    return null;
  }
}

/** Every identifier must be a data root, a declared state, or a loop variable in scope. */
function checkRefs(expr: Expr, scope: Set<string>, ctx: Ctx, where: string): boolean {
  for (const name of rootsOf(expr)) {
    if (name in DATA_ROOTS) ctx.roots.add(name as DataRoot);
    else if (!scope.has(name) && !ctx.states.has(name)) {
      ctx.diagnostics.push({ code: "unknown_ref", detail: `${where}: "${name}" is not frame data, a state, or a loop item` });
      return false;
    }
  }
  return true;
}

function literalNumber(raw: RawAttr, ctx: Ctx, where: string): number | null {
  const source = raw.kind === "str" ? raw.value : raw.kind === "expr" ? raw.source : "";
  const n = Number(source.trim());
  if (source.trim() === "" || !Number.isFinite(n)) {
    ctx.diagnostics.push({ code: "invalid_literal", detail: `${where} must be a number` });
    return null;
  }
  return n;
}

/** Returns the validated value, null to drop the prop, or "drop" to drop the whole element. */
function checkProp(spec: PropSpec, raw: RawAttr, scope: Set<string>, ctx: Ctx, where: string): PropValue | null | "drop" {
  switch (spec.type) {
    case "bool":
      if (raw.kind === "bare") return { kind: "bool", value: true };
      if (raw.kind === "str" && (raw.value === "true" || raw.value === "false")) return { kind: "bool", value: raw.value === "true" };
      if (raw.kind === "expr" && /^\s*(true|false)\s*$/.test(raw.source)) return { kind: "bool", value: raw.source.trim() === "true" };
      ctx.diagnostics.push({ code: "invalid_literal", detail: `${where} must be true or false` });
      return null;
    case "enum": {
      const value = raw.kind === "str" ? raw.value : raw.kind === "expr" ? raw.source.trim().replace(/^["']|["']$/g, "") : "";
      if ((spec.values as readonly string[]).includes(value)) return { kind: "str", value };
      ctx.diagnostics.push({ code: "invalid_literal", detail: `${where} must be one of ${spec.values.join(", ")}` });
      return null;
    }
    case "number":
    case "space": {
      const n = literalNumber(raw, ctx, where);
      if (n === null) return null;
      const ok = spec.type === "space" ? (SPACE_STEPS as readonly number[]).includes(n) : n >= spec.min && n <= spec.max;
      if (!ok) {
        ctx.diagnostics.push({ code: "invalid_literal", detail: `${where}=${n} is out of range` });
        return null;
      }
      return { kind: "num", value: n };
    }
    case "ident": {
      const name = raw.kind === "str" ? raw.value : raw.kind === "expr" ? raw.source.trim() : "";
      if (IDENT.test(name)) return { kind: "str", value: name };
      ctx.diagnostics.push({ code: "invalid_literal", detail: `${where} must be a plain name` });
      return null;
    }
    case "text":
      if (raw.kind === "str") return { kind: "str", value: raw.value };
      if (raw.kind === "bare") return null;
    // falls through: an expression is fine for text
    case "expr":
    case "data": {
      if (raw.kind !== "expr") {
        if (spec.type === "data") {
          ctx.diagnostics.push({ code: "literal_data", detail: `${where} must be bound to frame data, not typed in` });
          return "drop";
        }
        ctx.diagnostics.push({ code: "invalid_literal", detail: `${where} must be an {expression}` });
        return null;
      }
      const expr = exprOf(raw.source, ctx, where);
      if (!expr) return spec.type === "data" ? "drop" : null;
      if (!checkRefs(expr, scope, ctx, where)) return "drop";
      if (spec.type === "data" && rootsOf(expr).size === 0) {
        ctx.diagnostics.push({ code: "literal_data", detail: `${where} must read frame data, not a constant` });
        return "drop";
      }
      return { kind: "expr", expr };
    }
  }
}

function checkNode(raw: RawNode, scope: Set<string>, ctx: Ctx, depth: number, inline: boolean): UiNode | null {
  if (++ctx.nodes > MAX_NODES) {
    if (ctx.nodes === MAX_NODES + 1) ctx.diagnostics.push({ code: "limit", detail: `more than ${MAX_NODES} nodes; the rest was dropped` });
    return null;
  }
  if (raw.kind === "text") return { kind: "text", value: raw.value };
  if (raw.kind === "expr") {
    const expr = exprOf(raw.source, ctx, "{expression}");
    return expr && checkRefs(expr, scope, ctx, "{expression}") ? { kind: "expr", expr } : null;
  }
  if (inline) {
    ctx.diagnostics.push({ code: "misplaced", detail: `<${raw.tag}> can't go inside text` });
    return null;
  }
  if (depth > MAX_DEPTH) {
    ctx.diagnostics.push({ code: "limit", detail: `nesting deeper than ${MAX_DEPTH}` });
    return null;
  }
  if (!isPrimitive(raw.tag)) {
    ctx.diagnostics.push({ code: "unknown_component", detail: `<${raw.tag}> is not in the catalog` });
    return null;
  }
  const spec = COMPOSE_CATALOG[raw.tag];
  const specProps = spec.props as Record<string, PropSpec>;
  const props: Record<string, PropValue> = {};
  const childScope = new Set(scope);
  if (raw.tag === "each" && raw.attrs.as?.kind === "str" && IDENT.test(raw.attrs.as.value)) childScope.add(raw.attrs.as.value);

  for (const [name, value] of Object.entries(raw.attrs)) {
    const propSpec = specProps[name];
    if (!propSpec) {
      ctx.diagnostics.push({ code: "unknown_prop", detail: `<${raw.tag}> has no "${name}"` });
      continue;
    }
    const checked = checkProp(propSpec, value, raw.tag === "each" && name === "where" ? childScope : scope, ctx, `<${raw.tag} ${name}>`);
    if (checked === "drop") return null;
    if (checked) props[name] = checked;
  }
  for (const [name, propSpec] of Object.entries(specProps)) {
    if ("required" in propSpec && propSpec.required && !props[name]) {
      ctx.diagnostics.push({ code: "missing_prop", detail: `<${raw.tag}> needs "${name}"` });
      return null;
    }
  }
  if ((raw.tag === "slider" || raw.tag === "segmented") && props.state?.kind === "str" && !ctx.states.has(props.state.value)) {
    ctx.diagnostics.push({ code: "unknown_ref", detail: `<${raw.tag}> binds to undeclared state "${props.state.value}"` });
    return null;
  }

  const children: UiNode[] = [];
  if (spec.children !== "none") {
    for (const child of raw.children) {
      if (raw.tag === "tabs" && !(child.kind === "el" && child.tag === "tab")) {
        if (child.kind !== "text") ctx.diagnostics.push({ code: "misplaced", detail: "<tabs> only holds <tab> panels" });
        continue;
      }
      if (child.kind === "el" && child.tag === "tab" && raw.tag !== "tabs") {
        ctx.diagnostics.push({ code: "misplaced", detail: "<tab> must be inside <tabs>" });
        continue;
      }
      const node = checkNode(child, childScope, ctx, depth + 1, spec.children === "inline");
      if (node) children.push(node);
    }
  }
  return { kind: "el", tag: raw.tag, props, children };
}

function collectStates(nodes: RawNode[], out: Map<string, string>) {
  for (const node of nodes) {
    if (node.kind !== "el") continue;
    if (node.tag === "state" && node.attrs.name?.kind === "str" && IDENT.test(node.attrs.name.value) && node.attrs.value?.kind === "expr") {
      out.set(node.attrs.name.value, node.attrs.value.source);
    }
    collectStates(node.children, out);
  }
}

export function countElements(nodes: UiNode[]): number {
  return nodes.reduce((n, node) => n + (node.kind === "el" ? 1 + countElements(node.children) : 0), 0);
}

export function compileComposed(source: string, title: string | null = null): Composed {
  const diagnostics: Diagnostic[] = [];
  const raw = parseMarkup(source, diagnostics);
  const stateSources = new Map<string, string>();
  collectStates(raw, stateSources);
  const ctx: Ctx = { diagnostics, states: new Set(stateSources.keys()), roots: new Set(), nodes: 0 };

  const states: Composed["states"] = [];
  for (const [name, init] of stateSources) {
    const expr = exprOf(init, ctx, `<state ${name}>`);
    if (expr && checkRefs(expr, new Set(), ctx, `<state ${name}>`)) states.push({ name, init: expr });
    else ctx.states.delete(name);
  }

  const nodes = raw
    .map((node) => checkNode(node, new Set(), ctx, 1, false))
    .filter((n): n is UiNode => n !== null && !(n.kind === "el" && n.tag === "state"));
  const visible = nodes.some((n) => n.kind !== "text" || n.value.trim());
  return { title, nodes: visible ? nodes : [], states, roots: [...ctx.roots], diagnostics };
}
