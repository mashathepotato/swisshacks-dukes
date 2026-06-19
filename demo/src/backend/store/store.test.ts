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
