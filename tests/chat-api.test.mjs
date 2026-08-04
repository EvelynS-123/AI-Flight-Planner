import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompactDatePrompt,
  POST,
} from "../app/api/chat/route.ts";
import { POST as preferenceChatPOST } from "../app/api/preferences/chat/route.ts";
import { POST as preferenceEvaluatePOST } from "../app/api/preferences/evaluate/route.ts";

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

test("search chat resolves contextual choices and obvious city typos without refusing", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  const originalKey = process.env.GLM_API_KEY;
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  let providerRequest;
  globalThis.fetch = async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            searchReady: false,
            reply: "What date would you like to leave for Taipei?",
          }),
        },
      }],
    });
  };

  try {
    const response = await POST(new Request("http://local/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: "en",
        messages: [
          { role: "user", content: "I want one stop on the way." },
          { role: "assistant", content: "Would you prefer Tokyo or Taipei?" },
          { role: "user", content: "the latter" },
        ],
      }),
    }));
    const data = await response.json();
    const systemPrompt = providerRequest.messages[0].content;

    assert.equal(response.status, 200);
    assert.equal(data.reply, "What date would you like to leave for Taipei?");
    assert.deepEqual(providerRequest.messages.slice(1, 3), [
      { role: "user", content: "I want one stop on the way." },
      { role: "assistant", content: "Would you prefer Tokyo or Taipei?" },
    ]);
    assert.match(systemPrompt, /former.*latter.*immediately preceding/i);
    assert.match(systemPrompt, /obvious city.*misspell/i);
    assert.match(systemPrompt, /do not refuse/i);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
  }
});

test("preference chat uses natural interviewing and stores semantic preference facts", async () => {
  const keyNames = ["DEEPSEEK_API_KEY", "GLM_API_KEY", "KIMI_API_KEY"];
  const originals = Object.fromEntries(keyNames.map((key) => [key, process.env[key]]));
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  const originalFetch = globalThis.fetch;
  keyNames.forEach((key) => delete process.env[key]);
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  let providerRequest;
  globalThis.fetch = async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "What do you enjoy most about a ski trip?",
            readyToSave: true,
            memory: {
              summary: "Especially enjoys skiing.",
              facts: [{
                statement: "The user especially enjoys skiing and mountain destinations.",
                scope: "destination-experience",
                axis: "interest",
                polarity: "like",
                strength: 5,
                hardConstraint: false,
                evidence: "The user said skiing is a favorite hobby.",
              }],
            },
          }),
        },
      }],
    });
  };
  try {
    const response = await preferenceChatPOST(new Request("http://local/api/preferences/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: "zh",
        currentMemory: null,
        messages: [
          { role: "user", content: "我喜欢街头美食" },
          { role: "assistant", content: "时间呢" },
          { role: "user", content: "晚上出发" },
          { role: "assistant", content: "转机呢" },
          { role: "user", content: "绝不接受过夜或自助转机" },
          { role: "assistant", content: "航空公司呢" },
          { role: "user", content: "偏爱 JAL" },
        ],
      }),
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.readyToSave, true);
    assert.equal(data.memory.version, 3);
    assert.equal(data.memory.facts[0].statement, "The user especially enjoys skiing and mountain destinations.");
    assert.match(providerRequest.messages[0].content, /Interview naturally/);
    assert.match(providerRequest.messages[0].content, /Do not default to binary/);
    assert.match(providerRequest.messages[0].content, /names contain the word "Air"/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keyNames) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
  }
});

