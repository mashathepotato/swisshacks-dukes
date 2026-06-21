import { describe, it, expect } from "vitest";
import { defaultPref, COMM_DEFAULTS, FALLBACK_PREF, SLOT_META, CALL_SLOTS } from "./commPrefs";

describe("commPrefs call slots", () => {
  it("exposes the four day-part slots in chronological order", () => {
    expect(CALL_SLOTS).toEqual(["morning", "lunch", "afternoon", "evening"]);
    for (const s of CALL_SLOTS) {
      expect(SLOT_META[s].label).toBeTruthy();
      expect(SLOT_META[s].hours).toMatch(/\d/);
    }
  });

  it("every authored persona default carries at least one valid slot", () => {
    for (const pref of Object.values(COMM_DEFAULTS)) {
      expect(pref.slots.length).toBeGreaterThan(0);
      for (const s of pref.slots) expect(CALL_SLOTS).toContain(s);
    }
  });

  it("falls back to a pref with slots for unknown clients", () => {
    expect(defaultPref("not-a-real-client")).toEqual(FALLBACK_PREF);
    expect(FALLBACK_PREF.slots.length).toBeGreaterThan(0);
  });
});
