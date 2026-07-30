import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const flightChatSource = await readFile(
  new URL("../app/flight-chat.tsx", import.meta.url),
  "utf8",
);

test("AI hub suggestions missing from the discovery result remain selectable", () => {
  assert.match(
    flightChatSource,
    /\.filter\(\(option\) => !seen\.has\(option\.code\)\)[\s\S]*isRouteUnverified: true/,
  );
  assert.match(
    flightChatSource,
    /return \[\.\.\.verifiedOptions, \.\.\.unverifiedOptions\]/,
  );
});

test("only unverified route suggestions receive the date availability hint", () => {
  assert.match(
    flightChatSource,
    /option\.isRouteUnverified && \([\s\S]*title=\{hubCopy\.unverified\}/,
  );
  assert.match(
    flightChatSource,
    /unverified: "所选日期可能查询不到相关航线"/,
  );
});
