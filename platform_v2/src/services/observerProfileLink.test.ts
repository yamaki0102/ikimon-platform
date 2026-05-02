import assert from "node:assert/strict";
import test from "node:test";
import { buildObserverProfileHref } from "./observerProfileLink.js";

test("buildObserverProfileHref keeps registered users on profile pages", () => {
  assert.equal(buildObserverProfileHref("", "user_123"), "/profile/user_123");
});

test("buildObserverProfileHref sends guests to the guest notebook route", () => {
  assert.equal(buildObserverProfileHref("", "guest_abc123"), "/guest/guest_abc123");
});

test("buildObserverProfileHref respects base path", () => {
  assert.equal(buildObserverProfileHref("/app", "guest_abc123"), "/app/guest/guest_abc123");
});
