### 1. Verdict

**Approve with Changes**

The plan is exceptionally well-aligned with the goal of reducing capture friction while safely reusing the existing platform's core infrastructure. By refactoring the camera entry to the shared `siteShell.ts` launcher and cleanly handling fallbacks, it minimizes regression risk. However, critical gaps in **browser compatibility (insecure contexts/iOS Safari quirks), location privacy for unauthenticated users, and accessibility semantics** must be resolved before proceeding to implementation.

---

### 2. Top Findings (Severity-ordered)

#### Finding 1 (Critical): Insecure Context & Platform Crash Risk
* **Severity:** High
* **Description:** In modern mobile and desktop browsers, `navigator.mediaDevices` is only exposed in secure contexts (HTTPS or localhost). If a user accesses the site via HTTP, or within certain embedded webview environments, `navigator.mediaDevices` will be `undefined`.
* **Impact:** Attempting to query or call `getUserMedia` directly without guarding this property will throw a runtime `TypeError`, causing the entire application shell to crash.
* **Remediation:** Always implement a strict feature-check wrapper before attempting to access camera APIs. If the environment is insecure or unsupported, bypass the stream request and immediately show the "Camera Unavailable / Choose from device" UI.

#### Finding 2 (High): Privacy Leak of "Regional Records" to Guest Users
* **Severity:** High
* **Description:** The proposed guest Top page will display "regional records". If these records expose high-precision geographic coordinates, exact map pins, or detailed street addresses to anonymous guests, it represents a severe privacy and safety hazard, particularly for observations taken near homes, schools, or private properties.
* **Impact:** Risk of tracking user habits, exposing residential/children's locations to anonymous crawlers, and violating consent-based defensive boundaries.
* **Remediation:** Enforce absolute location fuzzying on any record data served to unauthenticated guest endpoints (e.g., restricting data to prefecture/municipality text names or grouping coordinates into low-resolution grid regions with a minimum of 1 km jittering).

#### Finding 3 (Medium): ARIA & Semantic Navigation Conflict in Bottom Nav
* **Severity:** Medium
* **Description:** Changing the mobile bottom navigation bar to `Capture | Places | Records | Me` where "Capture" is an immediate-action button and the others are standard router anchors creates an HTML semantic conflict. If the container uses a standard `role="tablist"` pattern, mixing page navigation with an immediate modal/dialog trigger breaks screen reader expectations.
* **Impact:** Confuses assistive technologies, rendering the primary action difficult to understand for visually impaired users.
* **Remediation:**
  * Avoid using `role="tablist"` for the bottom navigation bar.
  * Implement the bottom navigation as a standard HTML `<nav>` element containing a semantic list.
  * Explicitly mark the "Capture" button with `aria-haspopup="dialog"` and a descriptive `aria-label` (e.g., `Capture observation (opens camera)`) so screen reader users know it triggers an overlay sheet rather than navigating away.

#### Finding 4 (Medium): iOS Safari Permission Persistence & Screen Lock Quirks
* **Severity:** Medium
* **Description:** iOS Safari handles camera permissions strictly. Once a user blocks camera access, iOS Safari caches this state and does not support the standard `navigator.permissions.query` API for cameras. Additionally, if the user locks their screen or switches apps while the camera stream is active, the stream can mute silently or leave the camera resource in a locked state.
* **Impact:** The "Retry" button may silently fail to prompt the user on iOS, and leaving the stream open when the app is backgrounded drains battery and triggers privacy indicator lights.
* **Remediation:**
  * When catching a `NotAllowedError` / `PermissionDeniedError` on iOS Safari, the fallback UI must provide clear micro-copy instructions explaining how to manually re-enable access via system settings (*Settings > Safari > Camera > Allow*).
  * Listen to the `visibilitychange` event on the document, and aggressively stop and clean up all media tracks whenever the page becomes hidden.