test("preference evaluator applies arbitrary semantic rules to every route", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GLM_API_KEY;
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  let providerRequest;
  globalThis.fetch = async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            evaluations: [
              {
                routeId: "air-route",
                interest: 10,
                directness: 80,
                interestComponents: [{
                  label: "Airline name preference",
                  score: 10,
                  weight: 100,
                  reason: "The airline name contains Air.",
                }],
                directnessComponents: [{
                  label: "Route simplicity",
                  score: 80,
                  weight: 100,
                  reason: "The route is direct.",
                }],
                strongPreferencePenalty: 15,
                hardConstraintViolated: false,
                matchedPreferences: ["Dislikes airline names containing Air"],
                explanation: "The airline name contains Air.",
              },
              {
                routeId: "other-route",
                interest: 90,
                directness: 70,
                interestComponents: [{
                  label: "Airline name preference",
                  score: 90,
                  weight: 100,
                  reason: "The airline name does not contain Air.",
                }],
                directnessComponents: [{
                  label: "Route simplicity",
                  score: 70,
                  weight: 100,
                  reason: "The route is direct.",
                }],
                strongPreferencePenalty: 0,
                hardConstraintViolated: false,
                matchedPreferences: ["Dislikes airline names containing Air"],
                explanation: "The airline name does not contain Air.",
              },
            ],
          }),
        },
      }],
    });
  };
  try {
    const memory = {
      version: 3,
      mode: "personalized",
      summary: "Dislikes airline names containing Air.",
      facts: [{
        statement: "The user dislikes airlines whose names contain the word Air.",
        scope: "airline",
        axis: "interest",
        polarity: "dislike",
        strength: 5,
        hardConstraint: false,
        evidence: "The user stated this directly.",
      }],
    };
    const candidate = (routeId, name) => ({
      routeId,
      origin: "PVG",
      destination: "LAX",
      ticketType: "direct",
      stopCount: 0,
      totalPrice: 500,
      totalDurationMinutes: 720,
      airlines: [{ code: "XX", name }],
      departureLocal: "2026-09-01 10:00",
      arrivalLocal: "2026-09-01 18:00",
      stopovers: [],
    });
    const response = await preferenceEvaluatePOST(new Request("http://local/api/preferences/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory,
        candidates: [
          candidate("air-route", "Example Air"),
          candidate("other-route", "Nimbus"),
        ],
      }),
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.evaluations.length, 2);
    assert.equal(data.evaluations[0].interest, 10);
    assert.equal(data.evaluations[0].strongPreferencePenalty, 15);
    assert.equal(data.evaluations[0].interestComponents[0].weight, 100);
    assert.match(providerRequest.messages[0].content, /fixed tag list/);
    assert.match(providerRequest.messages[0].content, /Component weights within each axis must sum to 100/);
    assert.match(providerRequest.messages[0].content, /strongPreferencePenalty/);
    assert.match(providerRequest.messages.at(-1).content, /Example Air/);
    assert.match(providerRequest.messages.at(-1).content, /Nimbus/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
  }
});

test("preference evaluator batches large route sets before requesting AI output", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GLM_API_KEY;
  const originalProvider = process.env.TRAVEL_AI_PROVIDER;
  process.env.TRAVEL_AI_PROVIDER = "glm";
  process.env.GLM_API_KEY = "test-secret";
  const providerRequests = [];
  globalThis.fetch = async (_url, init) => {
    const providerRequest = JSON.parse(init.body);
    providerRequests.push(providerRequest);
    const prompt = JSON.parse(providerRequest.messages.at(-1).content);
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            evaluations: prompt.candidates.map((candidate, index) => ({
              routeId: candidate.routeId,
              interest: 60 + index,
              directness: 70 + index,
              interestComponents: [{
                label: "Interest match",
                score: 60 + index,
                weight: 100,
                reason: "Matches the test preference.",
              }],
              directnessComponents: [{
                label: "Route simplicity",
                score: 70 + index,
                weight: 100,
                reason: "Uses the supplied route facts.",
              }],
              hardConstraintViolated: false,
              matchedPreferences: ["Likes food and culture"],
              explanation: "Test evaluation.",
            })),
          }),
        },
      }],
    });
  };
  try {
    const memory = {
      version: 3,
      mode: "personalized",
      summary: "Likes food and culture.",
      facts: [{
        statement: "The user likes food and culture.",
        scope: "experience",
        axis: "interest",
        polarity: "like",
        strength: 5,
        hardConstraint: false,
        evidence: "The user stated this directly.",
      }],
    };
    const candidates = Array.from({ length: 19 }, (_, index) => ({
      routeId: `route-${index + 1}`,
      origin: "PVG",
      destination: "LAX",
      ticketType: "connection",
      stopCount: 1,
      totalPrice: 500 + index,
      totalDurationMinutes: 900 + index,
      airlines: [{ code: "XX", name: "Example Airways" }],
      departureLocal: "2026-09-01 10:00",
      arrivalLocal: "2026-09-01 18:00",
      stopovers: [{
        airport: "NRT",
        cityName: "Tokyo",
        kind: "connection",
        durationMinutes: 180,
        usableMinutes: 0,
      }],
    }));
    const response = await preferenceEvaluatePOST(new Request("http://local/api/preferences/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory, candidates, locale: "en" }),
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.evaluations.length, 19);
    assert.deepEqual(
      new Set(data.evaluations.map((evaluation) => evaluation.routeId)),
      new Set(candidates.map((candidate) => candidate.routeId)),
    );
    assert.equal(providerRequests.length, 3);
    assert.deepEqual(
      providerRequests
        .map((request) => JSON.parse(request.messages.at(-1).content).candidates.length)
        .sort((a, b) => a - b),
      [3, 8, 8],
    );
    assert.match(providerRequests[0].messages[0].content, /same absolute scoring standard/i);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.TRAVEL_AI_PROVIDER;
    else process.env.TRAVEL_AI_PROVIDER = originalProvider;
  }
});
