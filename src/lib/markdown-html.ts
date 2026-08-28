/**
 * Lightweight, dependency-free HTML → Markdown converter used by the
 * URL-to-Markdown tool. Renders the post-JavaScript page HTML produced by the
 * browser engine into clean CommonMark-flavoured text.
 */

type Attrs = Record<string, string>;

interface Node {
  tag: string;
  attrs: Attrs;
  children: Node[];
  text: string;
}

const SELF_CLOSING = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);

const SKIP_TAGS = new Set([
  "script", "style", "noscript", "template", "svg", "canvas", "iframe",
  "head", "title", "meta", "link",
]);

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "aside", "header", "footer", "main",
  "nav", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table",
  "thead", "tbody", "tfoot", "tr", "td", "th", "blockquote", "pre", "hr",
  "figure", "figcaption", "form", "fieldset", "details", "summary",
]);

interface Token {
  type: "open" | "close" | "text" | "void";
  tag: string;
  attrs: Attrs;
  value: string;
}

const TAG_ATTR_RE =
  /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(raw: string): Attrs {
  const attrs: Attrs = {};
  const attrRe = new RegExp(ATTR_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(raw)) !== null) {
    const [, key, dq, sq, bare] = m;
    if (key) attrs[key] = dq ?? sq ?? bare ?? "";
  }
  return attrs;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  const re = new RegExp(TAG_ATTR_RE.source, "g");

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ type: "text", tag: "", attrs: {}, value: html.slice(lastIndex, m.index) });
    }
    const [, tag, rawAttrs, selfClose] = m;
    const lower = tag.toLowerCase();
    const voidTag = selfClose === "/" || SELF_CLOSING.has(lower);
    const attrs = parseAttrs(rawAttrs);
    tokens.push({
      type: voidTag ? "void" : "open",
      tag: lower,
      attrs,
      value: m[0],
    });
    if (voidTag) tokens.push({ type: "close", tag: lower, attrs, value: "" });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < html.length) {
    tokens.push({ type: "text", tag: "", attrs: {}, value: html.slice(lastIndex) });
  }
  return tokens;
}

function buildTree(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack: Node[] = [];
  let current: Node[] = root;

  for (const token of tokens) {
    if (token.type === "open") {
      const node: Node = { tag: token.tag, attrs: token.attrs, children: [], text: "" };
      current.push(node);
      if (SKIP_TAGS.has(token.tag)) {
        // Keep a marker so the matching close tag pops the right frame.
        node.text = `<!--skip:${token.tag}-->`;
      }
      stack.push(node);
      current = node.children;
    } else if (token.type === "close") {
      const node = stack.pop();
      if (!node) continue;
      if (node.tag !== token.tag) {
        // Tolerant mode: swallow mismatched close tags without breaking the tree.
        stack.push(node);
        current = node.children;
        continue;
      }
      current = stack.length > 0 ? stack[stack.length - 1].children : root;
    } else {
      current.push({ tag: "#text", attrs: {}, children: [], text: token.value });
    }
  }
  return root;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function escapeMd(text: string): string {
  return text
    .replace(/([\\`*_[\]{}#+.!|>])/g, "\\$1")
    .replace(/\n{3,}/g, "\n\n");
}

function inlineText(node: Node): string {
  const out: string[] = [];
  for (const child of node.children) {
    if (child.text.startsWith("<!--skip:")) continue;
    if (child.tag === "#text") {
      out.push(decodeEntities(child.text).replace(/\s+/g, " "));
      continue;
    }
    const inner = inlineText(child);
    switch (child.tag) {
      case "a": {
        const href = child.attrs.href ?? "";
        const label = inner || href;
        if (href.startsWith("#")) out.push(label);
        else out.push(`[${label}](${href})`);
        break;
      }
      case "img": {
        const src = child.attrs.src ?? "";
        const alt = child.attrs.alt ?? "";
        out.push(`![${alt}](${src})`);
        break;
      }
      case "strong":
      case "b":
        out.push(`**${inner}**`);
        break;
      case "em":
      case "i":
        out.push(`*${inner}*`);
        break;
      case "del":
      case "s":
        out.push(`~~${inner}~~`);
        break;
      case "code":
        out.push(`\`${inner.replace(/`/g, "\\`")}\``);
        break;
      case "br":
        out.push("  \n");
        break;
      case "sub":
        out.push(`<sub>${inner}</sub>`);
        break;
      case "sup":
        out.push(`<sup>${inner}</sup>`);
        break;
      default:
        out.push(inner);
    }
  }
  return out.join("");
}

