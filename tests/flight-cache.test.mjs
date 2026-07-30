import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  readPersistentFlightSearchCache,
  setFlightSearchDatabase,
  writePersistentFlightSearchCache,
} from "../db/flight-search-cache.ts";

class FakeStatement {
  constructor(database, query) {
    this.database = database;
    this.query = query;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (!this.query.startsWith("SELECT")) return null;
    const [key, now] = this.values;
    const row = this.database.rows.get(key);
    return row && row.expires_at > now ? row : null;
  }

  async run() {
    if (this.query.startsWith("INSERT")) {
      const [key, resultsJson, expiresAt, createdAt] = this.values;
      this.database.rows.set(key, {
        results_json: resultsJson,
        expires_at: expiresAt,
        created_at: createdAt,
      });
    } else if (this.query.startsWith("DELETE")) {
      const [now] = this.values;
      for (const [key, row] of this.database.rows) {
        if (row.expires_at <= now) this.database.rows.delete(key);
      }
    }
    return {};
  }
}

class FakeDatabase {
  rows = new Map();

  prepare(query) {
    return new FakeStatement(this, query.trim());
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

test("flight cache survives outside the in-memory route cache", async () => {
  const database = new FakeDatabase();
  setFlightSearchDatabase(database);
  const results = [{ id: "verified-flight", price: 320 }];

  assert.equal(
    await writePersistentFlightSearchCache("route-key", results, 2_000, 1_000),
    true,
  );
  assert.deepEqual(
    await readPersistentFlightSearchCache("route-key", 1_500),
    { results, expiresAt: 2_000 },
  );
  assert.equal(await readPersistentFlightSearchCache("route-key", 2_001), null);
  setFlightSearchDatabase(undefined);
});

test("persistent cache key excludes the SerpApi secret", async () => {
  const source = await readFile(
    new URL("../app/api/flights/search/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /canonicalUrl\.searchParams\.delete\("api_key"\)/);
  assert.match(source, /FLIGHT_SEARCH_CACHE_TTL_MS \|\| 604800000/);
  assert.match(source, /readPersistentFlightSearchCache\(cacheKey\)/);
  assert.match(source, /writePersistentFlightSearchCache\(cacheKey, parsed, expiresAt\)/);
});
