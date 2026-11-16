import { describe, test, expect } from "vitest";
import { sortNames, parseRoster, nameKey, NAME_MAX } from "./names";

describe("sortNames (Spanish alphabetical)", () => {
  test("accents sort with their base letter and Ñ comes after N", () => {
    expect(sortNames(["Zulema Gil", "Ángela Soto", "Ñandú Pérez", "Nicolás Ruiz", "Pupo Vega", "alejandra Mora"])).toEqual([
      "alejandra Mora",
      "Ángela Soto",
      "Nicolás Ruiz",
      "Ñandú Pérez",
      "Pupo Vega",
      "Zulema Gil",
    ]);
  });

  test("same first name is ordered by surname, and the input is not mutated", () => {
    const input = ["Daniel Reyes", "Daniel Parra", "Ana Ruiz"];
    expect(sortNames(input)).toEqual(["Ana Ruiz", "Daniel Parra", "Daniel Reyes"]);
    expect(input).toEqual(["Daniel Reyes", "Daniel Parra", "Ana Ruiz"]);
  });

  test("sortBy orders objects by a name field", () => {
    const rows = [{ name: "Luisa León" }, { name: "Laura Ramírez" }];
    expect(sortNames(rows, (r) => r.name).map((r) => r.name)).toEqual(["Laura Ramírez", "Luisa León"]);
  });
});

describe("nameKey", () => {
  test("ignores case, repeated spaces and unicode composition", () => {
    expect(nameKey("  Nicolás   PARRA ")).toBe(nameKey("nicolás parra"));
    expect(nameKey("Nicolás")).toBe(nameKey("Nicolás"));
    expect(nameKey("Ana")).not.toBe(nameKey("Anna"));
  });
});

describe("parseRoster", () => {
  test("accepts names separated by lines, commas or semicolons and tidies spaces", () => {
    const r = parseRoster("Ana  Ruiz, Bea Soto\r\nCarlos Díaz;  \n\n Dora Gil ,");
    expect(r.names).toEqual(["Ana Ruiz", "Bea Soto", "Carlos Díaz", "Dora Gil"]);
    expect(r.duplicates).toEqual([]);
    expect(r.tooLong).toEqual([]);
  });

  test("reports case-insensitive duplicates once and keeps the first spelling", () => {
    const r = parseRoster("Ana Ruiz, ana  ruiz, Bea Soto, ANA RUIZ");
    expect(r.names).toEqual(["Ana Ruiz", "Bea Soto"]);
    expect(r.duplicates).toEqual(["ana ruiz"]);
  });

  test("reports names over the length limit and does not include them", () => {
    const long = "x".repeat(NAME_MAX + 1);
    const r = parseRoster(`Ana Ruiz, ${long}`);
    expect(r.names).toEqual(["Ana Ruiz"]);
    expect(r.tooLong).toEqual([long]);
  });

  test("empty input gives an empty roster", () => {
    expect(parseRoster("  \n , ;")).toEqual({ names: [], duplicates: [], tooLong: [] });
  });
});
