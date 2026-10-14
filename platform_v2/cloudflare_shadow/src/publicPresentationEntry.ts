import baseWorker from "./index";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import {
  authorizeOAuthStart,
  oauthErrorResponse,
  oauthStartKind,
  type OAuthBoundaryEnv,
} from "./oauthStartBoundary";
import { personPublicationResponse } from "./personPublication";
import { readPersonEdition, type PersonD1, type PersonEditionBlobStore } from "./personPublicationExchange";
import { enforcePostCaptureValueLoopCompatibility } from "./postCaptureValueLoopCompatibilityPatch";
import { enhancePostCaptureValueLoop } from "./postCaptureValueLoopPatch";
import { ensurePublicDesignFoundation } from "./publicDesignFoundation";
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
    const oauthEnv = env as OAuthBoundaryEnv;
    const oauthKind = oauthStartKind(request);
    if (!authorizeOAuthStart(request, oauthEnv, oauthKind)) {
      return oauthErrorResponse(request, oauthEnv, oauthKind);
    }

    const publicPath = new URL(request.url).pathname;
    if (/^\/ja\/(?:people|organizations)\//u.test(publicPath)) {
      const foundId = /-([a-f0-9]{32})(?:\/portrait\.webp|\/)?$/u.exec(publicPath)?.[1];
      const database = (env as { CORE_DB?: PersonD1 }).CORE_DB;
      const assetStore = (env as { ASSET_BUCKET?: PersonEditionBlobStore }).ASSET_BUCKET;
      if (foundId && database && !assetStore) {
        return new Response("Unavailable", { status: 503, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
      }
      if (foundId && database && assetStore) {
        try {
          const stored = await readPersonEdition(database, assetStore, foundId);
          if (stored.found) {
            // A withdrawal overrides any source-managed earlier edition, including its portrait.
            const resolved = personPublicationResponse(request, env as { ENVIRONMENT?: string; IKIMON_GIT_SHA?: string },
              stored.profile === null ? [] : [stored.profile]);
            if (resolved !== null) return ensurePublicDesignFoundation(request, resolved);
          }
        } catch (error) {
          // Maintain the existing approved static page before the additive migration.
          // Any other read error must NOT resurrect a possibly withdrawn public profile.
          if (!/no such table: zukan_person_publications/u.test(String(error))) {
            return new Response("Unavailable", { status: 503, headers: {
              "cache-control": "no-store", "x-robots-tag": "noindex, nofollow",
            } });
          }
        }
      }
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

    const presented = await patchPublicHomePresentation(request, response);
    const cameraFirst = await enforceCameraFirstHomeCta(request, presented);
    const polished = await polishPublicHomeUx(request, cameraFirst);
    const responsive = await ensureStateSplitHomeResponsive(polished);
    const valueLoop = await enhancePostCaptureValueLoop(request, responsive);
    const compatible = await enforcePostCaptureValueLoopCompatibility(request, valueLoop);
    return hardenSvgResponse(await ensurePublicDesignFoundation(request, compatible));
  },
};
