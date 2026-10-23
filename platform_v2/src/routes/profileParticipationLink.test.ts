import assert from "node:assert/strict";
import test from "node:test";
import { renderSelfProfileHub } from "./read.js";
import type { ProfileSnapshot } from "../services/readModels.js";

function profileSnapshot(): ProfileSnapshot {
  return {
    visibility: "owner",
    userId: "profile-participation-test",
    displayName: "地域の記録者",
    rankLabel: null,
    avatarUrl: null,
    profileBio: null,
    expertise: null,
    publicContributionRange: null,
    stats: {
      totalObservations: 0,
      thisMonthObservations: 0,
      placeCount: 0,
      uniqueTaxaAllTime: 0,
      currentStreakDays: 0,
      tier2PlusCount: 0,
      tier3PlusCount: 0,
      firstObservedAt: null,
      latestObservedAt: null,
    },
    lifeListPreview: [],
    recentPlaces: [],
    recentObservations: [],
  };
}

test("self profile participation card routes to the localized canonical hub", () => {
  const html = renderSelfProfileHub("/base", "ja", profileSnapshot());

  assert.match(html, /<a class="self-control-card" href="\/ja\/base\/community\/events"><span>つながり<\/span><strong>参加できる企画<\/strong>/);
  assert.doesNotMatch(html, /source=self_participation/);
  assert.doesNotMatch(html, /参加とフォロー|Participation and follows|Participación y seguimiento|Participação e seguidores/);
});
