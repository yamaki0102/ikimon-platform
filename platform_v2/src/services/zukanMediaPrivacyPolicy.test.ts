import assert from "node:assert/strict";
import test from "node:test";
import {
  ZUKAN_MEDIA_PRIVACY_POLICY_VERSION,
  decideZukanMediaPrivacyPolicy,
  type ZukanMediaPrivacyPolicyInput,
} from "./zukanMediaPrivacyPolicy.js";

const verifiedDerivative: ZukanMediaPrivacyPolicyInput = {
  publicMediaUrl: "/derived/observation-1/display.webp",
  publicDerivativeVerifiedAt: "2026-08-13T00:00:00.000Z",
  publicDerivativeMetadata: {
    scannedContainer: "webp",
    gpsExifPresent: false,
    exifPresent: false,
    gpsPresent: false,
    xmpPresent: false,
    exactCoordinateLiteralPresent: false,
  },
  exifScrubState: "scrubbed",
  publicReadyAt: "2026-08-13T00:00:01.000Z",
};

test("verified derivative is the only state that returns a public media URL", () => {
  const result = decideZukanMediaPrivacyPolicy(verifiedDerivative);

  assert.equal(result.canExposePublicMedia, true);
  assert.equal(result.publicMediaUrl, verifiedDerivative.publicMediaUrl);
  assert.equal(result.reason, "metadata_privacy_verified");
  assert.equal(result.policyVersion, ZUKAN_MEDIA_PRIVACY_POLICY_VERSION);
});

test("unverified derivative never exposes an existing public URL", () => {
  const result = decideZukanMediaPrivacyPolicy({
    ...verifiedDerivative,
    publicDerivativeVerifiedAt: null,
  });

  assert.equal(result.canExposePublicMedia, false);
  assert.equal(result.publicMediaUrl, null);
  assert.equal(result.reason, "metadata_privacy_unverified");
});

test("pending EXIF scrub never exposes an existing public URL", () => {
  const result = decideZukanMediaPrivacyPolicy({
    ...verifiedDerivative,
    exifScrubState: "pending",
  });

  assert.equal(result.canExposePublicMedia, false);
  assert.equal(result.publicMediaUrl, null);
  assert.equal(result.reason, "metadata_privacy_not_scrubbed");
});

test("missing privacy inspection never exposes an existing public URL", () => {
  const result = decideZukanMediaPrivacyPolicy({
    ...verifiedDerivative,
    publicDerivativeMetadata: null,
  });

  assert.equal(result.canExposePublicMedia, false);
  assert.equal(result.publicMediaUrl, null);
  assert.equal(result.reason, "metadata_privacy_inspection_missing");
});

test("EXIF, GPS, XMP, or exact-coordinate signals block public media", () => {
  const flags = [
    "gpsExifPresent",
    "exifPresent",
    "gpsPresent",
    "xmpPresent",
    "exactCoordinateLiteralPresent",
  ] as const;

  for (const flag of flags) {
    const result = decideZukanMediaPrivacyPolicy({
      ...verifiedDerivative,
      publicDerivativeMetadata: {
        ...verifiedDerivative.publicDerivativeMetadata,
        [flag]: true,
      },
    });

    assert.equal(result.canExposePublicMedia, false, flag);
    assert.equal(result.publicMediaUrl, null, flag);
    assert.equal(result.reason, "metadata_privacy_failed", flag);
  }
});

test("unknown privacy signals and unsupported containers fail closed", () => {
  const unknownSignal = decideZukanMediaPrivacyPolicy({
    ...verifiedDerivative,
    publicDerivativeMetadata: {
      ...verifiedDerivative.publicDerivativeMetadata,
      gpsExifPresent: null,
    },
  });
  const unsupportedContainer = decideZukanMediaPrivacyPolicy({
    ...verifiedDerivative,
    publicDerivativeMetadata: {
      ...verifiedDerivative.publicDerivativeMetadata,
      scannedContainer: "svg+xml",
    },
  });

  for (const result of [unknownSignal, unsupportedContainer]) {
    assert.equal(result.canExposePublicMedia, false);
    assert.equal(result.publicMediaUrl, null);
    assert.equal(result.reason, "metadata_privacy_failed");
  }
});

test("a derivative is not public until its ready marker exists", () => {
  const result = decideZukanMediaPrivacyPolicy({
    ...verifiedDerivative,
    publicReadyAt: null,
  });

  assert.equal(result.canExposePublicMedia, false);
  assert.equal(result.publicMediaUrl, null);
  assert.equal(result.reason, "public_media_not_ready");
});

test("policy decisions are deterministic for the same input", () => {
  const first = decideZukanMediaPrivacyPolicy(verifiedDerivative);
  const second = decideZukanMediaPrivacyPolicy({ ...verifiedDerivative });

  assert.deepEqual(second, first);
});
