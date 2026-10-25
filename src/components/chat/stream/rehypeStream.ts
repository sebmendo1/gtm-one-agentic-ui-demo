import type { Element, ElementContent, Root } from "hast";

export type CaretState = "solid" | "blink";

const WORDS = /\s+|\S+\s*/g;

function caretElement(state: CaretState): Element {
  return {
    type: "element",
    tagName: "i",
    properties: { className: state === "blink" ? ["gtm-caret", "gtm-caret-blink"] : ["gtm-caret"], ariaHidden: "true" },
    children: [],
  };
}

/** The element holding the last visible text, so the caret sits inside that paragraph, item or code block. */
function lastTextParent(node: Root | Element): Root | Element | null {
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i]!;
    if (child.type === "text" && child.value.trim()) return node;
    if (child.type === "element") {
      const found = lastTextParent(child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Wraps each word of prose in its own `span.gtm-token`. react-markdown keys siblings by tag and
 * position, so words already on screen keep their DOM node and only newly revealed words mount
 * and play the fade. Code keeps its text nodes intact.
 */
function splitWords(node: Root | Element, inCode: boolean) {
  const children: ElementContent[] = [];
  for (const child of node.children as ElementContent[]) {
    if (child.type === "text" && !inCode && child.value.trim()) {
      for (const word of child.value.match(WORDS) ?? []) {
        children.push({ type: "element", tagName: "span", properties: { className: ["gtm-token"] }, children: [{ type: "text", value: word }] });
      }
      continue;
    }
    if (child.type === "element") splitWords(child, inCode || child.tagName === "pre" || child.tagName === "code");
    children.push(child);
  }
  node.children = children;
}

/** rehype plugin for a streaming reply: per-word fade spans plus the caret after the last word. */
export function rehypeStream(options: { caret: CaretState | null }) {
  return (tree: Root) => {
    if (options.caret) lastTextParent(tree)?.children.push(caretElement(options.caret));
    splitWords(tree, false);
  };
}
