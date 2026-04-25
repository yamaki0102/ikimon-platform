import test from "node:test";
import assert from "node:assert/strict";
import { buildObserverProfileHref } from "./observerProfileLink.js";

test("registered observers link to profile pages", () => {
  assert.equal(buildObserverProfileHref("", "user_123"), "/profile/user_123");
});

test("guest observers link to guest notebook pages", () => {
  assert.equal(buildObserverProfileHref("", "guest_abc123"), "/guest/guest_abc123");
});

test("observer profile links preserve base path", () => {
  assert.equal(buildObserverProfileHref("/app", "guest_abc123"), "/app/guest/guest_abc123");
});
