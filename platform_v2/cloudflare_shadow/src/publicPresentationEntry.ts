import baseWorker from "./index";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import {
  authorizeBrowserOAuthStart,
  isBrowserOAuthStart,
  oauthErrorRedirect,
  type OAuthBoundaryEnv,
} from "./oauthStartBoundary";
import { enforcePostCaptureValueLoopCompatibility } from "./postCaptureValueLoopCompatibilityPatch";
import { enhancePostCaptureValueLoop } from "./postCaptureValueLoopPatch";
import { polishPublicHomeUx } from "./publicHomeUxPolish";
import { patchPublicHomePresentation } from "./publicPresentationPatch";
import { hardenSvgResponse } from "./svgResponseSecurity";
import { ensureStateSplitHomeResponsive } from "./stateSplitHomeResponsive";

type DelegatedWorker = Record<string, unknown> & {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
};

const delegatedWorker = baseWorker as DelegatedWorker;

export default {
  ...delegatedWorker,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    if (!authorizeBrowserOAuthStart(request, env as OAuthBoundaryEnv)) {
      return oauthErrorRedirect(request);
    }

    let response: Response;
    try {
      response = await delegatedWorker.fetch.call(delegatedWorker, request, env, ctx);
    } catch (error) {
      if (isBrowserOAuthStart(request)) {
        return oauthErrorRedirect(request);
      }
      throw error;
    }

    const presented = await patchPublicHomePresentation(request, response);
    const cameraFirst = await enforceCameraFirstHomeCta(request, presented);
    const polished = await polishPublicHomeUx(request, cameraFirst);
    const responsive = await ensureStateSplitHomeResponsive(polished);
    const valueLoop = await enhancePostCaptureValueLoop(request, responsive);
    const compatible = await enforcePostCaptureValueLoopCompatibility(request, valueLoop);
    return hardenSvgResponse(compatible);
  },
};
