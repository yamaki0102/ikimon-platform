import baseWorker from "./index";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import { patchPublicHomePresentation } from "./publicPresentationPatch";

type DelegatedWorker = Record<string, unknown> & {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
};

const delegatedWorker = baseWorker as DelegatedWorker;

export default {
  ...delegatedWorker,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const response = await delegatedWorker.fetch.call(delegatedWorker, request, env, ctx);
    const presented = await patchPublicHomePresentation(request, response);
    return enforceCameraFirstHomeCta(request, presented);
  },
};
