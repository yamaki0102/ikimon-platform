# NOCOSIL / ZUKAN Mobile Product Family — Implementation Slice v1

Status: `IMPLEMENTATION_STARTED / STACK_UNSELECTED`

Base source: `main@4e6e290476b3e9e2e3187a5e1911b366602250ce`

Branch: `codex/nocosil-zukan-mobile-platform-v1`

This document is an implementation projection for `yamaki0102/ikimon-platform`. Product-family truth remains in the canonical strategy/management records. It must not weaken the NOCOSIL/ZUKAN private-public boundary.

## 1. Goal

Advance the app-primary direction without rewriting verified ZUKAN backend/data and without prematurely selecting Expo, Kotlin Multiplatform, Flutter, or another client stack.

The first implementation slice establishes a provider-opaque mobile contract and proves the minimum cross-product invariants before any new product shell is allowed to become canonical.

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

Its API client still targets legacy `/api/v2/*.php` endpoints. The native capture/detection capability is useful, but its transport adapter is not the target product-family contract.

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

## 5. Contract introduced by this slice

`platform_v2/src/mobilePlatform/productFamilyContract.ts` introduces `ikimon.mobile-platform/v1`.

It currently defines:

- product/security-domain scoped sync commands;
- command id + idempotency key + payload digest replay semantics;
- provider-neutral upload intent/capability ports;
- sync receipts;
- explicit NOCOSIL -> ZUKAN exchange envelope;
- revocable approval requirement;
- privacy/rights transform requirement;
- forbidden private trust-state fields;
- provider-opaque capability manifests.

This contract is intentionally not tied to R2, D1, Workers, Durable Objects, Hyperdrive, Expo, Kotlin, Swift, or a particular database.

## 6. Read-only discovery surface

The current runtime exposes two read-only discovery routes through the existing mobile route registration:

- `GET /.well-known/ikimon-platform`
- `GET /api/v1/mobile/capabilities`

Capabilities are explicitly stateful:

- `available` means the current runtime already exposes the capability;
- `preview` means an implementation exists but is not normal production contract;
- `contract_only` means the contract is reserved but the runtime must not claim it works yet.

The first manifest marks current field-session flows available while sync-push, upload-intent and NOCOSIL->ZUKAN knowledge exchange remain `contract_only`.

This prevents design documents from being mistaken for live runtime readiness.

## 7. Cloudflare OS boundary

Mobile clients must depend on product capability contracts, not Cloudflare resource names.

Target interaction:

```text
mobile app
  -> request capability / command
  -> versioned product API
  -> Cloudflare OS adapter
  -> storage / queue / workflow / notification implementation
```

For large media, a future upload-intent adapter may issue a short-lived object-scoped upload capability. The mobile contract sees only `targetUrl`, required headers, expiry, upload id and finalize token. It must not receive permanent storage credentials or provider control-plane identifiers.

Success of an HTTP upload is not canonical acceptance. A finalize operation must verify server-side ownership, digest/size and materialization before a verified receipt is issued.

## 8. Existing app migration rule

### Android

Do not delete `ikimon-pocket` while the replacement shell is unverified.

Refactor reusable pieces behind native ports in this order:

1. audio inference;
2. camera/scan;
3. sensor/location collection;
4. background scheduling;
5. on-device model runtime;
6. existing auth/install identity only after the new contract defines its replacement.

The disabled legacy `UploadWorker` must not be treated as a working durable outbox. A new outbox needs explicit persisted command state, idempotency keys and server receipts.

### iOS

Do not delete `IkimonScan` while the replacement shell is unverified.

Preserve Vision/CoreML/ARKit/camera capabilities, but replace the direct legacy PHP transport with the versioned product contract before it becomes part of the new primary app.

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
9. explicit NOCOSIL -> ZUKAN exchange with approval/privacy transform;
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

1. Land and test `ikimon.mobile-platform/v1` invariants.
2. Land read-only capability discovery.
3. Add language-neutral conformance fixtures for Swift/Kotlin/TypeScript.
4. Implement durable ZUKAN outbox state machine against the new command contract.
5. Add upload-intent/finalize adapter behind the product contract in staging only.
6. Refactor one existing Android native capability behind a stable port.
7. Refactor one existing iOS native capability behind the same semantic port.
8. Build the smallest shared shell spike.
9. Run paired ZUKAN/NOCOSIL negative tests.
10. Select or reject Expo with evidence.

## 12. Done definition for this slice

This slice is not `STAGING_VERIFIED` merely because source exists.

Minimum closure requires:

- platform typecheck pass;
- relevant Node tests pass;
- provider-leak negative tests pass;
- NOCOSIL->ZUKAN private-field negative tests pass;
- discovery endpoint tests pass;
- no production mutation;
- no claim that `contract_only` capabilities are live.

The next phase may then request a staging release of the exact merged source through the normal Release Commander / Cloudflare command path.
