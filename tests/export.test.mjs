import test from "node:test";
import assert from "node:assert/strict";
import { csv } from "../public/ui.js";
test("CSV protects formula-like values including whitespace and Unicode prefixes", () => {
  for (const value of [
    "=1+1",
    "+SUM(1)",
    "-1",
    "@cmd",
    "\n=1+1",
    "\t=1+1",
    "  =1+1",
    "＝1+1",
    "＋1",
    "－1",
    "＠command",
  ])
    assert.ok(csv([[value]]).startsWith("\ufeff\"'"), JSON.stringify(value));
  assert.equal(
    csv([["Hello", 'A "quote"', "line\nbreak"]]),
    '\ufeff"Hello","A ""quote""","line\nbreak"',
  );
});

test("negative finite numbers remain numeric while text formulas stay protected", () => {
  assert.equal(
    csv([[-10, 0, 12.5, "-10", "=1+2"]]),
    '\ufeff"-10","0","12.5","\'-10","\'=1+2"',
  );
});
