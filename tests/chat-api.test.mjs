import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompactDatePrompt,
  POST,
} from "../app/api/chat/route.ts";

test("compact conversational dates are normalized without changing the visible message", () => {
  assert.equal(normalizeCompactDatePrompt("9.15"), "2026-09-15");
  assert.equal(normalizeCompactDatePrompt("9.15、"), "2026-09-15");
  assert.equal(normalizeCompactDatePrompt("9/15"), "2026-09-15");
  assert.equal(normalizeCompactDatePrompt("9-15"), "2026-09-15");
  assert.equal(normalizeCompactDatePrompt("2.30"), "2.30");
});

test("chat retries once when the provider returns malformed JSON", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  const originalKey = process.env.GLM_API_KEY;
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  const requests = [];

  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const content = requests.length === 1
      ? "not valid JSON"
      : JSON.stringify({
          searchReady: true,
          reply: "正在准备搜索",
          params: {
            legs: [{ origins: ["CDG"], destinations: ["BKK"] }],
            dateRangeStart: "2026-09-15",
            dateRangeEnd: "2026-09-15",
            tripType: "one_way",
          },
        });
    return Response.json({ choices: [{ message: { content } }] });
  };

  try {
    const response = await POST(new Request("http://local/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: "zh",
        messages: [
          { role: "user", content: "巴黎飞曼谷" },
          { role: "assistant", content: "请问什么时候出发？" },
          { role: "user", content: "9.15、" },
        ],
      }),
    }));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].messages.at(-1).content, "2026-09-15");
    assert.equal(requests[1].messages.at(-1).content, "2026-09-15");
    assert.equal(data.searchReady, true);
    assert.equal(data.params.tripType, "one_way");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
  }
});
