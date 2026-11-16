import { test, expect } from "vitest";
import { formatEventDate } from "./dates";

test("formats an ISO date as day and month in Spanish, independent of timezone", () => {
  expect(formatEventDate("2026-12-24")).toBe("24 de diciembre");
  expect(formatEventDate("2026-01-05")).toBe("5 de enero");
});

test("returns null for empty or malformed input", () => {
  expect(formatEventDate(null)).toBeNull();
  expect(formatEventDate("")).toBeNull();
  expect(formatEventDate("24/12/2026")).toBeNull();
  expect(formatEventDate("2026-13-40")).toBeNull();
});
