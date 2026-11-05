# NOCOSIL / ZUKAN Mobile Product Family — Implementation Slice v1

Status: `IMPLEMENTATION_STARTED / STACK_UNSELECTED`

Base source: `main@4e6e290476b3e9e2e3187a5e1911b366602250ce`

Branch: `codex/nocosil-zukan-mobile-platform-v1`

This document is an implementation projection for `yamaki0102/ikimon-platform`. Product-family truth remains in the canonical strategy/management records. It must not weaken the NOCOSIL/ZUKAN private-public boundary.

## 1. Goal

Advance the app-primary direction without rewriting verified ZUKAN backend/data and without prematurely selecting Expo, Kotlin Multiplatform, Flutter, or another client stack.

The first implementation slice establishes canonical-contract-aligned mobile primitives and proves the minimum cross-product invariants before any new product shell is allowed to become canonical.

## 2. Existing native assets discovered on current main

The repository already contains meaningful native capability work. It is not disposable prototype code by default.

### Android — `mobile/android/ikimon-pocket`

Current source includes Kotlin/Compose plus:

- CameraX;
- foreground/background field collection;
- GPS/location;
- WorkManager retry machinery;
- ONNX Runtime / BirdNET-class audio inference;
- TensorFlow Lite;
- on-device GenAI integration surface;
- install identity and mobile auth managers;
- current-runtime `/api/v1/mobile/field-sessions` client code;
- upload status and recovery code.

This means a future shared shell must preserve the option to call existing Kotlin capabilities instead of reimplementing them in JavaScript.

### iOS — `mobile/ios/IkimonScan`

Current source includes Swift/SwiftUI plus:

- AVFoundation camera/media;
- Vision;
- Core ML;
- ARKit;
- CoreLocation;
- CoreMotion.

Its historical API client still targets legacy `/api/v2/*.php` endpoints. The native capture/detection capability is useful, but that transport adapter is not the target product-family contract.

## 3. Refined architecture hypothesis: Pattern A-prime

The current preferred hypothesis is no longer “replace native apps with pure Expo.” It is:

```text
                    shared mobile product layer
                 TypeScript / React Native candidate
                              |
              +---------------+---------------+
              |                               |
         ZUKAN shell                     NOCOSIL shell
      separate app identity            separate app identity
              |                               |
      native capability ports          native capability ports
        /              \                 /              \
 Android Kotlin      iOS Swift       Android Kotlin      iOS Swift
 CameraX/ML/audio    Vision/CoreML   security/sensors    security/sensors
              |                               |
              +---------------+---------------+
                              |
                 Versioned Product Contract
                              |
                     Cloudflare OS ports
                              |
                 product-specific backends
```

Expo/React Native remains the first shell candidate because it can maximize TypeScript UI/contract reuse while retaining native escape hatches. Existing native code should be refactored into capability modules/ports where practical rather than rewritten.

Kotlin Multiplatform remains the strategic fallback if the paired slice shows that the React Native/native-module boundary is too costly or cannot satisfy security/background/performance requirements.

## 4. Non-negotiable product separation

“Shared mobile platform” means shared implementation, never shared trust state.

NOCOSIL and ZUKAN must keep separate:

- bundle/application identifiers;
- auth clients and sessions;
- local databases;
- encryption keys;
- push namespaces;
- server-side physical/security domains;
- authorization policy;
- release/signing channels.

A shared module may operate only on caller-provided, already-authorized product data. Shared code must not hold a cross-product credential cache or a cross-product local database.

## 5. Canonical contract convergence

The source in this branch is an implementation of the already-adopted strategy contract, not a second mobile specification.

Canonical contract family:

```text
ikimon.mobile-platform.v1
```

Canonical discovery:

```text
GET /.well-known/ikimon-platform
  -> PlatformDescriptor
  -> capability_endpoint: /v1/capabilities

GET /v1/capabilities
  -> CapabilityResponse
```

The first draft in this branch briefly used a separate `/api/v1/mobile/capabilities` preview shape. That divergence was detected before merge and removed. The branch now uses the canonical field names, endpoint and capability states from `NOCOSIL_ZUKAN_MOBILE_PLATFORM_CONTRACTS_v1.md`.

`platform_v2/src/mobilePlatform/productFamilyContract.ts` now implements selected canonical v1 types/invariants for:

- `SyncCommand` command/idempotency/payload-digest semantics;
- canonical command receipt statuses;
- upload-intent and finalize interfaces;
- the v1 NOCOSIL -> ZUKAN `KnowledgeExchangePackageV1`;
- revocable authority, rights/transform/signature requirements;
- prohibited cross-product private fields;
- canonical `PlatformDescriptor` and `CapabilityResponse` shapes;
- provider-resource-opaque capability identifiers.

It intentionally does not expose R2 buckets, D1 databases, Queue bindings, Durable Object identities, Hyperdrive configuration, Expo, Swift/Kotlin implementation paths, or provider credentials.

## 6. Read-only discovery surface

The branch adds two read-only routes through the existing mobile route registration:

- `GET /.well-known/ikimon-platform`
- `GET /v1/capabilities`

The descriptor identifies the platform as `ikimon-cloudflare-os` as required by the canonical contract while keeping resource/binding detail out of mobile capability IDs.

Canonical capability states are:

- `available`;
- `degraded`;
- `read_only`;
- `disabled`.

