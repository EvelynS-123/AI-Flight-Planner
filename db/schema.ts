export const CREATE_FLIGHT_SEARCH_CACHE_TABLE = `
CREATE TABLE IF NOT EXISTS flight_search_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  results_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)`;

export const CREATE_FLIGHT_SEARCH_CACHE_EXPIRY_INDEX = `
CREATE INDEX IF NOT EXISTS flight_search_cache_expires_at_idx
ON flight_search_cache (expires_at)`;
