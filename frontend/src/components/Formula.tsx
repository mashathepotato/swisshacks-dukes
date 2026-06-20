import katex from "katex";
import type { ReactNode } from "react";

function tex(s: string): string {
  try {
    return katex.renderToString(s, { throwOnError: false, displayMode: false });
  } catch {
    return s;
  }
}

/** Wrap a sub-score; hovering reveals the LaTeX formula behind it (KaTeX). */
export function FormulaTip({ formula, children }: { formula: string; children: ReactNode }) {
  return (
    <span className="ftip-wrap">
      {children}
      <span className="ftip" role="tooltip" dangerouslySetInnerHTML={{ __html: tex(formula) }} />
    </span>
  );
}
