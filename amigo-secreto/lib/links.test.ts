import { describe, test, expect } from "vitest";
import { safeHref } from "./links";

describe("safeHref", () => {
  test.each([
    ["tienda.com/libro", "https://tienda.com/libro"],
    ["  www.tienda.com/a?b=1  ", "https://www.tienda.com/a?b=1"],
    ["https://tienda.com/libro", "https://tienda.com/libro"],
    ["http://tienda.com", "http://tienda.com/"],
    ["HTTPS://Tienda.com/Libro", "https://tienda.com/Libro"],
  ])("makes %j clickable as %s", (input, expected) => {
    expect(safeHref(input)).toBe(expected);
  });

  test.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    ["ftp://tienda.com/file"],
    ["file:///etc/passwd"],
    ["//evil.com/x"],
    ["https://"],
    ["una taza bonita"],
    ["   "],
    [""],
    [null],
  ])("refuses %j", (input) => {
    expect(safeHref(input as string | null)).toBeNull();
  });
});