The first response marks the already-existing field-session flows `available`. Canonical sync, media-upload, notification, deep-link, private-observation and NOCOSIL-exchange capabilities are explicitly `disabled` until their real server-side implementation is verified.

This prevents a design document or reserved contract from being mistaken for live runtime capability.

The capability response is `no-store` from the beginning because later responses may become session/domain-specific. The well-known descriptor has only a short public cache lifetime.

## 7. Cloudflare OS boundary

Mobile clients depend on product/platform capability contracts, not Cloudflare resource names.

Target interaction:

```text
mobile app
  -> request capability / command
  -> versioned product API
  -> Cloudflare OS adapter
  -> storage / queue / workflow / notification implementation
```

For large media, the canonical future upload flow is:

```text
POST /v1/media/upload-intents
→ bounded single/multipart/server-mediated capability
→ upload bytes
→ POST /v1/media/upload-intents/{intent}/finalize
→ server ownership/size/type/digest verification
→ verified receipt
```

A successful storage PUT is not canonical acceptance. Permanent storage credentials and provider control-plane IDs never enter the mobile contract.

## 8. Existing app migration rule

### Android

Do not delete `ikimon-pocket` while the replacement shell is unverified.

Refactor reusable pieces behind native ports in this order:

1. audio inference;
2. camera/scan;
3. sensor/location collection;
4. background scheduling;
5. on-device model runtime;
6. existing auth/install identity only after the canonical auth/device contracts replace it.

The disabled legacy `UploadWorker` must not be treated as a working durable outbox. A new outbox needs exact encoded commands, persistent command state, idempotency keys, payload digests and server receipts.

A new `MobilePlatformDiscoveryClient.kt` has been added without wiring it into normal product behavior. It reads only the canonical well-known/capability contract and validates provider-resource opacity.

### iOS

Do not delete `IkimonScan` while the replacement shell is unverified.

Preserve Vision/CoreML/ARKit/camera capabilities, but replace the direct legacy PHP transport with the versioned product contract before it becomes part of the new primary app.

A new `MobilePlatformDiscoveryClient.swift` has been added without changing the legacy capture path. It reads the same canonical discovery/capability contract as Android and does not know Cloudflare resource bindings.

## 9. Paired vertical slice

The stack is selected only after one thin slice passes on both product shapes.

### ZUKAN slice

1. launch -> capture ready;
2. photo capture;
3. client-side media preparation;
4. location consent and precision downgrade;
5. durable local save while offline;
6. force-kill / process-death recovery;
7. idempotent retry without duplicate observation;
8. resumable media upload + server finalize receipt;
9. map with representative layers and an offline region;
10. push/deep link to exact observation/review screen;
11. release build smoke on Android and iOS.

### NOCOSIL sibling slice

1. photo/PDF/text/voice -> immediate durable preservation;
2. encrypted local persistence;
3. device-bound secret/key handling;
4. Personal vs Organization on-device isolation;
5. authorization-before-retrieval over local/cached projections;
6. force-kill recovery of correction/undo/outbox state;
7. Evidence + temporal revision integrity;
8. passkey/biometric/session recovery behavior;
9. canonical signed NOCOSIL -> ZUKAN exchange package with approval/rights/privacy transform;
10. negative proof that ZUKAN cannot read NOCOSIL local/private state.

## 10. Stack decision gate

Promote Expo/React Native only if:

- the shared shell can call the existing or extracted Kotlin/Swift capabilities cleanly;
- process-death recovery is correct without relying on opportunistic background execution;
- NOCOSIL local encryption/key isolation is strong enough;
- ZUKAN map/camera/audio performance meets measured targets;
- native-module maintenance cost remains materially lower than two separate full native apps.

Trigger Kotlin Multiplatform comparison only for a measured blocker such as:

- security/key-management property not achievable with the candidate shell;
- background transfer/task reliability that requires pervasive native ownership;
- sensor/health/Bluetooth/AR becoming central product behavior;
- unacceptable camera/map/audio performance;
- excessive React Native <-> native bridge/module surface;
- duplicated product logic becoming larger than the TypeScript reuse benefit.

Do not run a full Flutter or KMP rewrite merely for preference comparison.

## 11. Immediate next implementation sequence

Completed in this branch so far:

1. canonical v1 contract invariants in TypeScript;
2. canonical read-only descriptor/capability endpoints;
3. language-neutral positive/negative NOCOSIL -> ZUKAN exchange fixtures;
4. Android canonical discovery client;
5. iOS canonical discovery client;
6. source-level negative tests for provider-resource leakage and private-field exchange leakage.

Next implementation order after verification of this slice:

1. durable ZUKAN outbox state machine using canonical `SyncCommand`;
2. staging-only upload-intent/finalize adapter;
3. first Android native capability behind a stable product-neutral port;
4. first iOS native capability behind the same semantic port;
5. smallest shared-shell spike;
6. paired ZUKAN/NOCOSIL negative tests;
7. evidence-based Expo selection or KMP comparison trigger.

## 12. Done definition for this slice

This slice is not `STAGING_VERIFIED` merely because source exists.

Minimum closure requires:

- platform typecheck pass;
- relevant Node tests pass;
- Android contract tests pass where the Android toolchain is available;
- provider-resource leak negative tests pass;
- NOCOSIL->ZUKAN private-field negative tests pass;
- discovery endpoint tests pass;
- no production mutation;
- no claim that `disabled` capabilities are live.

The next phase may request a staging release of the exact merged source only through the normal Release Commander / Cloudflare command path.
