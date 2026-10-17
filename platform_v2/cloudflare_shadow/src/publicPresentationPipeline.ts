import { enforceCameraFirstHomeCtaHtml, isFocusedHomeRequest as isCameraHome } from "./cameraFirstHomeCta";
import { applyFocusedPublicHomeRedesign, FOCUSED_PUBLIC_HOME_PRESENTATION } from "./publicFocusedHomeRedesign";
import { applyPostCaptureValueLoopCompatibilityPatch, POST_CAPTURE_VALUE_LOOP_COMPATIBILITY } from "./postCaptureValueLoopCompatibilityPatch";
import { applyPostCaptureValueLoopPatch, nonceFromContentSecurityPolicy, POST_CAPTURE_VALUE_LOOP_PRESENTATION } from "./postCaptureValueLoopPatch";
import { applyPublicDesignFoundation, isPublicUserFacingHtmlRequest } from "./publicDesignFoundation";
import { applyPublicHomeUxPolish, detectHomeLang, isFocusedHomeRequest as isPolishedHome, PUBLIC_HOME_UX_POLISH_PRESENTATION } from "./publicHomeUxPolish";
import { isNormalPublicHomeRequest, rewriteHomePublicRecordsAvailability, routeFocusedHomePrimaryCtaToPhotoCamera, stripPassiveIdentificationFromHomeHtml, supportsFocusedHomeRedesign } from "./publicPresentationPatch";
import { applyStateSplitHomeResponsive } from "./stateSplitHomeResponsive";

/** Same presentation order and headers, with one body decode/encode per request. */
export async function applyPublicPresentationPipeline(request: Request, response: Response): Promise<Response> {
  const successful = response.status >= 200 && response.status < 300;
  const designEligible = isPublicUserFacingHtmlRequest(request) && response.status >= 200 && response.status < 500;
  if ((!successful && !designEligible) || !String(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);
  const invalidate = () => {
    headers.delete("content-length");
    headers.delete("etag");
    headers.delete("last-modified");
  };
  const homeCacheControl = () => headers.set("cache-control", "no-cache, no-store, must-revalidate");

  if (successful && isNormalPublicHomeRequest(request)) {
    const stateSplit = html.includes('data-home-contract="state-split-v1"');
    const focused = !stateSplit && supportsFocusedHomeRedesign(request);
    html = stateSplit ? rewriteHomePublicRecordsAvailability(html) : stripPassiveIdentificationFromHomeHtml(html);
    if (focused) html = routeFocusedHomePrimaryCtaToPhotoCamera(applyFocusedPublicHomeRedesign(html));
    invalidate(); homeCacheControl();
    headers.set("x-ikimon-presentation-contract", stateSplit ? "state-split-home-v1" : "light-home-v2");
    if (focused) {
      headers.set("x-ikimon-home-redesign", FOCUSED_PUBLIC_HOME_PRESENTATION);
      headers.set("x-ikimon-home-capture-contract", "camera-first-v1");
    }
  }

  if (successful && isCameraHome(request)) {
    const stateSplit = html.includes('data-home-contract="state-split-v1"');
    html = enforceCameraFirstHomeCtaHtml(html);
    invalidate(); homeCacheControl();
    headers.set("x-ikimon-home-capture-entry", stateSplit ? "format-neutral-v1" : "camera-first-v2");
  }

  if (successful && isPolishedHome(request)) {
    const lang = detectHomeLang(request, html);
    headers.delete("content-length");
    if (lang) {
      const stateSplit = html.includes('data-home-contract="state-split-v1"');
      html = applyPublicHomeUxPolish(html, lang);
      invalidate(); homeCacheControl();
      headers.set("x-ikimon-home-ux-polish", stateSplit ? "state-split-pass-through-v1" : PUBLIC_HOME_UX_POLISH_PRESENTATION);
    }
  }

  if (successful) {
    const patched = applyStateSplitHomeResponsive(html);
    headers.delete("content-length");
    if (patched !== html) {
      invalidate(); homeCacheControl();
      headers.set("x-zukan-home-responsive", "state-split-release-closure-v1");
      html = patched;
    }
  }

  if (successful && request.method.toUpperCase() === "GET") {
    const valueLoop = applyPostCaptureValueLoopPatch(html, nonceFromContentSecurityPolicy(headers.get("content-security-policy")));
    headers.delete("content-length");
    if (valueLoop !== html) {
      invalidate(); headers.set("x-ikimon-post-capture-value-loop", POST_CAPTURE_VALUE_LOOP_PRESENTATION);
      html = valueLoop;
    }
    const compatible = applyPostCaptureValueLoopCompatibilityPatch(html);
    if (compatible !== html) {
      invalidate(); headers.set("x-ikimon-post-capture-value-loop-compat", POST_CAPTURE_VALUE_LOOP_COMPATIBILITY);
      html = compatible;
    }
  }

  if (designEligible) {
    const patched = applyPublicDesignFoundation(html);
    if (patched !== html) {
      invalidate(); headers.set("x-zukan-design-foundation", "v1");
      html = patched;
    }
  }
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
