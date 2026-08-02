import baseWorker from "./index";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import { enforcePostCaptureValueLoopCompatibility } from "./postCaptureValueLoopCompatibilityPatch";
import { enhancePostCaptureValueLoop } from "./postCaptureValueLoopPatch";
import { polishPublicHomeUx } from "./publicHomeUxPolish";
import { patchPublicHomePresentation } from "./publicPresentationPatch";
import { hardenSvgResponse } from "./svgResponseSecurity";

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
    const valueLoop = await enhancePostCaptureValueLoop(request, polished);
    const compatible = await enforcePostCaptureValueLoopCompatibility(request, valueLoop);
    return hardenSvgResponse(compatible);
  },
};
