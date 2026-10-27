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
import { handleZukanHpSiteReceiver, type ZukanHpReceiverEnv } from "./zukanHpSiteReceiver";

const isZukanHpSiteReceiverPath = (pathname: string): boolean =>
  pathname === "/api/v1/integrations/nocosil/sites" ||
  /^\/sites\/hp_[a-f0-9]{64}\/(?:assets\/site\.css)?$/.test(pathname);

type DelegatedWorker = Record<string, unknown> & {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
};

const delegatedWorker = baseWorker as DelegatedWorker;

export default {
  ...delegatedWorker,
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const receiverEnv = env as ZukanHpReceiverEnv;
    if (isZukanHpSiteReceiverPath(new URL(request.url).pathname)) {
      return handleZukanHpSiteReceiver(request, receiverEnv);
    }

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
