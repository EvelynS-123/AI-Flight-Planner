import type {
  ProviderGenerationInput,
  TravelAIProvider,
  TravelProviderId,
  TravelSearchProvider,
  TravelSearchResult,
} from "./types.ts";

type ProviderConfig = {
  id: TravelProviderId;
  baseUrl: string;
  model: string;
  fastModel?: string;
  apiKeyEnv: string;
};

type ProviderEnvironment = Record<string, string | undefined>;

const SEARCH_RESPONSE_CACHE = new Map<string, {
  expiresAt: number;
  results: TravelSearchResult[];
}>();

export const TRAVEL_PROVIDER_CONFIGS: Record<TravelProviderId, ProviderConfig> = {
  deepseek: {
    id: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-pro",
    fastModel: "deepseek-v4-flash",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  glm: {
    id: "glm",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5.2",
    fastModel: "glm-4.5-flash",
    apiKeyEnv: "GLM_API_KEY",
  },
  kimi: {
    id: "kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-32k",
    apiKeyEnv: "KIMI_API_KEY",
  },
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function readProviderId(environment: ProviderEnvironment): TravelProviderId {
  const candidate = environment.TRAVEL_AI_PROVIDER?.toLowerCase();
  return candidate === "glm" || candidate === "kimi" ? candidate : "deepseek";
}

export function createTravelAIProvider(
  environment: ProviderEnvironment = process.env,
  fetchImpl: typeof fetch = fetch,
): TravelAIProvider | null {
  const id = readProviderId(environment);
  const defaults = TRAVEL_PROVIDER_CONFIGS[id];
  const apiKey = environment[defaults.apiKeyEnv];
  if (!apiKey) return null;

  const baseUrl = normalizeBaseUrl(environment.TRAVEL_AI_BASE_URL || defaults.baseUrl);
  const model = environment.TRAVEL_AI_MODEL || defaults.model;
  const fastModel = environment.TRAVEL_AI_FAST_MODEL || defaults.fastModel || model;
  const modelForPurpose = (purpose?: ProviderGenerationInput["purpose"]) => (
    purpose === "query-discovery" || purpose === "audit" ? fastModel : model
  );

  return {
    id,
    model,
    modelForPurpose,
    async generateJson(input: ProviderGenerationInput) {
      const requestModel = modelForPurpose(input.purpose);
      const body: Record<string, unknown> = {
        model: requestModel,
        messages: [
          { role: "system", content: input.systemPrompt },
          ...(input.history || []),
          { role: "user", content: input.userPrompt },
        ],
        stream: false,
        max_tokens: input.purpose === "planning"
          ? 5200
          : input.purpose === "query-discovery"
            ? 2200
            : 4500,
        response_format: { type: "json_object" },
        temperature: input.purpose === "audit" ? 0.1 : 0.45,
      };

      if (id === "deepseek" || id === "glm") {
        body.thinking = { type: "disabled" };
      }

      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 2) break;
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMilliseconds = Number.isFinite(retryAfter)
          ? Math.max(500, retryAfter * 1000)
          : 800 * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
      }

      if (!response) throw new Error("Travel AI did not return a response.");
      if (!response.ok) {
        throw new Error(`Travel AI request failed with status ${response.status}.`);
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Travel AI returned an empty response.");

      try {
        return JSON.parse(content);
      } catch {
        throw new Error("Travel AI returned invalid JSON.");
      }
    },
  };
}

export function createTravelSearchProvider(
  environment: ProviderEnvironment = process.env,
  fetchImpl: typeof fetch = fetch,
): TravelSearchProvider | null {
  const apiKey = environment.BOCHA_API_KEY;
  if (!apiKey) return null;
  const baseUrl = normalizeBaseUrl(
    environment.TRAVEL_SEARCH_BASE_URL || "https://api.bochaai.com/v1",
  );
  const cacheTtlMilliseconds = Math.max(
    0,
    Number(environment.TRAVEL_SEARCH_CACHE_TTL_MS || 15 * 60_000),
  );

  return {
    id: "bocha-web-search",
    async search(query, requestedCount = 5) {
      const count = Math.max(1, Math.min(10, Math.round(requestedCount)));
      const cacheKey = `${baseUrl}|${count}|${query}`;
      const cached = SEARCH_RESPONSE_CACHE.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.results.map((result) => ({ ...result }));
      }
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetchImpl(`${baseUrl}/web-search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: query.slice(0, 300),
            summary: true,
            count,
          }),
        });
        if (response.status !== 429 || attempt === 2) break;
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMilliseconds = Number.isFinite(retryAfter)
          ? Math.max(250, retryAfter * 1000)
          : 500 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
      }
      if (!response) throw new Error("Live search did not return a response.");
      if (!response.ok) {
        throw new Error(`Live search request failed with status ${response.status}.`);
      }
      const payload = await response.json() as {
        code?: number;
        msg?: string | null;
        webPages?: {
          value?: Array<{
            name?: string;
            url?: string;
            snippet?: string;
            summary?: string;
            siteName?: string;
          }>;
        };
        data?: {
          webPages?: {
            value?: Array<{
              name?: string;
              url?: string;
              snippet?: string;
              summary?: string;
              siteName?: string;
            }>;
          };
        };
      };
      if (payload.code !== undefined && payload.code !== 200) {
        throw new Error(`Live search provider rejected the request with code ${payload.code}.`);
      }
      const values = payload.data?.webPages?.value || payload.webPages?.value || [];
      const results = values.map((item) => ({
        id: "",
        query,
        title: item.name || "",
        url: item.url || "",
        snippet: item.summary || item.snippet || "",
        siteName: item.siteName,
      }));
      if (cacheTtlMilliseconds > 0) {
        SEARCH_RESPONSE_CACHE.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMilliseconds,
          results,
        });
      }
      return results.map((result) => ({ ...result }));
    },
  };
}
