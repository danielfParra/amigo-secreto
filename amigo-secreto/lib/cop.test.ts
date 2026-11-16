import { describe, test, expect } from "vitest";
import { parseCop, formatCop } from "./cop";

describe("parseCop", () => {
  test.each([
    ["$48.000", 48000],
    ["48.000", 48000],
    ["48000", 48000],
    ["  $ 1.234.567 ", 1234567],
    ["60000", 60000],
  ])("parses %s", (input, expected) => {
    expect(parseCop(input)).toBe(expected);
  });

  test.each([["abc"], ["-5"], ["0"], [""], ["   "], ["12abc"], ["4.8.0,5"], ["99999999999999"]])(
    "rejects %s",
    (input) => {
      expect(parseCop(input)).toBeNull();
    },
  );
});

describe("formatCop", () => {
  test("formats with $ and dot thousands", () => {
    expect(formatCop(60000)).toBe("$60.000");
    expect(formatCop(48000)).toBe("$48.000");
    expect(formatCop(999)).toBe("$999");
    expect(formatCop(1234567)).toBe("$1.234.567");
  });
});
