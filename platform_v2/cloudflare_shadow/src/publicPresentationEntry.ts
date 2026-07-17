import baseWorker from "./index";
import { patchPublicHomePresentation } from "./publicPresentationPatch";

type DelegatedWorker = Record<string, unknown> & {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
};

const delegatedWorker = baseWorker as DelegatedWorker;

export default {
  ...delegatedWorker,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const response = await delegatedWorker.fetch.call(delegatedWorker, request, env, ctx);
    return patchPublicHomePresentation(request, response);
  },
};
