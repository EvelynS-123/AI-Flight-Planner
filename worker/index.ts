import handler from "vinext/server/app-router-entry";
import {
  setFlightSearchDatabase,
  type FlightSearchDatabase,
} from "../db/flight-search-cache.ts";

type VinextEnv = NonNullable<Parameters<typeof handler.fetch>[1]>;
type VinextExecutionContext = NonNullable<Parameters<typeof handler.fetch>[2]>;

interface Env extends VinextEnv {
  DB?: FlightSearchDatabase;
}

export default {
  fetch(request: Request, env: Env, ctx: VinextExecutionContext) {
    setFlightSearchDatabase(env.DB);
    return handler.fetch(request, env, ctx);
  },
};
