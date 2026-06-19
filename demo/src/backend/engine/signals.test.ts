import { test, expect } from "vitest";
import { classifySignal } from "./signals";

test("flags messages that signal an intent to sell / exit or distress", () => {
  expect(classifySignal("I want to dump all my Nvidia").flagged).toBe(true);
  expect(classifySignal("Please sell my position, I'm worried").flagged).toBe(true);
  expect(classifySignal("I'd like to exit this fund").flagged).toBe(true);
});

test("does not flag routine / informational messages", () => {
  const r = classifySignal("Thanks for the update, talk next month.");
  expect(r.flagged).toBe(false);
  expect(r.reason).toBeTruthy();
});

test("flagged result carries a human-readable reason", () => {
  const r = classifySignal("I'm nervous about the scandal, get me out");
  expect(r.flagged).toBe(true);
  expect(r.reason.length).toBeGreaterThan(0);
});
