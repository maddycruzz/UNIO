// Minimal markdown renderer for announcement / comment bodies.
// Handles: paragraphs, **bold**, *italic*, `code`, [link](url), bare URLs, line breaks.
// Anything richer should move to a real md library later.

import React from "react";

const URL_RE = /(https?:\/\/[^\s)]+)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Tokenize bold/italic/code first, then linkify what's left.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  parts.forEach((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("*") && part.endsWith("*")) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      out.push(
        <code key={key} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4, fontSize: "0.92em" }}>
          {part.slice(1, -1)}
        </code>
      );
    } else if (/^\[[^\]]+\]\([^)]+\)$/.test(part)) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(
        <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#818CF8", textDecoration: "underline" }}>
          {m[1]}
        </a>
      );
    } else {
      // Bare URL detection.
      const subParts = part.split(URL_RE);
      subParts.forEach((sp, j) => {
        const k = `${key}-${j}`;
        if (URL_RE.test(sp)) {
          URL_RE.lastIndex = 0;
          out.push(
            <a key={k} href={sp} target="_blank" rel="noopener noreferrer" style={{ color: "#818CF8", textDecoration: "underline" }}>
              {sp}
            </a>
          );
        } else if (sp) {
          out.push(<React.Fragment key={k}>{sp}</React.Fragment>);
        }
      });
    }
  });
  return out;
}

export function Markdown({ children }: { children: string }) {
  const paragraphs = children.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, pi) => (
        <p key={pi} style={{ margin: pi === 0 ? "0 0 8px" : "8px 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {para.split("\n").map((line, li, arr) => (
            <React.Fragment key={li}>
              {renderInline(line, `p${pi}-l${li}`)}
              {li < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