#### Finding 5 (Low): i18n Layout Expansion in Constraint Bottom Nav
* **Severity:** Low
* **Description:** The bottom navigation bar on narrow screens (e.g., 320px–375px) has extremely limited horizontal space. While Japanese characters are extremely compact (e.g., 「撮影」, 「場所」), translation into English or other target languages (e.g., "Capture", "Places") will result in substantial text expansion.
* **Impact:** Horizontal layout clipping, text wrapping, or overlapping icons on mobile viewports.
* **Remediation:** Enforce strict CSS styling using `text-overflow: ellipsis`, and include layout assertions in Playwright mobile viewport tests for all four locale files to verify that longer translation strings do not wrap or break the bottom navigation structure.

---

### 3. Missing Assumptions or Evidence

1. **Authentication Transition and Draft Handback:** The plan does not specify how draft media stored in IndexedDB behaves when a guest user captures a photo, gets redirected to login/auth recovery, and successfully logs in.
   * *Required Assumption:* The system must safely carry over the temporary guest-capture UUID to the authenticated session without leaking data to a different user account on a shared device.
2. **LINE / In-App Browser Compatibility:** In Japan, a massive portion of mobile traffic originates from the LINE in-app browser. These webviews have restricted or highly fragile `getUserMedia` implementations.
   * *Required Assumption:* The capture sheet must be robust enough to gracefully degrade to the direct file input (`Choose from device`) fallback if the embedded webview fails to resolve the media stream.

---

### 4. Concrete Recommended Changes

#### Recommendation 1: Insecure Context Feature Guard
In the media devices invocation handler within `siteShell.ts`, wrap the stream initiation safely:
```typescript
const isCameraSupported = typeof navigator !== 'undefined' &&
                          !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

if (!isCameraSupported) {
  // Gracefully transition directly to the "Unavailable" fallback UI
  this.showCameraError('UnsupportedEnvironment');
  return;
}
```

#### Recommendation 2: Semantic Markup for Mobile Bottom Navigation
Structure the mobile navigation to clearly distinguish links from actions:
```html
<nav aria-label="Main Navigation" class="bottom-navigation">
  <ul>
    <li>
      <button
        type="button"
        class="nav-action-capture"
        aria-haspopup="dialog"
        aria-label="Capture observation (opens camera)">
        <span class="nav-icon" aria-hidden="true"></span>
        <span class="nav-label">Capture</span>
      </button>
    </li>
    <li>
      <a href="/places" class="nav-link">
        <span class="nav-icon" aria-hidden="true"></span>
        <span class="nav-label">Places</span>
      </a>
    </li>
    <!-- Remaining Links -->
  </ul>
</nav>
```

#### Recommendation 3: Defensive Stream Teardown on Visibility Change
Add an event listener to safely release hardware camera locks when the user backgrounds the application:
```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    this.cleanupActiveCameraStream(); // Ensure track.stop() is called on all tracks
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);
```

#### Recommendation 4: Guest Endpoint Coordinate Filtering
Modify the server-side API or client-side renderer for guest Top pages to explicitly strip raw latitude/longitude attributes, replacing them with a generalized geographical string or coordinates fuzzed to a safe, low-precision grid.

---

### 5. Risks that should be rejected or deferred

1. **Auto-uploading Media on Capture (Reject):** Do not implement any pre-uploading or background-syncing of captured images prior to the user explicitly pressing the "Save" or "Submit" button on the record form. This protects user bandwidth and guarantees that accidental captures are never transmitted to the server.
2. **Complex Permission Re-query Loop (Reject):** Do not attempt to write complex loops to programmatically query permissions on browsers like iOS Safari that do not support it. Fall back cleanly to informative, user-driven error screens immediately upon a failed `getUserMedia` catch.
3. **Database or Schema Migrations (Defer):** Any modification to the database schema or core upload API must be strictly deferred. Utilizing the existing IndexedDB structure as a safe holding queue is sufficient and keeps this high-priority UX improvement entirely self-contained.
