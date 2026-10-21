// Expressions inside composed UI (`{company.employees}`, `{weight * scores.fit / 100}`). A small,
// side-effect-free language: literals, paths, arithmetic, comparisons, logic, ternaries, and a few
// pure functions. Never `eval`; prototype keys are unreachable.

export type Expr =
  | { k: "lit"; v: string | number | boolean | null }
  | { k: "id"; name: string }
  | { k: "get"; obj: Expr; key: Expr }
  | { k: "un"; op: "!" | "-"; arg: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "cond"; test: Expr; yes: Expr; no: Expr }
  | { k: "call"; fn: string; args: Expr[] };

export const FUNCTIONS = ["round", "floor", "ceil", "abs", "min", "max", "len", "join", "fmt", "pct", "lower", "upper"] as const;
type Fn = (typeof FUNCTIONS)[number];

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type Token = { t: "num" | "str" | "id" | "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = src.slice(i).match(/^\d*\.?\d+(?:e[+-]?\d+)?/i)!;
      out.push({ t: "num", v: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\" && j + 1 < src.length) j++;
        s += src[j];
        j++;
      }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z_$][\w$]*/)!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 3) === "===" || src.slice(i, i + 3) === "!==" ? src.slice(i, i + 3) : src.slice(i, i + 2);
    if (["===", "!==", "==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two.length === 3 ? two.slice(0, 2) : two });
      i += two.length;
      continue;
    }
    if ("+-*/%<>!?:.,()[]".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`unexpected "${c}"`);
  }
  return out;
}

export function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`expected "${v}"`);
    pos++;
  };

  const binary = (next: () => Expr, ops: string[]) => (): Expr => {
    let left = next();
    while (peek()?.t === "op" && ops.includes(peek()!.v)) {
      const op = tokens[pos++]!.v;
      left = { k: "bin", op, a: left, b: next() };
    }
    return left;
  };

  function primary(): Expr {
    const tok = tokens[pos++];
    if (!tok) throw new Error("unexpected end");
    if (tok.t === "num") return { k: "lit", v: Number(tok.v) };
    if (tok.t === "str") return { k: "lit", v: tok.v };
    if (tok.t === "id") {
      if (tok.v === "true" || tok.v === "false") return { k: "lit", v: tok.v === "true" };
      if (tok.v === "null") return { k: "lit", v: null };
      if (isOp("(")) {
        if (!(FUNCTIONS as readonly string[]).includes(tok.v)) throw new Error(`unknown function ${tok.v}`);
        pos++;
        const args: Expr[] = [];
        if (!isOp(")")) {
          do args.push(expr());
          while (isOp(",") && ++pos);
        }
        expect(")");
        return { k: "call", fn: tok.v, args };
      }
      return { k: "id", name: tok.v };
    }
    if (tok.v === "(") {
      const inner = expr();
      expect(")");
      return inner;
    }
    throw new Error(`unexpected "${tok.v}"`);
  }

  function postfix(): Expr {
    let node = primary();
    for (;;) {
      if (isOp(".")) {
        pos++;
        const name = tokens[pos++];
        if (name?.t !== "id") throw new Error("expected property name");
        node = { k: "get", obj: node, key: { k: "lit", v: name.v } };
      } else if (isOp("[")) {
        pos++;
        const key = expr();
        expect("]");
        node = { k: "get", obj: node, key };
      } else return node;
    }
  }

  function unary(): Expr {
    if (isOp("!") || isOp("-")) {
      const op = tokens[pos++]!.v as "!" | "-";
      return { k: "un", op, arg: unary() };
    }
    return postfix();
  }

  const mul = binary(unary, ["*", "/", "%"]);
  const add = binary(mul, ["+", "-"]);
  const cmp = binary(add, ["<", "<=", ">", ">="]);
  const eq = binary(cmp, ["==", "!="]);
  const and = binary(eq, ["&&"]);
  const or = binary(and, ["||"]);

  function expr(): Expr {
    const test = or();
    if (!isOp("?")) return test;
    pos++;
    const yes = expr();
    expect(":");
    return { k: "cond", test, yes, no: expr() };
  }

  const result = expr();
  if (pos < tokens.length) throw new Error(`unexpected "${tokens[pos]!.v}"`);
  return result;
}

