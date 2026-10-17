import baseWorker from "./index";
import {
  authorizeOAuthStart,
  oauthErrorResponse,
  oauthStartKind,
  type OAuthBoundaryEnv,
} from "./oauthStartBoundary";
import { personPublicationResponse } from "./personPublication";
import { ensurePublicDesignFoundation } from "./publicDesignFoundation";
import { applyPublicPresentationPipeline } from "./publicPresentationPipeline";
import { hardenSvgResponse } from "./svgResponseSecurity";

type DelegatedWorker = Record<string, unknown> & {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
};

const delegatedWorker = baseWorker as DelegatedWorker;

export default {
  ...delegatedWorker,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const oauthEnv = env as OAuthBoundaryEnv;
    const oauthKind = oauthStartKind(request);
    if (!authorizeOAuthStart(request, oauthEnv, oauthKind)) {
      return oauthErrorResponse(request, oauthEnv, oauthKind);
    }

    const publication = personPublicationResponse(request, env as { ENVIRONMENT?: string; IKIMON_GIT_SHA?: string });
    if (publication !== null) return ensurePublicDesignFoundation(request, publication);

    let response: Response;
    try {
      response = await delegatedWorker.fetch.call(delegatedWorker, request, env, ctx);
    } catch (error) {
      if (oauthKind !== null) {
        return oauthErrorResponse(request, oauthEnv, oauthKind);
      }
      throw error;
    }

    return hardenSvgResponse(await applyPublicPresentationPipeline(request, response));
  },
};
