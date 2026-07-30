import {
  CREATE_FLIGHT_SEARCH_CACHE_EXPIRY_INDEX,
  CREATE_FLIGHT_SEARCH_CACHE_TABLE,
} from "./schema.ts";

type FlightSearchCacheRow = {
  results_json: string;
  expires_at: number;
};

type FlightCacheStatement = {
  bind(...values: unknown[]): FlightCacheStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type FlightSearchDatabase = {
  prepare(query: string): FlightCacheStatement;
  batch(statements: FlightCacheStatement[]): Promise<unknown>;
};

const DATABASE_SYMBOL = Symbol.for("via.flight-search.database");
const initializedDatabases = new WeakSet<object>();

function runtimeStore() {
  return globalThis as typeof globalThis & Record<symbol, FlightSearchDatabase | undefined>;
}

export function setFlightSearchDatabase(database: FlightSearchDatabase | undefined) {
  runtimeStore()[DATABASE_SYMBOL] = database;
}

function getFlightSearchDatabase() {
  return runtimeStore()[DATABASE_SYMBOL];
}

async function ensureSchema(database: FlightSearchDatabase) {
  if (initializedDatabases.has(database as object)) return;
  await database.batch([
    database.prepare(CREATE_FLIGHT_SEARCH_CACHE_TABLE),
    database.prepare(CREATE_FLIGHT_SEARCH_CACHE_EXPIRY_INDEX),
  ]);
  initializedDatabases.add(database as object);
}

export async function readPersistentFlightSearchCache(
  cacheKey: string,
  now = Date.now(),
) {
  const database = getFlightSearchDatabase();
  if (!database) return null;

  try {
    await ensureSchema(database);
    const row = await database
      .prepare(
        "SELECT results_json, expires_at FROM flight_search_cache WHERE cache_key = ? AND expires_at > ? LIMIT 1",
      )
      .bind(cacheKey, now)
      .first<FlightSearchCacheRow>();
    if (!row) return null;
    const results = JSON.parse(row.results_json);
    return Array.isArray(results)
      ? { results, expiresAt: Number(row.expires_at) }
      : null;
  } catch {
    return null;
  }
}

export async function writePersistentFlightSearchCache(
  cacheKey: string,
  results: unknown[],
  expiresAt: number,
  now = Date.now(),
) {
  const database = getFlightSearchDatabase();
  if (!database) return false;

  try {
    await ensureSchema(database);
    await database.batch([
      database
        .prepare(
          `INSERT INTO flight_search_cache (cache_key, results_json, expires_at, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(cache_key) DO UPDATE SET
             results_json = excluded.results_json,
             expires_at = excluded.expires_at,
             created_at = excluded.created_at`,
        )
        .bind(cacheKey, JSON.stringify(results), expiresAt, now),
      database
        .prepare("DELETE FROM flight_search_cache WHERE expires_at <= ?")
        .bind(now),
    ]);
    return true;
  } catch {
    return false;
  }
}
