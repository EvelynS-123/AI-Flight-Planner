import handler from "vinext/server/app-router-entry";
import {
  setFlightSearchDatabase,
  type FlightSearchDatabase,
} from "../db/flight-search-cache.ts";

interface Env {
  ASSETS: Fetcher;
  DB?: FlightSearchDatabase;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    setFlightSearchDatabase(env.DB);
    return handler.fetch(request, env, ctx);
  },
};
