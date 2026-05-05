import { createHash, createHmac, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { loadConfig } from "../config.js";
import type { OAuthProfile } from "./authUsers.js";
import { safeRedirectPath } from "./authSecurity.js";

export type OAuthProvider = "google" | "twitter";

const OAUTH_STATE_COOKIE = "ikimon_oauth_state";

type OAuthStatePayload = {
  provider: OAuthProvider;
  state: string;
  redirect: string;
  appReturnUri?: string;
  appInstallId?: string;
  appPlatform?: string;
  appVersion?: string;
  codeVerifier?: string;
  expiresAt: number;
};

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function oauthSecret(): string {
  const config = loadConfig();
  return config.oauthStateSecret
    ?? config.oauth.google?.clientSecret
    ?? config.oauth.twitter?.clientSecret
    ?? "ikimon-dev-oauth-state";
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", oauthSecret()).update(encodedPayload).digest("base64url");
}

function encodeOAuthState(payload: OAuthStatePayload): string {
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

function decodeOAuthState(value: string | undefined): OAuthStatePayload | null {
  if (!value) {
    return null;
  }
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || signPayload(encoded) !== signature) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed || parsed.expiresAt < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function cookieSecurePart(): string {
  return loadConfig().nodeEnv === "production" ? " Secure;" : "";
}

export function buildOAuthStateCookie(payload: OAuthStatePayload): string {
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(encodeOAuthState(payload))}; Path=/; HttpOnly; SameSite=Lax;${cookieSecurePart()} Max-Age=600`;
}

export function buildClearedOAuthStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${cookieSecurePart()} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  const matches = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`)) ?? [];
  return matches.at(-1)?.slice(name.length + 1);
}

export function readOAuthState(cookieHeader: string | undefined): OAuthStatePayload | null {
  const raw = readCookie(cookieHeader, OAUTH_STATE_COOKIE);
  return decodeOAuthState(raw ? decodeURIComponent(raw) : undefined);
}

function headerFirst(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() ?? "";
}

export function requestPublicOrigin(request: FastifyRequest): string {
  const host = headerFirst(request.headers["x-forwarded-host"]) || headerFirst(request.headers.host);
  const proto = headerFirst(request.headers["x-forwarded-proto"]) || (loadConfig().nodeEnv === "production" ? "https" : request.protocol || "http");
  if (!host) {
    return "http://localhost:3200";
  }
  return `${proto}://${host}`;
}

export function oauthRedirectUri(request: FastifyRequest, provider: OAuthProvider): string {
  if (provider === "google") {
    return `${requestPublicOrigin(request)}/oauth_callback.php?provider=google`;
  }

  return `${requestPublicOrigin(request)}/auth/oauth/${provider}/callback`;
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function oauthProviderEnabled(provider: OAuthProvider): boolean {
  return Boolean(loadConfig().oauth[provider]);
}

function appReturnUri(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    throw new Error("app_return_uri_required");
  }
  const parsed = new URL(raw);
  if (parsed.protocol !== "ikimonfieldscan:" || parsed.host !== "auth" || parsed.pathname !== "/callback") {
    throw new Error("app_return_uri_invalid");
  }
  return "ikimonfieldscan://auth/callback";
}

function optionalQueryString(input: unknown, maxLength: number): string | undefined {
  const raw = typeof input === "string" ? input.trim() : "";
  return raw ? raw.slice(0, maxLength) : undefined;
}

export function buildOAuthStart(provider: OAuthProvider, request: FastifyRequest, redirectInput: unknown): {
  cookie: string;
  authorizationUrl: string;
} {
  const config = loadConfig().oauth[provider];
  if (!config) {
    throw new Error("oauth_provider_not_configured");
  }
  const state = randomBytes(20).toString("hex");
  const redirect = safeRedirectPath(redirectInput);
  const codeVerifier = provider === "twitter" ? generateCodeVerifier() : undefined;
  const payload: OAuthStatePayload = {
    provider,
    state,
    redirect,
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const redirectUri = oauthRedirectUri(request, provider);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  if (provider === "google") {
    params.set("scope", "openid email profile");
    params.set("prompt", "select_account");
    return {
      cookie: buildOAuthStateCookie(payload),
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  params.set("scope", "tweet.read users.read offline.access");
  params.set("code_challenge", codeChallenge(codeVerifier!));
  params.set("code_challenge_method", "S256");
  return {
    cookie: buildOAuthStateCookie(payload),
    authorizationUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  };
}

export function buildAppOAuthStart(
  provider: OAuthProvider,
  request: FastifyRequest,
  input: {
    returnUri?: unknown;
    installId?: unknown;
    platform?: unknown;
    appVersion?: unknown;
  },
): {
  cookie: string;
  authorizationUrl: string;
} {
  const config = loadConfig().oauth[provider];
  if (!config) {
    throw new Error("oauth_provider_not_configured");
  }
  const state = randomBytes(20).toString("hex");
  const returnUri = appReturnUri(input.returnUri);
  const codeVerifier = provider === "twitter" ? generateCodeVerifier() : undefined;
  const payload: OAuthStatePayload = {
    provider,
    state,
    redirect: "/",
    appReturnUri: returnUri,
    appInstallId: optionalQueryString(input.installId, 120),
    appPlatform: optionalQueryString(input.platform, 40),
    appVersion: optionalQueryString(input.appVersion, 40),
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const redirectUri = oauthRedirectUri(request, provider);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  if (provider === "google") {
    params.set("scope", "openid email profile");
    params.set("prompt", "select_account");
    return {
      cookie: buildOAuthStateCookie(payload),
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  params.set("scope", "tweet.read users.read offline.access");
  params.set("code_challenge", codeChallenge(codeVerifier!));
  params.set("code_challenge_method", "S256");
  return {
    cookie: buildOAuthStateCookie(payload),
    authorizationUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  };
}

async function postForm(url: string, body: URLSearchParams, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...headers,
    },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((json as { error_description?: unknown; error?: unknown }).error_description ?? (json as { error?: unknown }).error ?? "oauth_token_failed"));
  }
  return json as Record<string, unknown>;
}

async function getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((json as { error?: unknown }).error ?? "oauth_profile_failed"));
  }
  return json as Record<string, unknown>;
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthProfile> {
  const config = loadConfig().oauth[provider];
  if (!config) {
    throw new Error("oauth_provider_not_configured");
  }
  if (provider === "google") {
    const token = await postForm("https://oauth2.googleapis.com/token", new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }));
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) {
      throw new Error("oauth_token_failed");
    }
    const profile = await getJson("https://www.googleapis.com/oauth2/v2/userinfo", accessToken);
    return {
      provider,
      providerUserId: String(profile.id ?? ""),
      name: String(profile.name ?? ""),
      email: typeof profile.email === "string" ? profile.email : null,
      avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
      rawProfile: profile,
    };
  }

  const token = await postForm(
    "https://api.x.com/2/oauth2/token",
    new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier ?? "",
    }),
    {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
  );
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!accessToken) {
    throw new Error("oauth_token_failed");
  }
  const profile = await getJson("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", accessToken);
  const data = profile.data && typeof profile.data === "object" ? profile.data as Record<string, unknown> : {};
  return {
    provider,
    providerUserId: String(data.id ?? ""),
    name: String(data.name ?? data.username ?? ""),
    email: null,
    avatarUrl: typeof data.profile_image_url === "string" ? data.profile_image_url : null,
    rawProfile: profile,
  };
}
