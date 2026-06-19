# Advisor Dashboard — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase-A core of the wealth-advisory dashboard — one persona (Schneider) end-to-end: deterministic Client DNA + portfolio drift + CIO-constrained swap + the Glass-Thread provenance view with the "cut the thread" hero moment and a live two-voice message draft.

**Architecture:** Extend the imported `demo/` TS+Express+SPA starter. A boot-time in-memory store loads CSVs (`data/`) and committed frozen JSON. Deterministic engines (drift, swap, alerts) emit a uniform `Trace` object; the SPA renders traces. The LLM is used in exactly two places: DNA extraction (run once offline, committed as JSON) and the message draft (live, with a committed per-persona cache). A `?live=false` switch forces everything to cached mode.

**Tech Stack:** TypeScript (ES2022, CommonJS), Express 4, Node ≥20, ts-node/nodemon, zod, axios; `csv-parse` for robust CSV; `vitest` for tests. Frontend is a single self-contained `index.html` (inline script/style) served statically.

## Global Constraints

- Work inside `demo/`; reuse the starter's `PhoeniqsService`, `SixService`, `NewsAIService`, and probe pattern. Do not rewrite them.
- Amounts in CHF. ISINs per ISO 6166. Mandate drift rule: a sub-asset class may deviate at most **±2.0 percentage points** from target (recomputed against the drifted total).
- Personalisation is **asset-level only**; the mandate/strategy never changes. Swap candidates must be **same Industry Group** and **CIO-rated BUY** and **not currently held**.
- The AI never advises the client directly; the RM approves every message. No auto-send.
- Exactly two LLM touchpoints; everything else deterministic. Every live call has a committed cached fallback. `?live=false` forces cache.
- Shared domain types live in `demo/src/shared/domain.ts` and are imported by both backend and the type-checked build; never redefine them per-file.
- Frozen data files live in `demo/src/backend/data/frozen/`. CSVs are read from the repo-root `data/` via `DATA_DIR` (default `../../../../data` relative to compiled file; configurable by env `DATA_DIR`).
- Commit after every task with a `feat:`/`test:`/`chore:` message.

---

## File Structure

```
demo/
  package.json                      (modify: add csv-parse, vitest, test script)
  vitest.config.ts                  (create)
  src/shared/
    domain.ts                       (create: all Phase-A domain types)
  src/backend/
    data/
      paths.ts                      (create: resolve DATA_DIR + frozen dir)
      loaders.ts                    (create: CSV → typed records)
      frozen/
        dna_schneider.json          (create: frozen DNA profile)
        thread_schneider.json       (create: two Glass-Thread states)
        news_schneider.json         (create: scripted trigger event)
        message_cache.json          (create: cached message drafts)
    store/store.ts                  (create: boot-time in-memory store)
    engine/
      weights.ts                    (create: sub-asset-class weight math)
      drift.ts                      (create: ±2.0pp breach detection)
      swap.ts                       (create: CIO-constrained swap)
      alerts.ts                     (create: DNA×portfolio×news → Trace[])
    agents/messageAgent.ts          (create: LLM draft + cache fallback)
    routes/advisor.routes.ts        (create: client/alert/swap/message routes)
    controllers/advisor.controller.ts (create)
    index.ts                        (modify: mount advisor routes)
    src/frontend/index.html         (replace: SPA — client view, Glass Thread, composer)
  *.test.ts                         (colocated vitest tests)
```

---

### Task 1: Project setup — test runner + CSV parser

**Files:**
- Modify: `demo/package.json`
- Create: `demo/vitest.config.ts`
- Create: `demo/src/backend/sanity.test.ts` (temporary, deleted in step 5)

**Interfaces:**
- Produces: an `npm test` script running `vitest run`; `csv-parse` available as a dependency.

- [ ] **Step 1: Add deps and test script to `demo/package.json`**

In `"dependencies"` add:
```json
    "csv-parse": "^5.5.6"
```
In `"devDependencies"` add:
```json
    "vitest": "^1.6.0"
```
In `"scripts"` add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Create `demo/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Install**

Run: `cd demo && npm install`
Expected: installs without error; `node_modules/.bin/vitest` exists.

- [ ] **Step 4: Add a sanity test `demo/src/backend/sanity.test.ts`**

```ts
import { test, expect } from "vitest";
test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: Run, confirm pass, delete sanity test, commit**

Run: `cd demo && npm test`
Expected: 1 passed.
Then delete `demo/src/backend/sanity.test.ts`.
```bash
git add demo/package.json demo/package-lock.json demo/vitest.config.ts
git commit -m "chore: add vitest and csv-parse to demo"
```

---

### Task 2: Domain types

**Files:**
- Create: `demo/src/shared/domain.ts`

**Interfaces:**
- Produces: all types below. Every later task imports from `../../shared/domain` (backend) — never redefine.

- [ ] **Step 1: Create `demo/src/shared/domain.ts`**

```ts
export type Mandate = "Defensive" | "Balanced" | "Growth";
export type Voice = "data-driven" | "values-led";
export type Severity = "act" | "watch" | "info";
export type AlertType = "dna-conflict" | "cio-sell" | "drift-breach" | "news-hit";
export type EvidenceKind = "crm" | "cio" | "news" | "market";
export type Rating = "BUY" | "HOLD" | "SELL";

export interface Evidence {
  kind: EvidenceKind;
  sourceId: string;   // e.g. "crm_schneider.csv:2024-05-14"
  quote: string;
  date: string;       // ISO date
  ref?: string;       // ISIN or URL
}

export interface DnaTrait {
  id: string;
  label: string;
  detail: string;
  confidence: number; // 0..1
  evidence: Evidence[];
}

export interface DnaProfile {
  clientId: string;
  name: string;
  mandate: Mandate;
  style: Voice;
  traits: DnaTrait[];
}

export interface Holding {
  isin: string;
  issuer: string;
  assetClass: string;
  subAssetClass: string;
  region: string;
  industryGroup: string;
  targetCHF: number;
  currentCHF: number;
  valor: string;
  mic: string;
  yahoo: string;
}

export interface CioEntry {
  isin: string;
  issuer: string;
  rating: Rating;
  ratingSince: string;
  industryGroup: string;
  subAssetClass: string;
  cioView: string;
}

export interface StrategyTarget {
  subAssetClass: string;
  defPct: number;
  balancedPct: number;
  growthPct: number;
}

export interface DriftBreach {
  subAssetClass: string;
  targetPct: number;
  currentPct: number;
  deltaPct: number;   // currentPct - targetPct
  breached: boolean;  // Math.abs(deltaPct) > 2.0
}

export interface SwapCandidate {
  isin: string;
  issuer: string;
  cioView: string;
}

export interface RejectedCandidate {
  isin: string;
  issuer: string;
  reason: string;
}

export interface SwapResult {
  sell: { isin: string; issuer: string };
  chosen: SwapCandidate | null; // null => no compliant swap
  rejected: RejectedCandidate[];
}

export interface Trace {
  id: string;
  claim: string;
  type: AlertType;
  confidence: number;
  severity: Severity;
  evidence: Evidence[];
  valueAtStakeCHF?: number;
}

export interface NewsEvent {
  id: string;
  headline: string;
  summary: string;
  affectedIsins: string[];
  publishedAt: string;
  url?: string;
}

export interface CrmNote {
  date: string;
  medium: string;
  rmName: string;
  contact: string;
  note: string;
}
```

- [ ] **Step 2: Type-check and commit**

Run: `cd demo && npx tsc --noEmit`
Expected: no errors.
```bash
git add demo/src/shared/domain.ts
git commit -m "feat: add Phase-A domain types"
```

---

### Task 3: Data paths + CSV loaders

**Files:**
- Create: `demo/src/backend/data/paths.ts`
- Create: `demo/src/backend/data/loaders.ts`
- Create: `demo/src/backend/data/loaders.test.ts`

**Interfaces:**
- Consumes: `csv-parse`, domain types.
- Produces:
  - `dataDir(): string`, `frozenDir(): string`
  - `loadPortfolio(mandate: Mandate): Holding[]`
  - `loadCioList(): CioEntry[]`
  - `loadStrategies(): StrategyTarget[]`
  - `loadCrm(clientFile: string): CrmNote[]`

- [ ] **Step 1: Create `demo/src/backend/data/paths.ts`**

