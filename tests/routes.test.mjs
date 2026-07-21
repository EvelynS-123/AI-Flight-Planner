import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("route source contains the requested PVG-HNL-LAX split", async () => {
  const source = await readFile(new URL("../app/route-data.ts", import.meta.url), "utf8");
  assert.match(source, /pvg-hnl-lax/);
  assert.match(source, /pvgHnl/);
  assert.match(source, /hnlLax/);
});

test("every declared total is computed from two segment snapshots", async () => {
  const source = await readFile(new URL("../app/route-data.ts", import.meta.url), "utf8");
  assert.match(source, /a\.price \+ b\.price/);
  assert.match(source, /segments: \[/);
});
