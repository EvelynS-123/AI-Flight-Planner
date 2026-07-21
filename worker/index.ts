import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
};