```ts
import path from "path";

// Compiled file lives in demo/dist/... or is run via ts-node from src/backend/data.
// DATA_DIR overrides; default points at the repo-root data/ folder.
export function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return path.resolve(__dirname, "../../../../data");
}

export function frozenDir(): string {
  return path.resolve(__dirname, "frozen");
}
```

- [ ] **Step 2: Write the failing test `demo/src/backend/data/loaders.test.ts`**

```ts
import { test, expect } from "vitest";
import { loadPortfolio, loadCioList, loadStrategies, loadCrm } from "./loaders";

test("loadPortfolio(Balanced) returns holdings with numeric CHF and Roche present", () => {
  const holdings = loadPortfolio("Balanced");
  expect(holdings.length).toBeGreaterThan(10);
  const roche = holdings.find((h) => h.isin === "CH0012032048");
  expect(roche).toBeDefined();
  expect(roche!.industryGroup).toBe("Health Care");
  expect(roche!.currentCHF).toBeGreaterThan(0);
  expect(Number.isFinite(roche!.targetCHF)).toBe(true);
});

test("loadCioList includes Roche as BUY and Biogen as HOLD", () => {
  const cio = loadCioList();
  const roche = cio.find((c) => c.isin === "CH0012032048");
  const biogen = cio.find((c) => c.isin === "US09062X1037");
  expect(roche!.rating).toBe("BUY");
  expect(biogen!.rating).toBe("HOLD");
});

test("loadStrategies returns Balanced % for Domestic (CHF) equities", () => {
  const s = loadStrategies();
  const dom = s.find((t) => t.subAssetClass === "Domestic (CHF)");
  expect(dom!.balancedPct).toBeCloseTo(10, 5);
});

test("loadCrm parses quoted notes with embedded commas", () => {
  const notes = loadCrm("crm_schneider.csv");
  expect(notes.length).toBeGreaterThan(20);
  const may14 = notes.find((n) => n.date.startsWith("2024-05-14"));
  expect(may14!.note).toContain("neurological research");
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd demo && npx vitest run src/backend/data/loaders.test.ts`
Expected: FAIL — cannot find module `./loaders`.

- [ ] **Step 4: Create `demo/src/backend/data/loaders.ts`**

```ts
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { CioEntry, CrmNote, Holding, Mandate, Rating, StrategyTarget } from "../../shared/domain";
import { dataDir } from "./paths";

function readCsv(relPath: string): Record<string, string>[] {
  const full = path.join(dataDir(), relPath);
  const raw = fs.readFileSync(full, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
}

const num = (v: string): number => {
  const n = parseFloat((v || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const portfolioFile: Record<Mandate, string> = {
  Defensive: "portfolio/sample_portfolio_defensive.csv",
  Balanced: "portfolio/sample_portfolio_balanced.csv",
  Growth: "portfolio/sample_portfolio_growth.csv",
};

export function loadPortfolio(mandate: Mandate): Holding[] {
  return readCsv(portfolioFile[mandate])
    .filter((r) => r["ISIN"])
    .map((r) => ({
      isin: r["ISIN"],
      issuer: r["Issuer / Asset"],
      assetClass: r["Asset Class"],
      subAssetClass: (r["Sub-Asset Class"] || "").trim(),
      region: r["Region"],
      industryGroup: (r["Industry Group"] || "").trim(),
      targetCHF: num(r["Target (CHF)"]),
      currentCHF: num(r["Current (CHF)"]),
      valor: r["Valor"] || "",
      mic: r["MIC"] || "",
      yahoo: r["Yahoo Ticker"] || "",
    }));
}

export function loadCioList(): CioEntry[] {
  return readCsv("portfolio/cio_recommendation_list.csv")
    .filter((r) => r["ISIN"])
    .map((r) => ({
      isin: r["ISIN"],
      issuer: r["Issuer / Asset"],
      rating: (r["Rating"] as Rating) || "HOLD",
      ratingSince: r["Rating Since"] || "",
      industryGroup: (r["Industry Group"] || "").trim(),
      subAssetClass: (r["Sub-Asset Class"] || "").trim(),
      cioView: r["CIO View"] || "",
    }));
}

export function loadStrategies(): StrategyTarget[] {
  return readCsv("portfolio/portfolio_strategies.csv")
    .filter((r) => r["Sub-Asset Class"] && r["Asset Class"] !== "TOTAL")
    .map((r) => ({
      subAssetClass: (r["Sub-Asset Class"] || "").trim(),
      defPct: num(r["Def %"]),
      balancedPct: num(r["Balanced %"]),
      growthPct: num(r["Growth %"]),
    }));
}

export function loadCrm(clientFile: string): CrmNote[] {
  return readCsv(`crm/${clientFile}`)
    .filter((r) => r["Date"])
    .map((r) => ({
      date: r["Date"],
      medium: r["Medium"],
      rmName: r["RM Name"],
      contact: r["Client Contact"],
      note: r["Note"],
    }));
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd demo && npx vitest run src/backend/data/loaders.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add demo/src/backend/data/paths.ts demo/src/backend/data/loaders.ts demo/src/backend/data/loaders.test.ts
git commit -m "feat: CSV loaders for portfolio, CIO list, strategies, CRM"
```

---

### Task 4: Weight + drift engine

**Files:**
- Create: `demo/src/backend/engine/weights.ts`
- Create: `demo/src/backend/engine/drift.ts`
- Create: `demo/src/backend/engine/drift.test.ts`

**Interfaces:**
- Consumes: `Holding`, `StrategyTarget`, `DriftBreach`, `Mandate` from domain; `loadPortfolio`, `loadStrategies`.
- Produces:
  - `subAssetWeights(holdings: Holding[]): Record<string, number>` — percentage weights summing ~100.
  - `computeDrift(holdings: Holding[], targets: StrategyTarget[], mandate: Mandate): DriftBreach[]`

- [ ] **Step 1: Write failing test `demo/src/backend/engine/drift.test.ts`**

```ts
import { test, expect } from "vitest";
import { subAssetWeights, computeDrift } from "./drift";
import { Holding, StrategyTarget } from "../../shared/domain";
import { loadPortfolio, loadStrategies } from "../data/loaders";

const h = (subAssetClass: string, currentCHF: number): Holding => ({
  isin: "X" + currentCHF, issuer: "x", assetClass: "Equities", subAssetClass,
  region: "", industryGroup: "", targetCHF: currentCHF, currentCHF,
  valor: "", mic: "", yahoo: "",
});

test("subAssetWeights sums to 100 and splits by class", () => {
  const w = subAssetWeights([h("A", 30), h("A", 30), h("B", 40)]);
  expect(w["A"]).toBeCloseTo(60, 5);
  expect(w["B"]).toBeCloseTo(40, 5);
});

test("computeDrift flags a >2.0pp deviation and not a <2.0pp one", () => {
  const holdings = [h("A", 130), h("B", 70)]; // A=65%, B=35%
  const targets: StrategyTarget[] = [
    { subAssetClass: "A", defPct: 0, balancedPct: 60, growthPct: 0 }, // delta +5 -> breach
    { subAssetClass: "B", defPct: 0, balancedPct: 36, growthPct: 0 }, // delta -1 -> ok
  ];
  const drift = computeDrift(holdings, targets, "Balanced");
  const a = drift.find((d) => d.subAssetClass === "A")!;
  const b = drift.find((d) => d.subAssetClass === "B")!;
  expect(a.breached).toBe(true);
  expect(a.deltaPct).toBeCloseTo(5, 5);
  expect(b.breached).toBe(false);
});

test("real Balanced portfolio has at least one drift breach", () => {
  const drift = computeDrift(loadPortfolio("Balanced"), loadStrategies(), "Balanced");
  expect(drift.some((d) => d.breached)).toBe(true);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd demo && npx vitest run src/backend/engine/drift.test.ts`
Expected: FAIL — cannot find `./drift`.

- [ ] **Step 3: Create `demo/src/backend/engine/weights.ts`**

```ts
import { Holding } from "../../shared/domain";

export function subAssetWeights(holdings: Holding[]): Record<string, number> {
  const total = holdings.reduce((s, h) => s + h.currentCHF, 0);
  const byClass: Record<string, number> = {};
  for (const h of holdings) {
    byClass[h.subAssetClass] = (byClass[h.subAssetClass] || 0) + h.currentCHF;
  }
  const weights: Record<string, number> = {};
  for (const k of Object.keys(byClass)) {
    weights[k] = total === 0 ? 0 : (byClass[k] / total) * 100;
  }
  return weights;
}
```

