import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/chat/hub-characteristics/route.ts";

test("hub descriptions localize a live airport name to its city", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  const originalKey = process.env.GLM_API_KEY;
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  globalThis.fetch = async () => Response.json({
    choices: [{
      message: {
        content: JSON.stringify({
          hubs: [{
            code: "CKG",
            city: "重庆",
            reason: "山城火锅、立体街区与两江夜景",
          }],
        }),
      },
    }],
  });

  try {
    const response = await POST(new Request("http://local/api/chat/hub-characteristics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: "zh",
        hubs: [{
          code: "CKG",
          city: "Chongqing Jiangbei International Airport",
        }],
      }),
    }));
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(data.hubs.CKG, {
      city: "重庆",
      reason: "山城火锅、立体街区与两江夜景",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
  }
});
