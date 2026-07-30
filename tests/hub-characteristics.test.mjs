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

test("airport table supplies city names before AI localization", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  const originalKey = process.env.GLM_API_KEY;
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  let receivedHubs;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    receivedHubs = JSON.parse(request.messages.at(-1).content).hubs;
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            hubs: [
              { code: "BAH", city: "麦纳麦", reason: "海湾文化、集市与滨海城市生活" },
              { code: "SHJ", city: "沙迦", reason: "博物馆、传统街区与阿拉伯文化" },
              { code: "KUL", city: "吉隆坡", reason: "多元美食、热带绿意与现代都市生活" },
              { code: "CPH", city: "Copenhagen", reason: "北欧设计、港湾与自行车文化" },
            ],
          }),
        },
      }],
    });
  };

  try {
    const response = await POST(new Request("http://local/api/chat/hub-characteristics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: "zh",
        hubs: [
          { code: "BAH", city: "Bahrain International Airport" },
          { code: "SHJ", city: "Sharjah International Airport" },
          { code: "KUL", city: "Kuala Lumpur International Airport" },
          { code: "CPH", city: "Copenhagen Airport" },
        ],
      }),
    }));
    const data = await response.json();

    assert.deepEqual(receivedHubs, [
      { code: "BAH", city: "Manama" },
      { code: "SHJ", city: "Sharjah" },
      { code: "KUL", city: "Kuala Lumpur" },
      { code: "CPH", city: "Copenhagen" },
    ]);
    assert.equal(data.hubs.BAH.city, "巴林");
    assert.equal(data.hubs.SHJ.city, "沙迦");
    assert.equal(data.hubs.KUL.city, "吉隆坡");
    assert.equal(data.hubs.CPH.city, "哥本哈根");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
  }
});
