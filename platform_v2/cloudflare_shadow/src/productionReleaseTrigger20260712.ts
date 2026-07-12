/**
 * Forces one production runtime release after the control-plane-only clean-gate fix.
 *
 * The owner-home photo/card fixes were already merged, but production remained on an
 * older Worker because the deployment gate rejected the workflow-owned Playwright
 * cache. Keeping this marker in the runtime source tree makes the release planner run
 * the full smoke/deploy path for the exact commit that contains the corrected gate.
 */
export const PRODUCTION_RELEASE_TRIGGER_20260712 = "issue-1247-owner-home-photo-card";