/** Root identifiers an expression reads (`company`, a loop variable, a state name). */
export function rootsOf(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.k) {
    case "id":
      out.add(e.name);
      break;
    case "get":
      rootsOf(e.obj, out);
      if (e.key.k !== "lit") rootsOf(e.key, out);
      break;
    case "un":
      rootsOf(e.arg, out);
      break;
    case "bin":
      rootsOf(e.a, out);
      rootsOf(e.b, out);
      break;
    case "cond":
      rootsOf(e.test, out);
      rootsOf(e.yes, out);
      rootsOf(e.no, out);
      break;
    case "call":
      e.args.forEach((a) => rootsOf(a, out));
      break;
  }
  return out;
}

export type Scope = Record<string, unknown>;

function getKey(obj: unknown, key: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    if (key === "length") return obj.length;
    return typeof key === "number" ? obj[key] : undefined;
  }
  if (typeof obj === "string" && key === "length") return obj.length;
  if (typeof obj !== "object" || typeof key !== "string" || BLOCKED_KEYS.has(key)) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,$%]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return "—";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map(formatValue).join(", ");
  if (typeof v === "object") return "—";
  return String(v);
}

const FNS: Record<Fn, (...args: unknown[]) => unknown> = {
  round: (x, d) => {
    const f = 10 ** Math.max(0, Math.min(4, num(d ?? 0) || 0));
    return Math.round(num(x) * f) / f;
  },
  floor: (x) => Math.floor(num(x)),
  ceil: (x) => Math.ceil(num(x)),
  abs: (x) => Math.abs(num(x)),
  min: (...xs) => Math.min(...xs.map(num)),
  max: (...xs) => Math.max(...xs.map(num)),
  len: (x) => (Array.isArray(x) || typeof x === "string" ? x.length : 0),
  join: (x, sep) => (Array.isArray(x) ? x.map(formatValue).join(typeof sep === "string" ? sep : ", ") : formatValue(x)),
  fmt: (x) => formatValue(x),
  pct: (x) => `${Math.round(num(x))}%`,
  lower: (x) => formatValue(x).toLowerCase(),
  upper: (x) => formatValue(x).toUpperCase(),
};

function evaluate(e: Expr, scope: Scope): unknown {
  switch (e.k) {
    case "lit":
      return e.v;
    case "id":
      return Object.prototype.hasOwnProperty.call(scope, e.name) ? scope[e.name] : undefined;
    case "get":
      return getKey(evaluate(e.obj, scope), evaluate(e.key, scope));
    case "un": {
      const v = evaluate(e.arg, scope);
      return e.op === "!" ? !v : -num(v);
    }
    case "cond":
      return evaluate(e.test, scope) ? evaluate(e.yes, scope) : evaluate(e.no, scope);
    case "call":
      return FNS[e.fn as Fn](...e.args.map((a) => evaluate(a, scope)));
    case "bin": {
      if (e.op === "&&") return evaluate(e.a, scope) && evaluate(e.b, scope);
      if (e.op === "||") return evaluate(e.a, scope) || evaluate(e.b, scope);
      const a = evaluate(e.a, scope);
      const b = evaluate(e.b, scope);
      switch (e.op) {
        case "+":
          return typeof a === "string" || typeof b === "string" ? formatValue(a) + formatValue(b) : num(a) + num(b);
        case "-":
          return num(a) - num(b);
        case "*":
          return num(a) * num(b);
        case "/":
          return num(b) === 0 ? NaN : num(a) / num(b);
        case "%":
          return num(a) % num(b);
        case "<":
          return num(a) < num(b);
        case "<=":
          return num(a) <= num(b);
        case ">":
          return num(a) > num(b);
        case ">=":
          return num(a) >= num(b);
        case "==":
          return a === b || (a != null && b != null && String(a) === String(b));
        case "!=":
          return !(a === b || (a != null && b != null && String(a) === String(b)));
      }
      return undefined;
    }
  }
}

/** Evaluates safely: an expression that throws yields `undefined` and renders nothing. */
export function evalExpr(e: Expr, scope: Scope): unknown {
  try {
    return evaluate(e, scope);
  } catch {
    return undefined;
  }
}