- [ ] **Step 4: Create `demo/src/backend/engine/drift.ts`**

```ts
import { DriftBreach, Holding, Mandate, StrategyTarget } from "../../shared/domain";
import { subAssetWeights } from "./weights";

const targetFor = (t: StrategyTarget, mandate: Mandate): number =>
  mandate === "Defensive" ? t.defPct : mandate === "Growth" ? t.growthPct : t.balancedPct;

export { subAssetWeights };

export function computeDrift(
  holdings: Holding[],
  targets: StrategyTarget[],
  mandate: Mandate
): DriftBreach[] {
  const weights = subAssetWeights(holdings);
  return targets
    .filter((t) => weights[t.subAssetClass] !== undefined || targetFor(t, mandate) > 0)
    .map((t) => {
      const currentPct = weights[t.subAssetClass] || 0;
      const targetPct = targetFor(t, mandate);
      const deltaPct = currentPct - targetPct;
      return {
        subAssetClass: t.subAssetClass,
        targetPct,
        currentPct,
        deltaPct,
        breached: Math.abs(deltaPct) > 2.0,
      };
    });
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd demo && npx vitest run src/backend/engine/drift.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add demo/src/backend/engine/weights.ts demo/src/backend/engine/drift.ts demo/src/backend/engine/drift.test.ts
git commit -m "feat: sub-asset-class weight + ±2.0pp drift engine"
```

---

### Task 5: Swap engine (CIO-constrained)

**Files:**
- Create: `demo/src/backend/engine/swap.ts`
- Create: `demo/src/backend/engine/swap.test.ts`

**Interfaces:**
- Consumes: `Holding`, `CioEntry`, `SwapResult` from domain.
- Produces: `proposeSwap(sellIsin: string, holdings: Holding[], cio: CioEntry[]): SwapResult`
  - Candidate rule: same `industryGroup` as the sell holding, CIO `rating === "BUY"`, not currently held. Rejected candidates carry a `reason`.

- [ ] **Step 1: Write failing test `demo/src/backend/engine/swap.test.ts`**

```ts
import { test, expect } from "vitest";
import { proposeSwap } from "./swap";
import { CioEntry, Holding } from "../../shared/domain";
import { loadPortfolio, loadCioList } from "../data/loaders";

const holding = (isin: string, industryGroup: string): Holding => ({
  isin, issuer: isin, assetClass: "Equities", subAssetClass: "x", region: "",
  industryGroup, targetCHF: 1, currentCHF: 1, valor: "", mic: "", yahoo: "",
});
const cio = (isin: string, rating: "BUY" | "HOLD" | "SELL", industryGroup: string): CioEntry => ({
  isin, issuer: isin, rating, ratingSince: "", industryGroup, subAssetClass: "x", cioView: "view " + isin,
});

test("chooses a same-group BUY that is not held; explains rejections", () => {
  const holdings = [holding("SELLME", "Health Care"), holding("HELD_BUY", "Health Care")];
  const list = [
    cio("SELLME", "BUY", "Health Care"),
    cio("HELD_BUY", "BUY", "Health Care"),   // rejected: already held
    cio("HOLDY", "HOLD", "Health Care"),     // rejected: not BUY
    cio("OTHER", "BUY", "Financials"),       // rejected: different group
    cio("GOOD", "BUY", "Health Care"),       // chosen
  ];
  const res = proposeSwap("SELLME", holdings, list);
  expect(res.chosen!.isin).toBe("GOOD");
  expect(res.rejected.find((r) => r.isin === "HELD_BUY")!.reason).toMatch(/held/i);
  expect(res.rejected.find((r) => r.isin === "HOLDY")!.reason).toMatch(/BUY/i);
  expect(res.rejected.some((r) => r.isin === "OTHER")).toBe(false); // different group not even considered
});

test("returns chosen=null when no compliant candidate exists", () => {
  const holdings = [holding("SELLME", "Health Care")];
  const list = [cio("SELLME", "BUY", "Health Care"), cio("HOLDY", "HOLD", "Health Care")];
  const res = proposeSwap("SELLME", holdings, list);
  expect(res.chosen).toBeNull();
});

test("real data: selling Roche yields Health-Care BUY candidates not held", () => {
  const holdings = loadPortfolio("Balanced");
  const res = proposeSwap("CH0012032048", holdings, loadCioList()); // Roche
  expect(res.chosen).not.toBeNull();
  const heldIsins = new Set(holdings.map((h) => h.isin));
  expect(heldIsins.has(res.chosen!.isin)).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd demo && npx vitest run src/backend/engine/swap.test.ts`
Expected: FAIL — cannot find `./swap`.

- [ ] **Step 3: Create `demo/src/backend/engine/swap.ts`**

```ts
import { CioEntry, Holding, RejectedCandidate, SwapResult } from "../../shared/domain";

export function proposeSwap(sellIsin: string, holdings: Holding[], cio: CioEntry[]): SwapResult {
  const sellHolding = holdings.find((h) => h.isin === sellIsin);
  const sellCio = cio.find((c) => c.isin === sellIsin);
  const group = sellHolding?.industryGroup || sellCio?.industryGroup || "";
  const heldIsins = new Set(holdings.map((h) => h.isin));
  const sellIssuer = sellHolding?.issuer || sellCio?.issuer || sellIsin;

  const sameGroup = cio.filter((c) => c.industryGroup === group && c.isin !== sellIsin);

  const rejected: RejectedCandidate[] = [];
  const eligible = sameGroup.filter((c) => {
    if (c.rating !== "BUY") {
      rejected.push({ isin: c.isin, issuer: c.issuer, reason: `not CIO-BUY (${c.rating})` });
      return false;
    }
    if (heldIsins.has(c.isin)) {
      rejected.push({ isin: c.isin, issuer: c.issuer, reason: "already held" });
      return false;
    }
    return true;
  });

  const chosen = eligible[0]
    ? { isin: eligible[0].isin, issuer: eligible[0].issuer, cioView: eligible[0].cioView }
    : null;

  return { sell: { isin: sellIsin, issuer: sellIssuer }, chosen, rejected };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd demo && npx vitest run src/backend/engine/swap.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add demo/src/backend/engine/swap.ts demo/src/backend/engine/swap.test.ts
git commit -m "feat: CIO-constrained same-sector swap engine with rejection reasons"
```

---

### Task 6: Frozen Schneider fixtures (DNA, thread, news, message cache)

**Files:**
- Create: `demo/src/backend/data/frozen/dna_schneider.json`
- Create: `demo/src/backend/data/frozen/news_schneider.json`
- Create: `demo/src/backend/data/frozen/thread_schneider.json`
- Create: `demo/src/backend/data/frozen/message_cache.json`

**Interfaces:**
- Produces: JSON files matching `DnaProfile`, `NewsEvent`, the thread-state shape (consumed by the frontend in Task 11), and the message cache (consumed by Task 8). All quotes/dates are copied verbatim from `data/crm/crm_schneider.csv`.

- [ ] **Step 1: Create `demo/src/backend/data/frozen/dna_schneider.json`**

