CREATE TABLE IF NOT EXISTS `flight_search_cache` (
  `cache_key` text PRIMARY KEY NOT NULL,
  `results_json` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `flight_search_cache_expires_at_idx`
ON `flight_search_cache` (`expires_at`);
