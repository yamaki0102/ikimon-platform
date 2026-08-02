export const SVG_RESPONSE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export function hardenSvgResponse(response: Response): Response {
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("image/svg+xml")) return response;

  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", SVG_RESPONSE_CSP);
  headers.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
