import { useState } from "react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  tag?: string;        // small uppercase badge, e.g. "FROM TRADES"
  summary?: string;    // right-aligned hint shown collapsed, e.g. "3 traits"
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A lightweight expand/collapse section used to keep dense supporting detail
 * (behavioral DNA, holdings, capital curve) tucked away until the RM wants it.
 */
export function Collapsible({ title, tag, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"cp-collapse" + (open ? " open" : "")}>
      <button className="cp-collapse-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="cp-collapse-chev">{open ? "▾" : "▸"}</span>
        <span className="cp-collapse-title">{title}</span>
        {tag && <span className="learn-tag">{tag}</span>}
        {summary && <span className="cp-collapse-summary">{summary}</span>}
      </button>
      {open && <div className="cp-collapse-body">{children}</div>}
    </div>
  );
}
