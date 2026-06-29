import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

const nonceStore = new AsyncLocalStorage<string>();

export function createCspNonce(): string {
  return randomBytes(16).toString("base64");
}

export function runWithCspNonce<T>(nonce: string, fn: () => T): T {
  return nonceStore.run(nonce, fn);
}

export function getCspNonce(): string | null {
  return nonceStore.getStore() ?? null;
}
