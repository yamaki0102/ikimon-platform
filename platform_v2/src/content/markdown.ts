function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?") ||
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed)
  ) {
    return trimmed;
  }
  return "#";
}

function renderInline(input: string): string {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let html = "";
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      html += escapeHtml(input.slice(cursor, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else if (token.startsWith("**")) {
      html += `<strong>${renderInline(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith("*")) {
      html += `<em>${renderInline(token.slice(1, -1))}</em>`;
    } else if (token.startsWith("[")) {
      const inner = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (!inner) {
        html += escapeHtml(token);
      } else {
        const label = inner[1] ?? "";
        const href = inner[2] ?? "#";
        const safeHref = sanitizeHref(href);
        const external = /^https?:\/\//i.test(safeHref);
        const rel = external ? ` rel="noreferrer"` : "";
        const target = external ? ` target="_blank"` : "";
        html += `<a href="${escapeAttribute(safeHref)}"${rel}${target}>${renderInline(label)}</a>`;
      }
    } else {
      html += escapeHtml(token);
    }
    cursor = match.index + token.length;
  }
  if (cursor < input.length) {
    html += escapeHtml(input.slice(cursor));
  }
  return html;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  let index = 0;

  const pushParagraph = (buffer: string[]): void => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    if (!text) return;
    html.push(`<p>${renderInline(text)}</p>`);
    buffer.length = 0;
  };

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const hashes = headingMatch[1] ?? "#";
      const text = headingMatch[2] ?? "";
      html.push(`<h${hashes.length}>${renderInline(text.trim())}</h${hashes.length}>`);
      index += 1;
      continue;
    }

    if (/^(-|\*)\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^(-|\*)\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^(-|\*)\s+/, "").trim());
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quotes: string[] = [];
      while (index < lines.length && /^>\s+/.test(lines[index] ?? "")) {
        quotes.push((lines[index] ?? "").replace(/^>\s+/, "").trim());
        index += 1;
      }
      html.push(`<blockquote><p>${renderInline(quotes.join(" "))}</p></blockquote>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^(#{1,6})\s+/.test(lines[index] ?? "") &&
      !/^(-|\*)\s+/.test(lines[index] ?? "") &&
      !/^\d+\.\s+/.test(lines[index] ?? "") &&
      !/^>\s+/.test(lines[index] ?? "")
    ) {
      paragraphLines.push((lines[index] ?? "").trim());
      index += 1;
    }
    pushParagraph(paragraphLines);
  }

  return html.join("\n");
}