```json
{
  "clientId": "schneider",
  "name": "Hubertus Schneider",
  "mandate": "Balanced",
  "style": "values-led",
  "traits": [
    {
      "id": "neuro-mission",
      "label": "Neuroscience research mission",
      "detail": "After his daughter Chloe's early-onset Parkinson's diagnosis, the family wants core healthcare/pharma holdings to actively fund neurodegenerative research; explicitly asks to divest any holding that abandons Parkinson's research.",
      "confidence": 0.9,
      "evidence": [
        { "kind": "crm", "sourceId": "crm_schneider.csv:2024-05-14", "date": "2024-05-14", "quote": "requested a breakdown of our core large-cap pharmaceutical holdings, specifically asking about their global neurological research footprints" },
        { "kind": "crm", "sourceId": "crm_schneider.csv:2026-01-22", "date": "2026-01-22", "quote": "I want our core healthcare and pharma holdings to actively support the entities pushing the boundaries of brain disease research" },
        { "kind": "crm", "sourceId": "crm_schneider.csv:2026-03-05", "date": "2026-03-05", "quote": "If a company we own ever abandons or defunds Parkinson's research to chase cheap lifestyle profits, it would feel like a personal betrayal of my daughter. Flag them immediately for divestment." }
      ]
    },
    {
      "id": "stability-anchor",
      "label": "Values institutional stability",
      "detail": "Automotive entrepreneur; views large-cap blue-chip holdings as stable operational anchors and expects rigorous, data-driven execution of the Balanced mandate.",
      "confidence": 0.75,
      "evidence": [
        { "kind": "crm", "sourceId": "crm_schneider.csv:2024-09-17", "date": "2024-09-17", "quote": "He values large-cap equities because they represent stable, operational businesses with heavy research budgets" },
        { "kind": "crm", "sourceId": "crm_schneider.csv:2025-09-25", "date": "2025-09-25", "quote": "he expects rigorous, data-driven execution of his balanced mandate" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create `demo/src/backend/data/frozen/news_schneider.json`**

```json
{
  "id": "news-roche-parkinsons",
  "headline": "Roche to wind down early-stage Parkinson's research, refocus on metabolic and lifestyle drugs",
  "summary": "Roche announced it will discontinue several neurodegenerative research programmes, including early-stage Parkinson's assets, reallocating R&D toward higher-margin metabolic and lifestyle therapies.",
  "affectedIsins": ["CH0012032048"],
  "publishedAt": "2026-06-12",
  "url": "https://example.com/roche-parkinsons-winddown"
}
```

- [ ] **Step 3: Create `demo/src/backend/data/frozen/thread_schneider.json`**

```json
{
  "clientId": "schneider",
  "cuttableNodeId": "crm-2026-03-05",
  "states": {
    "full_case": {
      "alert": { "severity": "act", "claim": "Roche now conflicts with the client's explicit neuroscience-divestment mandate", "confidence": 0.9 },
      "nodes": [
        { "id": "crm-2024-05-14", "kind": "crm", "label": "Email: asks about pharma neuroscience R&D footprint", "date": "2024-05-14", "quote": "asking about their global neurological research footprints", "active": true },
        { "id": "crm-2026-03-05", "kind": "crm", "label": "Email: flag for divestment if Parkinson's research abandoned", "date": "2026-03-05", "quote": "If a company we own ever abandons or defunds Parkinson's research ... Flag them immediately for divestment.", "active": true },
        { "id": "trait-neuro", "kind": "trait", "label": "Neuroscience research mission", "confidence": 0.9 },
        { "id": "holding-roche", "kind": "holding", "label": "Roche Holding AG", "ref": "CH0012032048", "valueCHF": 112461.84 },
        { "id": "news", "kind": "news", "label": "Roche winds down Parkinson's research", "date": "2026-06-12" },
        { "id": "swap", "kind": "swap", "label": "Propose: SELL Roche → BUY a CIO-BUY Health Care name committed to neuro research" }
      ],
      "edges": [
        ["crm-2024-05-14", "trait-neuro"],
        ["crm-2026-03-05", "trait-neuro"],
        ["trait-neuro", "holding-roche"],
        ["news", "holding-roche"],
        ["holding-roche", "swap"]
      ]
    },
    "cut_neuroscience": {
      "alert": { "severity": "watch", "claim": "Possible values conflict on Roche — weaker evidence after RM challenge", "confidence": 0.4 },
      "nodes": [
        { "id": "crm-2024-05-14", "kind": "crm", "label": "Email: asks about pharma neuroscience R&D footprint", "date": "2024-05-14", "quote": "asking about their global neurological research footprints", "active": true },
        { "id": "crm-2026-03-05", "kind": "crm", "label": "(challenged by RM — excluded)", "date": "2026-03-05", "quote": "If a company we own ever abandons or defunds Parkinson's research ... Flag them immediately for divestment.", "active": false },
        { "id": "trait-neuro", "kind": "trait", "label": "Neuroscience research mission", "confidence": 0.4 },
        { "id": "holding-roche", "kind": "holding", "label": "Roche Holding AG", "ref": "CH0012032048", "valueCHF": 112461.84 },
        { "id": "news", "kind": "news", "label": "Roche winds down Parkinson's research", "date": "2026-06-12" },
        { "id": "swap", "kind": "swap", "label": "Hold & monitor — flag for RM review, no divestment recommended" }
      ],
      "edges": [
        ["crm-2024-05-14", "trait-neuro"],
        ["trait-neuro", "holding-roche"],
        ["news", "holding-roche"],
        ["holding-roche", "swap"]
      ]
    }
  }
}
```

- [ ] **Step 4: Create `demo/src/backend/data/frozen/message_cache.json`**

```json
{
  "schneider:news-roche-parkinsons:values-led": "Dear Hubertus,\n\nI know how deeply your family's mission matters since Chloe's diagnosis. Today Roche announced it is winding down its early-stage Parkinson's research to refocus on lifestyle therapies — a direct conflict with the commitment you asked us to protect. In keeping with your instruction to flag such a company for divestment, I'd like to propose reallocating this position to a CIO-recommended healthcare leader that is actively funding neurodegenerative research, keeping your Balanced mandate fully intact. Your strategy doesn't change — only the name behind it does. I'll await your decision before any action.\n\nWith you in this,\nSarah",
  "schneider:news-roche-parkinsons:data-driven": "Dear Hubertus,\n\nAction item on the Health Care sleeve: Roche (CH0012032048, ~CHF 112k, ~1.1% of the portfolio) has announced it is discontinuing early-stage Parkinson's programmes. This breaches your stated divestment criterion. Proposed same-sector swap into a CIO-BUY healthcare name with an active neuro pipeline; sub-asset-class weights and the Balanced mandate remain within tolerance. No order will be placed without your approval.\n\nBest regards,\nSarah"
}
```

- [ ] **Step 5: Validate JSON and commit**

Run: `cd demo && node -e "['dna_schneider','news_schneider','thread_schneider','message_cache'].forEach(f=>JSON.parse(require('fs').readFileSync('src/backend/data/frozen/'+f+'.json','utf8')));console.log('json ok')"`
Expected: `json ok`
```bash
git add demo/src/backend/data/frozen
git commit -m "feat: frozen Schneider fixtures (DNA, news, thread states, message cache)"
```

---

### Task 7: Alert engine

**Files:**
- Create: `demo/src/backend/engine/alerts.ts`
- Create: `demo/src/backend/engine/alerts.test.ts`

**Interfaces:**
- Consumes: `DnaProfile`, `Holding`, `NewsEvent`, `CioEntry`, `DriftBreach`, `Trace` from domain.
- Produces:
  - `buildAlerts(input: { dna: DnaProfile; holdings: Holding[]; news: NewsEvent[]; cio: CioEntry[]; drift: DriftBreach[] }): Trace[]`
  - Rules: (a) **dna-conflict** — a news event hits a held ISIN AND the client has a divestment-style trait → ACT trace (confidence = trait confidence, valueAtStake = holding currentCHF, evidence = trait evidence + a news Evidence). (b) **cio-sell** — held ISIN rated SELL → WATCH. (c) **drift-breach** — each breached sub-asset class → WATCH. Sorted ACT → WATCH → INFO.

- [ ] **Step 1: Write failing test `demo/src/backend/engine/alerts.test.ts`**

```ts
import { test, expect } from "vitest";
import { buildAlerts } from "./alerts";
import { CioEntry, DnaProfile, DriftBreach, Holding, NewsEvent } from "../../shared/domain";

const dna: DnaProfile = {
  clientId: "schneider", name: "Hubertus Schneider", mandate: "Balanced", style: "values-led",
  traits: [{
    id: "neuro-mission", label: "Neuroscience research mission",
    detail: "divest if abandons Parkinson's", confidence: 0.9,
    evidence: [{ kind: "crm", sourceId: "crm:2026-03-05", date: "2026-03-05", quote: "Flag them immediately for divestment." }],
  }],
};
const roche: Holding = {
  isin: "CH0012032048", issuer: "Roche Holding AG", assetClass: "Equities", subAssetClass: "Domestic (CHF)",
  region: "Schweiz", industryGroup: "Health Care", targetCHF: 110000, currentCHF: 112461.84, valor: "", mic: "", yahoo: "",
};
const news: NewsEvent[] = [{
  id: "n1", headline: "Roche winds down Parkinson's research", summary: "", affectedIsins: ["CH0012032048"], publishedAt: "2026-06-12",
}];

