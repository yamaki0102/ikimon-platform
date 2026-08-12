import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MobileContractError,
  assertValidNocosilToZukanExchange,
  type NocosilToZukanExchange,
} from "./productFamilyContract.js";

async function readExchangeFixture(name: string): Promise<NocosilToZukanExchange> {
  const raw = await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
  return JSON.parse(raw) as NocosilToZukanExchange;
}

test("language-neutral safe exchange fixture is accepted", async () => {
  const exchange = await readExchangeFixture("nocosil-to-zukan.safe.json");
  assert.doesNotThrow(() => assertValidNocosilToZukanExchange(exchange));
});

test("language-neutral fixture proves private credential leakage is rejected", async () => {
  const exchange = await readExchangeFixture("nocosil-to-zukan.forbidden-refresh-token.json");
  assert.throws(
    () => assertValidNocosilToZukanExchange(exchange),
    (error: unknown) => error instanceof MobileContractError
      && error.code === "EXCHANGE_FORBIDDEN_FIELD"
      && error.path === "payload.observation.nested.refresh_token",
  );
});
