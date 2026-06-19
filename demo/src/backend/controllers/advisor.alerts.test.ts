import { test, expect } from "vitest";
import { clientAlerts } from "./advisor.controller";
import { getStore } from "../store/store";

// Integration: a flagged inbound message must surface as the top alert for the
// client (the path store.addSignal -> clientAlerts that the inbox ranking relies on).
test("a flagged client signal becomes the client's top alert", () => {
  const s = getStore();
  const before = clientAlerts(s, "schneider");
  expect(before[0].type).not.toBe("client-signal");

  s.addSignal({
    id: "sig-test-1",
    clientId: "schneider",
    text: "I want to sell everything now",
    receivedAt: "2026-06-19T00:00:00.000Z",
    flagged: true,
    reason: "test",
  });

  const after = clientAlerts(s, "schneider");
  expect(after[0].type).toBe("client-signal");
  expect(after[0].severity).toBe("act");
  expect(after.length).toBe(before.length + 1);
});