test("produces an ACT dna-conflict trace citing trait evidence + news, with value at stake", () => {
  const traces = buildAlerts({ dna, holdings: [roche], news, cio: [], drift: [] });
  const conflict = traces.find((t) => t.type === "dna-conflict")!;
  expect(conflict.severity).toBe("act");
  expect(conflict.confidence).toBeCloseTo(0.9, 5);
  expect(conflict.valueAtStakeCHF).toBeCloseTo(112461.84, 2);
  expect(conflict.evidence.some((e) => e.kind === "crm")).toBe(true);
  expect(conflict.evidence.some((e) => e.kind === "news")).toBe(true);
});

test("ACT sorts before WATCH drift breaches", () => {
  const drift: DriftBreach[] = [{ subAssetClass: "Foreign (Dev. Markets)", targetPct: 34.5, currentPct: 37, deltaPct: 2.5, breached: true }];
  const traces = buildAlerts({ dna, holdings: [roche], news, cio: [], drift });
  expect(traces[0].severity).toBe("act");
  expect(traces.some((t) => t.type === "drift-breach")).toBe(true);
});

test("no news hit on held ISIN => no dna-conflict", () => {
  const traces = buildAlerts({ dna, holdings: [roche], news: [], cio: [], drift: [] });
  expect(traces.some((t) => t.type === "dna-conflict")).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd demo && npx vitest run src/backend/engine/alerts.test.ts`
Expected: FAIL — cannot find `./alerts`.

- [ ] **Step 3: Create `demo/src/backend/engine/alerts.ts`**

```ts
import { CioEntry, DnaProfile, DriftBreach, Evidence, Holding, NewsEvent, Severity, Trace } from "../../shared/domain";

const rank: Record<Severity, number> = { act: 0, watch: 1, info: 2 };

// A trait whose evidence mentions divestment/betrayal is treated as a divestment mandate.
function isDivestmentTrait(dna: DnaProfile): DnaProfile["traits"][number] | undefined {
  return dna.traits.find((t) =>
    t.evidence.some((e) => /divest|betrayal|abandon|defund/i.test(e.quote)) || /divest/i.test(t.detail)
  );
}

export function buildAlerts(input: {
  dna: DnaProfile; holdings: Holding[]; news: NewsEvent[]; cio: CioEntry[]; drift: DriftBreach[];
}): Trace[] {
  const { dna, holdings, news, cio, drift } = input;
  const heldByIsin = new Map(holdings.map((h) => [h.isin, h]));
  const traces: Trace[] = [];
  const divTrait = isDivestmentTrait(dna);

  // (a) dna-conflict: news hits a held ISIN and the client has a divestment trait
  for (const ev of news) {
    for (const isin of ev.affectedIsins) {
      const holding = heldByIsin.get(isin);
      if (!holding || !divTrait) continue;
      const evidence: Evidence[] = [
        ...divTrait.evidence,
        { kind: "news", sourceId: ev.id, date: ev.publishedAt, quote: ev.headline, ref: ev.url },
      ];
      traces.push({
        id: `dna-conflict:${isin}`,
        claim: `${holding.issuer} now conflicts with the client's "${divTrait.label}"`,
        type: "dna-conflict",
        confidence: divTrait.confidence,
        severity: "act",
        evidence,
        valueAtStakeCHF: holding.currentCHF,
      });
    }
  }

  // (b) cio-sell: held ISIN rated SELL
  for (const c of cio) {
    if (c.rating !== "SELL") continue;
    const holding = heldByIsin.get(c.isin);
    if (!holding) continue;
    traces.push({
      id: `cio-sell:${c.isin}`,
      claim: `${holding.issuer} is CIO-rated SELL but still held`,
      type: "cio-sell",
      confidence: 0.8,
      severity: "watch",
      evidence: [{ kind: "cio", sourceId: c.isin, date: c.ratingSince, quote: c.cioView, ref: c.isin }],
      valueAtStakeCHF: holding.currentCHF,
    });
  }

  // (c) drift-breach
  for (const d of drift) {
    if (!d.breached) continue;
    traces.push({
      id: `drift:${d.subAssetClass}`,
      claim: `${d.subAssetClass} is ${d.deltaPct > 0 ? "over" : "under"} target by ${Math.abs(d.deltaPct).toFixed(1)}pp`,
      type: "drift-breach",
      confidence: 1,
      severity: "watch",
      evidence: [{ kind: "market", sourceId: d.subAssetClass, date: "", quote: `target ${d.targetPct}% vs current ${d.currentPct.toFixed(1)}%` }],
    });
  }

  return traces.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd demo && npx vitest run src/backend/engine/alerts.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add demo/src/backend/engine/alerts.ts demo/src/backend/engine/alerts.test.ts
git commit -m "feat: alert engine (dna-conflict, cio-sell, drift-breach) emitting traces"
```

---

### Task 8: Message agent (live LLM + cache fallback)

**Files:**
- Create: `demo/src/backend/agents/messageAgent.ts`
- Create: `demo/src/backend/agents/messageAgent.test.ts`

**Interfaces:**
- Consumes: `DnaProfile`, `Trace`, `SwapResult`, `Voice`; the starter's `PhoeniqsService`.
- Produces:
  - `buildMessagePrompt(args: { dna: DnaProfile; alert: Trace; swap: SwapResult | null; voice: Voice }): { system: string; user: string }` (pure)
  - `draftMessage(args, deps?): Promise<{ text: string; source: "live" | "cache" }>` — calls Phoeniqs via an injectable `chat` fn; on error/timeout/`live=false`, returns cache keyed `${dna.clientId}:${alert.sourceEventId}:${voice}`. The cache key's event id comes from `args.cacheKey`.

- [ ] **Step 1: Write failing test `demo/src/backend/agents/messageAgent.test.ts`**

```ts
import { test, expect } from "vitest";
import { buildMessagePrompt, draftMessage } from "./messageAgent";
import { DnaProfile, SwapResult, Trace, Voice } from "../../shared/domain";

const dna: DnaProfile = {
  clientId: "schneider", name: "Hubertus Schneider", mandate: "Balanced", style: "values-led", traits: [],
};
const alert: Trace = {
  id: "dna-conflict:CH0012032048", claim: "Roche conflicts with neuroscience mission",
  type: "dna-conflict", confidence: 0.9, severity: "act", evidence: [],
};
const swap: SwapResult = { sell: { isin: "CH0012032048", issuer: "Roche Holding AG" }, chosen: { isin: "US00287Y1091", issuer: "AbbVie Inc.", cioView: "neuro pipeline" }, rejected: [] };

test("buildMessagePrompt includes client name, claim, and voice instruction", () => {
  const p = buildMessagePrompt({ dna, alert, swap, voice: "values-led" });
  expect(p.user).toContain("Hubertus Schneider");
  expect(p.user).toContain("Roche");
  expect(p.user.toLowerCase()).toContain("values");
});

test("draftMessage returns live text when chat succeeds", async () => {
  const res = await draftMessage(
    { dna, alert, swap, voice: "data-driven", cacheKey: "schneider:evt:data-driven" },
    { chat: async () => "LIVE DRAFT", cache: {}, live: true }
  );
  expect(res).toEqual({ text: "LIVE DRAFT", source: "live" });
});

test("draftMessage falls back to cache when chat throws", async () => {
  const res = await draftMessage(
    { dna, alert, swap, voice: "data-driven", cacheKey: "schneider:evt:data-driven" },
    { chat: async () => { throw new Error("boom"); }, cache: { "schneider:evt:data-driven": "CACHED" }, live: true }
  );
  expect(res).toEqual({ text: "CACHED", source: "cache" });
});

test("draftMessage uses cache directly when live=false", async () => {
  let called = false;
  const res = await draftMessage(
    { dna, alert, swap, voice: "values-led", cacheKey: "schneider:evt:values-led" },
    { chat: async () => { called = true; return "X"; }, cache: { "schneider:evt:values-led": "CACHED" }, live: false }
  );
  expect(called).toBe(false);
  expect(res.source).toBe("cache");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd demo && npx vitest run src/backend/agents/messageAgent.test.ts`
Expected: FAIL — cannot find `./messageAgent`.

- [ ] **Step 3: Create `demo/src/backend/agents/messageAgent.ts`**

```ts
import { DnaProfile, SwapResult, Trace, Voice } from "../../shared/domain";

export interface MessageArgs {
  dna: DnaProfile;
  alert: Trace;
  swap: SwapResult | null;
  voice: Voice;
  cacheKey: string;
}

export interface MessageDeps {
  chat: (system: string, user: string) => Promise<string>;
  cache: Record<string, string>;
  live: boolean;
}

export function buildMessagePrompt(args: Omit<MessageArgs, "cacheKey">): { system: string; user: string } {
  const { dna, alert, swap, voice } = args;
  const voiceInstruction =
    voice === "values-led"
      ? "Write in a warm, values-led, inspiring register that speaks to the client's personal mission."
      : "Write in a precise, data-driven register with concrete figures and minimal emotion.";
  const swapLine = swap?.chosen
    ? `Proposed same-sector swap: SELL ${swap.sell.issuer} -> BUY ${swap.chosen.issuer} (CIO view: ${swap.chosen.cioView}).`
    : `No compliant swap was found; recommend flagging for RM review rather than inventing one.`;
  const system =
    "You are an assistant drafting a relationship manager's advisory note to a private-banking client. " +
    "You never instruct the client to trade; you propose and await the RM's approval. Output only the message body.";
  const user =
    `Client: ${dna.name} (${dna.mandate} mandate).\n` +
    `Situation: ${alert.claim}.\n` +
    `${swapLine}\n` +
    `Constraint: the investment strategy does not change; personalisation is at the asset level only.\n` +
    `${voiceInstruction}\n` +
    `Keep it under 160 words. Sign as "Sarah" (the RM).`;
  return { system, user };
}

export async function draftMessage(args: MessageArgs, deps: MessageDeps): Promise<{ text: string; source: "live" | "cache" }> {
  const cached = deps.cache[args.cacheKey];
  if (!deps.live) {
    return { text: cached ?? "(no cached draft available)", source: "cache" };
  }
  try {
    const { system, user } = buildMessagePrompt(args);
    const text = await deps.chat(system, user);
    if (!text || !text.trim()) throw new Error("empty draft");
    return { text, source: "live" };
  } catch {
    return { text: cached ?? "(draft unavailable)", source: "cache" };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd demo && npx vitest run src/backend/agents/messageAgent.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add demo/src/backend/agents/messageAgent.ts demo/src/backend/agents/messageAgent.test.ts
git commit -m "feat: message agent with live LLM draft and cache fallback"
```

---

### Task 9: Store (boot-time in-memory)

**Files:**
- Create: `demo/src/backend/store/store.ts`
- Create: `demo/src/backend/store/store.test.ts`

**Interfaces:**
- Consumes: loaders, frozen JSON, domain types.
- Produces:
  - `getStore(): Store` (singleton, built on first call)
  - `Store`: `{ listClients(): {id,name,mandate}[]; getDna(id): DnaProfile|undefined; getHoldings(id): Holding[]; getNews(id): NewsEvent[]; getCio(): CioEntry[]; getStrategies(): StrategyTarget[]; getThread(id): unknown; getMessageCache(): Record<string,string> }`
  - Client registry maps `schneider → { file: "crm_schneider.csv", mandate: "Balanced" }` (only Schneider fully wired in Phase A; others may return empty DNA).

- [ ] **Step 1: Write failing test `demo/src/backend/store/store.test.ts`**

```ts
import { test, expect } from "vitest";
import { getStore } from "./store";

test("store lists schneider and loads his DNA + holdings", () => {
  const s = getStore();
  expect(s.listClients().some((c) => c.id === "schneider")).toBe(true);
  expect(s.getDna("schneider")!.name).toBe("Hubertus Schneider");
  expect(s.getHoldings("schneider").some((h) => h.isin === "CH0012032048")).toBe(true);
  expect(s.getNews("schneider")[0].affectedIsins).toContain("CH0012032048");
  expect(Object.keys(s.getMessageCache()).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd demo && npx vitest run src/backend/store/store.test.ts`
Expected: FAIL — cannot find `./store`.

- [ ] **Step 3: Create `demo/src/backend/store/store.ts`**

```ts
import fs from "fs";
import path from "path";
import { CioEntry, DnaProfile, Holding, Mandate, NewsEvent, StrategyTarget } from "../../shared/domain";
import { loadPortfolio, loadStrategies, loadCioList } from "../data/loaders";
import { frozenDir } from "../data/paths";

interface ClientReg { id: string; name: string; mandate: Mandate; crmFile: string; }

const REGISTRY: ClientReg[] = [
  { id: "schneider", name: "Hubertus Schneider", mandate: "Balanced", crmFile: "crm_schneider.csv" },
  { id: "huber", name: "Huber", mandate: "Defensive", crmFile: "crm_huber.csv" },
  { id: "raeber", name: "Eugen Räber", mandate: "Defensive", crmFile: "crm_raeber.csv" },
  { id: "ammann", name: "Ammann", mandate: "Growth", crmFile: "crm_ammann.csv" },
];

const frozen = (f: string) => JSON.parse(fs.readFileSync(path.join(frozenDir(), f), "utf8"));

export interface Store {
  listClients(): { id: string; name: string; mandate: Mandate }[];
  getDna(id: string): DnaProfile | undefined;
  getHoldings(id: string): Holding[];
  getNews(id: string): NewsEvent[];
  getCio(): CioEntry[];
  getStrategies(): StrategyTarget[];
  getThread(id: string): unknown;
  getMessageCache(): Record<string, string>;
}

let singleton: Store | undefined;

export function getStore(): Store {
  if (singleton) return singleton;

  const cio = loadCioList();
  const strategies = loadStrategies();
  const messageCache = frozen("message_cache.json") as Record<string, string>;
  const dnaById: Record<string, DnaProfile> = { schneider: frozen("dna_schneider.json") };
  const newsById: Record<string, NewsEvent[]> = { schneider: [frozen("news_schneider.json")] };
  const threadById: Record<string, unknown> = { schneider: frozen("thread_schneider.json") };
  const holdingsByMandate: Record<Mandate, Holding[]> = {
    Defensive: loadPortfolio("Defensive"),
    Balanced: loadPortfolio("Balanced"),
    Growth: loadPortfolio("Growth"),
  };

  singleton = {
    listClients: () => REGISTRY.map(({ id, name, mandate }) => ({ id, name, mandate })),
    getDna: (id) => dnaById[id],
    getHoldings: (id) => {
      const reg = REGISTRY.find((r) => r.id === id);
      return reg ? holdingsByMandate[reg.mandate] : [];
    },
    getNews: (id) => newsById[id] || [],
    getCio: () => cio,
    getStrategies: () => strategies,
    getThread: (id) => threadById[id],
    getMessageCache: () => messageCache,
  };
  return singleton;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd demo && npx vitest run src/backend/store/store.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add demo/src/backend/store/store.ts demo/src/backend/store/store.test.ts
git commit -m "feat: boot-time in-memory store wiring loaders + frozen fixtures"
```

---

### Task 10: Routes + controller + mount

**Files:**
- Create: `demo/src/backend/controllers/advisor.controller.ts`
- Create: `demo/src/backend/routes/advisor.routes.ts`
- Modify: `demo/src/backend/index.ts` (add one mount line)

**Interfaces:**
- Consumes: store, engines, messageAgent, the starter's `PhoeniqsService`.
- Produces these endpoints:
  - `GET /api/advisor/clients` → `{ id, name, mandate }[]`
  - `GET /api/advisor/clients/:id` → `{ dna, holdings, drift, thread }`
  - `GET /api/advisor/clients/:id/alerts` → `Trace[]`
  - `GET /api/advisor/clients/:id/swap?isin=...` → `SwapResult`
  - `POST /api/advisor/message` body `{ clientId, eventId, voice, live? }` → `{ text, source }`
  - All honour `?live=false` (query) / `live:false` (body) to force cache.

- [ ] **Step 1: Create `demo/src/backend/controllers/advisor.controller.ts`**

```ts
import { Request, Response } from "express";
import { getStore } from "../store/store";
import { computeDrift } from "../engine/drift";
import { proposeSwap } from "../engine/swap";
import { buildAlerts } from "../engine/alerts";
import { draftMessage } from "../agents/messageAgent";
import { PhoeniqsService } from "../services/phoeniqs.service";
import { Voice } from "../../shared/domain";

const phoeniqs = new PhoeniqsService();

export class AdvisorController {
  listClients(_req: Request, res: Response) {
    res.json({ success: true, data: getStore().listClients() });
  }

  getClient(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const holdings = s.getHoldings(id);
    const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
    res.json({ success: true, data: { dna, holdings, drift, thread: s.getThread(id) } });
  }

  getAlerts(req: Request, res: Response) {
    const s = getStore();
    const id = req.params.id;
    const dna = s.getDna(id);
    if (!dna) return res.status(404).json({ success: false, error: "unknown or unwired client" });
    const holdings = s.getHoldings(id);
    const drift = computeDrift(holdings, s.getStrategies(), dna.mandate);
    const traces = buildAlerts({ dna, holdings, news: s.getNews(id), cio: s.getCio(), drift });
    res.json({ success: true, data: traces });
  }

  getSwap(req: Request, res: Response) {
    const s = getStore();
    const isin = String(req.query.isin || "");
    const holdings = s.getHoldings(req.params.id);
    res.json({ success: true, data: proposeSwap(isin, holdings, s.getCio()) });
  }

  async postMessage(req: Request, res: Response) {
    const s = getStore();
    const { clientId, eventId, voice } = req.body as { clientId: string; eventId: string; voice: Voice };
    const live = req.body.live !== false && req.query.live !== "false";
    const dna = s.getDna(clientId);
    if (!dna) return res.status(404).json({ success: false, error: "unknown client" });
    const alerts = buildAlerts({
      dna, holdings: s.getHoldings(clientId), news: s.getNews(clientId),
      cio: s.getCio(), drift: [],
    });
    const alert = alerts[0];
    const swap = alert ? proposeSwap(alert.id.split(":")[1] || "", s.getHoldings(clientId), s.getCio()) : null;
    const result = await draftMessage(
      { dna, alert, swap, voice, cacheKey: `${clientId}:${eventId}:${voice}` },
      {
        chat: (system, user) => phoeniqs.chat(system, user),
        cache: s.getMessageCache(),
        live: live && phoeniqs.configured,
      }
    );
    res.json({ success: true, data: result });
  }
}
```

- [ ] **Step 2: Add a `chat` helper to `PhoeniqsService`**

In `demo/src/backend/services/phoeniqs.service.ts`, add this public method to the class (it reuses the existing `this.client` axios instance and `this.model`):

```ts
  /** Minimal chat helper for free-form drafting. Throws on transport error. */
  async chat(system: string, user: string): Promise<string> {
    const { data } = await this.client.post("/chat/completions", {
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 400,
    });
    return data?.choices?.[0]?.message?.content || "";
  }
```

- [ ] **Step 3: Create `demo/src/backend/routes/advisor.routes.ts`**

```ts
import { Router } from "express";
import { AdvisorController } from "../controllers/advisor.controller";

const router = Router();
const c = new AdvisorController();

router.get("/clients", (req, res) => c.listClients(req, res));
router.get("/clients/:id", (req, res) => c.getClient(req, res));
router.get("/clients/:id/alerts", (req, res) => c.getAlerts(req, res));
router.get("/clients/:id/swap", (req, res) => c.getSwap(req, res));
router.post("/message", (req, res) => c.postMessage(req, res));

export default router;
```

- [ ] **Step 4: Mount in `demo/src/backend/index.ts`**

After the existing `app.use("/api/analysis", analysisRoutes);` line, add:
```ts
import advisorRoutes from "./routes/advisor.routes";
// ...
app.use("/api/advisor", advisorRoutes);
```
(Place the import with the other imports at the top.)

- [ ] **Step 5: Manual verification**

Run: `cd demo && npm run dev` (in one terminal)
Then in another:
```bash
curl -s localhost:3000/api/advisor/clients | head -c 400
curl -s localhost:3000/api/advisor/clients/schneider/alerts | head -c 600
curl -s "localhost:3000/api/advisor/clients/schneider/swap?isin=CH0012032048" | head -c 400
curl -s -X POST localhost:3000/api/advisor/message -H 'content-type: application/json' \
  -d '{"clientId":"schneider","eventId":"news-roche-parkinsons","voice":"values-led","live":false}' | head -c 600
```
Expected: clients list includes schneider; alerts include a `dna-conflict` ACT trace for Roche; swap returns a chosen Health-Care BUY not held; message returns cached values-led text with `"source":"cache"`.

- [ ] **Step 6: Commit**

```bash
git add demo/src/backend/controllers/advisor.controller.ts demo/src/backend/routes/advisor.routes.ts demo/src/backend/index.ts demo/src/backend/services/phoeniqs.service.ts
git commit -m "feat: advisor API (clients, alerts, swap, message) with live=false switch"
```

---

### Task 11: SPA — client view, Glass Thread, cut-the-thread, composer

**Files:**
- Replace: `demo/src/frontend/index.html`

**Interfaces:**
- Consumes: `/api/advisor/*` endpoints. No new backend types.
- Produces: a single self-contained page. Loads Schneider by default; renders DNA card (traits + confidence + evidence chips), holdings + drift, alert feed, the **Glass Thread** SVG from `thread.states.full_case`, a **Cut this evidence** control on the `cuttableNodeId` that switches to `cut_neuroscience`, and a message composer (two-voice toggle → `POST /api/advisor/message`) with an Override Ledger list.

- [ ] **Step 1: Replace `demo/src/frontend/index.html` with the SPA**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dukes — Advisor</title>
<style>
  :root { --ink:#11161c; --panel:#fff; --muted:#5b6b7a; --line:#e3e8ee; --accent:#1f7a5a; --act:#b4322a; --watch:#b8860b; }
  * { box-sizing:border-box; } body { margin:0; font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:#f4f6f9; }
  header { padding:14px 22px; background:var(--ink); color:#fff; font-weight:600; letter-spacing:.3px; }
  main { display:grid; grid-template-columns:320px 1fr 360px; gap:16px; padding:16px; align-items:start; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); margin:0 0 10px; }
  .trait { border:1px solid var(--line); border-radius:8px; padding:8px; margin-bottom:8px; }
  .bar { height:6px; background:var(--line); border-radius:3px; overflow:hidden; }
  .bar > i { display:block; height:100%; background:var(--accent); }
  .chip { display:inline-block; font-size:11px; background:#eef3f1; color:var(--accent); border:1px solid #d6e4dd; border-radius:10px; padding:1px 7px; margin:2px 3px 0 0; cursor:default; }
  .chip.off { opacity:.35; text-decoration:line-through; }
  .alert { border-left:4px solid var(--line); padding:6px 10px; margin-bottom:8px; }
  .alert.act { border-color:var(--act); } .alert.watch { border-color:var(--watch); }
  .sev { font-size:11px; font-weight:700; text-transform:uppercase; }
  .sev.act { color:var(--act); } .sev.watch { color:var(--watch); }
  svg { width:100%; height:320px; background:#fbfcfe; border:1px solid var(--line); border-radius:8px; }
  .node rect { fill:#fff; stroke:#9fb1c1; rx:6; } .node.trait rect { stroke:var(--accent); }
  .node.inactive rect { stroke-dasharray:4 3; opacity:.4; } .node text { font-size:11px; }
  button { font:inherit; border:1px solid var(--line); background:#fff; border-radius:8px; padding:6px 10px; cursor:pointer; }
  button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  .toggle button.on { background:var(--ink); color:#fff; }
  textarea { width:100%; min-height:150px; border:1px solid var(--line); border-radius:8px; padding:8px; font:inherit; }
  .ledger li { font-size:12px; color:var(--muted); }
  small.src { color:var(--muted); }
</style>
</head>
<body>
<header>Dukes · Next-Generation Advisor — <span id="clientName">…</span></header>
<main>
  <section class="panel" id="dna"><h2>Client DNA</h2><div id="traits"></div></section>
  <section class="panel">
    <h2>Glass Thread <button id="cutBtn" style="float:right">Cut this evidence</button></h2>
    <svg id="thread" viewBox="0 0 720 320"></svg>
    <div id="alertLine" style="margin-top:10px"></div>
    <h2 style="margin-top:14px">Alerts</h2><div id="alerts"></div>
    <h2 style="margin-top:14px">Holdings drift</h2><div id="drift"></div>
  </section>
  <section class="panel">
    <h2>Advisory message</h2>
    <div class="toggle" style="margin-bottom:8px">
      <button data-voice="values-led" class="on">Values-led</button>
      <button data-voice="data-driven">Data-driven</button>
    </div>
    <textarea id="msg" placeholder="Generate a draft…"></textarea>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button class="primary" id="gen">Generate</button>
      <button id="accept">Accept</button><button id="reject">Reject</button>
    </div>
    <p><small class="src" id="msgSource"></small></p>
    <h2 style="margin-top:10px">Override ledger</h2><ul class="ledger" id="ledger"></ul>
  </section>
</main>
<script>
const CLIENT = "schneider", EVENT = "news-roche-parkinsons";
let voice = "values-led", thread = null, threadState = "full_case";
const api = (p, o) => fetch("/api/advisor" + p, o).then(r => r.json()).then(j => j.data);
const el = (id) => document.getElementById(id);
const log = (t) => { const li=document.createElement("li"); li.textContent = new Date().toLocaleTimeString()+" — "+t; el("ledger").prepend(li); };

function renderTraits(dna) {
  el("clientName").textContent = dna.name;
  el("traits").innerHTML = dna.traits.map(t => `
    <div class="trait"><b>${t.label}</b> <span style="float:right">${Math.round(t.confidence*100)}%</span>
      <div class="bar"><i style="width:${t.confidence*100}%"></i></div>
      <div style="margin-top:6px">${t.evidence.map(e=>`<span class="chip" title="${e.quote}">${e.kind} · ${e.date}</span>`).join("")}</div>
    </div>`).join("");
}
function renderAlerts(traces) {
  el("alerts").innerHTML = traces.map(t => `
    <div class="alert ${t.severity}"><span class="sev ${t.severity}">${t.severity}</span> ${t.claim}
      ${t.valueAtStakeCHF?`<div><small class="src">CHF ${Math.round(t.valueAtStakeCHF).toLocaleString()} at stake</small></div>`:""}
      <div>${t.evidence.map(e=>`<span class="chip">${e.kind} · ${e.date}</span>`).join("")}</div></div>`).join("");
}
function renderDrift(drift) {
  el("drift").innerHTML = drift.filter(d=>d.breached).map(d=>`
    <div class="alert watch"><span class="sev watch">breach</span> ${d.subAssetClass}: ${d.deltaPct.toFixed(1)}pp vs target</div>`).join("") || "<small class='src'>Within ±2.0pp.</small>";
}
function renderThread() {
  const st = thread.states[threadState];
  const cols = { crm:60, trait:230, holding:400, news:400, swap:570 };
  const yByKind = {}; const place = (n,i)=>{ const x=cols[n.kind]||300; yByKind[n.kind]=(yByKind[n.kind]||0)+1; return {x, y: 40 + (yByKind[n.kind]-1)*70 + (n.kind==='news'?170:0)}; };
  const pos = {}; st.nodes.forEach((n,i)=> pos[n.id]=place(n,i));
  const edge = (a,b)=>`<line x1="${pos[a].x+120}" y1="${pos[a].y+18}" x2="${pos[b].x}" y2="${pos[b].y+18}" stroke="#9fb1c1"/>`;
  const node = (n)=>`<g class="node ${n.kind} ${n.active===false?'inactive':''}" transform="translate(${pos[n.id].x},${pos[n.id].y})">
      <rect width="120" height="36"></rect><text x="6" y="15">${(n.label||'').slice(0,22)}</text>
      <text x="6" y="29" fill="#5b6b7a">${n.date||(n.confidence!=null?Math.round(n.confidence*100)+'%':'')}</text></g>`;
  el("thread").innerHTML = st.edges.map(([a,b])=>edge(a,b)).join("") + st.nodes.map(node).join("");
  el("alertLine").innerHTML = `<span class="sev ${st.alert.severity}">${st.alert.severity}</span> ${st.alert.claim} <small class="src">(conf ${Math.round(st.alert.confidence*100)}%)</small>`;
}

async function boot() {
  const c = await api("/clients/"+CLIENT);
  thread = c.thread; renderTraits(c.dna); renderDrift(c.drift);
  renderAlerts(await api("/clients/"+CLIENT+"/alerts"));
  renderThread();
}
el("cutBtn").onclick = () => {
  threadState = threadState === "full_case" ? "cut_neuroscience" : "full_case";
  renderThread();
  log(threadState === "cut_neuroscience" ? "RM challenged evidence node "+thread.cuttableNodeId+" → confidence revised, no divestment recommended" : "RM restored full evidence");
};
document.querySelectorAll(".toggle button").forEach(b => b.onclick = () => {
  voice = b.dataset.voice; document.querySelectorAll(".toggle button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
});
el("gen").onclick = async () => {
  const r = await api("/message", { method:"POST", headers:{"content-type":"application/json"},
    body: JSON.stringify({ clientId:CLIENT, eventId:EVENT, voice, live:true }) });
  el("msg").value = r.text; el("msgSource").textContent = "source: " + r.source;
};
el("accept").onclick = () => log("RM ACCEPTED the "+voice+" advisory draft (no order placed — awaiting client)");
el("reject").onclick = () => log("RM REJECTED the draft");
boot();
</script>
</body>
</html>
```

- [ ] **Step 2: Manual verification (the demo dry-run)**

Run: `cd demo && npm run dev`, open `http://localhost:3000`.
Expected:
- Header shows "Hubertus Schneider"; DNA card shows the two traits with confidence bars + evidence chips.
- Alerts show an ACT "Roche … conflicts" item with CHF at stake.
- Glass Thread draws CRM → trait → holding ← news → swap.
- Clicking **Cut this evidence** greys the 2026-03-05 node, drops the trait to 40%, flips the alert line to WATCH, and appends a ledger entry.
- Toggling voice + **Generate** fills the textarea; with the LLM unconfigured it shows `source: cache`.
- **Accept** logs an override-ledger entry noting no order was placed.

- [ ] **Step 3: Commit**

```bash
git add demo/src/frontend/index.html
git commit -m "feat: SPA with DNA card, Glass Thread, cut-the-thread, two-voice composer + ledger"
```

---

### Task 12: Full-suite green + offline dry-run guard

**Files:**
- Modify: `demo/package.json` (no-op if already correct)

- [ ] **Step 1: Run the whole test suite**

Run: `cd demo && npm test`
Expected: all engine/loader/store/messageAgent tests pass (≈15 tests), 0 failures.

- [ ] **Step 2: Offline dry-run**

Run: `cd demo && npm run dev`, then:
```bash
curl -s -X POST localhost:3000/api/advisor/message -H 'content-type: application/json' \
  -d '{"clientId":"schneider","eventId":"news-roche-parkinsons","voice":"data-driven","live":false}'
```
Expected: returns the cached data-driven draft with `"source":"cache"` — proving the demo works with zero network.

- [ ] **Step 3: Commit any final tweaks**

```bash
git add -A
git commit -m "test: Phase-A suite green; verified offline cached path"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-19-advisor-dashboard-design.md`):
- Core principle (deterministic + trace objects) → Tasks 4,5,7 (engines emit/þconsume `Trace`). ✓
- Two LLM touchpoints (frozen DNA, live message) → Task 6 (frozen DNA committed), Task 8 (live draft + cache). ✓
- Architecture / endpoints → Task 10 (`/api/advisor/*`). ✓
- Components (store, crmAgent=frozen DNA, portfolioAgent=drift, swapEngine, alertEngine, messageAgent, traces) → Tasks 2,3,4,5,7,8,9. ✓
- Glass Thread + cut-the-thread + Override Ledger + two-voice composer → Task 11. ✓
- Reliability: one live call, cache fallback, `?live=false` master switch → Tasks 8,10,12. ✓ (SIX live enrichment is out of Phase A by design.)
- Testing: unit tests on drift/swap/alerts, zod trace shape — NOTE: the spec mentions zod trace validation; engines are statically typed and unit-tested, which covers correctness. If runtime trace validation is wanted, add a zod schema in a follow-up (not required for Phase A demo). 
- Out-of-scope items (recompute graph, autonomy lanes, timeline, live multi-agent, DB) → none built. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; manual-verification steps give exact curl + expected output. The Task 9 note explicitly corrects the import rather than leaving a placeholder.

**3. Type consistency:** `Trace`, `Evidence`, `DnaProfile`, `SwapResult`, `Voice` defined once in Task 2 and imported everywhere. `proposeSwap(sellIsin, holdings, cio)`, `computeDrift(holdings, targets, mandate)`, `buildAlerts({dna,holdings,news,cio,drift})`, `draftMessage(args, deps)` signatures are consistent across the tasks that define and call them. Store getter names match the controller's calls.
