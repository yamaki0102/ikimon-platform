import baseWorker from "./index";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import {
  authorizeOAuthStart,
  oauthErrorResponse,
  oauthStartKind,
  type OAuthBoundaryEnv,
} from "./oauthStartBoundary";
import { legacyDomainRedirect, type LegacyDomainRedirectEnv } from "./legacyDomainRedirect";
import { enforcePostCaptureValueLoopCompatibility } from "./postCaptureValueLoopCompatibilityPatch";
import { enhancePostCaptureValueLoop } from "./postCaptureValueLoopPatch";
import { polishPublicHomeUx } from "./publicHomeUxPolish";
import { patchPublicHomePresentation } from "./publicPresentationPatch";
import { hardenSvgResponse } from "./svgResponseSecurity";
import { ensureStateSplitHomeResponsive } from "./stateSplitHomeResponsive";

type DelegatedWorker = Record<string, unknown> & {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
};

type PublicPresentationEnv = OAuthBoundaryEnv & LegacyDomainRedirectEnv;

const delegatedWorker = baseWorker as DelegatedWorker;

export default {
  ...delegatedWorker,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const presentationEnv = env as PublicPresentationEnv;
    const redirect = legacyDomainRedirect(request, presentationEnv);
    if (redirect) return redirect;

    const oauthKind = oauthStartKind(request);
    if (!authorizeOAuthStart(request, presentationEnv, oauthKind)) {
      return oauthErrorResponse(request, presentationEnv, oauthKind);
    }

    let response: Response;
    try {
      response = await delegatedWorker.fetch.call(delegatedWorker, request, env, ctx);
    } catch (error) {
      if (oauthKind !== null) {
        return oauthErrorResponse(request, presentationEnv, oauthKind);
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