function renderList(node: Node, indent: number): string {
  const isOrdered = node.tag === "ol";
  const lines: string[] = [];
  let index = 0;
  for (const li of node.children) {
    if (li.tag !== "li") continue;
    const prefix = isOrdered ? `${++index}. ` : "- ";
    const marker = "  ".repeat(indent) + prefix;
    const content: string[] = [];
    for (const child of li.children) {
      if (child.tag === "ul" || child.tag === "ol") {
        content.push("\n" + renderList(child, indent + 1));
      } else if (child.tag === "p") {
        content.push(inlineText(child));
      } else {
        content.push(inlineText(child));
      }
    }
    const joined = content.join("").trim();
    lines.push(marker + joined);
  }
  return lines.join("\n");
}

function renderTable(node: Node): string {
  const rows: string[][] = [];
  for (const child of node.children) {
    if (child.tag !== "tr") continue;
    const cells: string[] = [];
    for (const cell of child.children) {
      if (cell.tag === "td" || cell.tag === "th") {
        cells.push(inlineText(cell).trim());
      }
    }
    rows.push(cells);
  }
  if (rows.length === 0) return "";

  const width = Math.max(...rows.map((r) => r.length));
  const pad = (cells: string[]) => {
    const padded = cells.map((c, i) => (i < width ? c : ""));
    while (padded.length < width) padded.push("");
    return padded;
  };

  const header = pad(rows[0]);
  const body = rows.slice(1).map(pad);
  const lines: string[] = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

function renderBlock(node: Node): string {
  if (node.text.startsWith("<!--skip:")) return "";

  switch (node.tag) {
    case "#text": {
      const value = decodeEntities(node.text);
      return value.trim() === "" ? "" : escapeMd(value.trim());
    }
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
      const level = parseInt(node.tag.slice(1), 10);
      const text = inlineText(node).trim();
      if (!text) return "";
      const prefix = "#".repeat(level);
      return text.includes("\n") ? `${prefix} ${text.replace(/\n/g, "\n")}` : `${prefix} ${text}`;
    }
    case "p":
      return inlineText(node).trim();
    case "a":
      return inlineText(node).trim();
    case "ul":
    case "ol":
      return renderList(node, 0);
    case "li":
      return renderList(node, 0);
    case "blockquote": {
      const inner = node.children.map(renderBlock).filter(Boolean).join("\n\n");
      return inner
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    }
    case "pre": {
      const codeNode = node.children.find((c) => c.tag === "code");
      const raw = codeNode ? codeNode.text : node.children.map((c) => c.text).join("");
      const lang = codeNode?.attrs.class?.match(/language-([a-zA-Z0-9_+-]+)/)?.[1] ?? "";
      const code = decodeEntities(raw).replace(/\n$/, "");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "code": {
      return `\`${decodeEntities(node.text).replace(/`/g, "\\`")}\``;
    }
    case "hr":
      return "---";
    case "br":
      return "";
    case "table":
      return renderTable(node);
    case "img": {
      const src = node.attrs.src ?? "";
      const alt = node.attrs.alt ?? "";
      return `![${alt}](${src})`;
    }
    default: {
      const inner = node.children.map(renderBlock).filter(Boolean).join("\n\n");
      if (BLOCK_TAGS.has(node.tag)) return inner;
      return inlineText(node).trim();
    }
  }
}

/**
 * Convert a full HTML document (or fragment) into Markdown.
 * Handles the common structural elements the page-content mode produces:
 * headings, paragraphs, links, images, lists, blockquotes, code blocks,
 * horizontal rules, and simple tables.
 */
export function htmlToMarkdown(html: string): string {
  const tokens = tokenize(html);
  const tree = buildTree(tokens);
  const parts = tree.map(renderBlock).filter(Boolean);
  return parts.join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
