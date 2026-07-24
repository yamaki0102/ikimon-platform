import baseWorker from "./index";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import { enhancePostCaptureValueLoop } from "./postCaptureValueLoopPatch";
import { polishPublicHomeUx } from "./publicHomeUxPolish";
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
    const cameraFirst = await enforceCameraFirstHomeCta(request, presented);
    const polished = await polishPublicHomeUx(request, cameraFirst);
    return enhancePostCaptureValueLoop(request, polished);
  },
};
