import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGuideDiscoveryAiComment,
  parseGuideVoiceUtterance,
  renderGuideBadgeTakeawayPage,
  renderGuideVoiceConsolePage
} from "./guideVoiceEvent";

test("parseGuideVoiceUtterance parses badge number, subject, count, and detail", () => {
  assert.deepEqual(parseGuideVoiceUtterance("3番、ヤツデの花、ハチ2匹"), {
    badgeNumber: 3,
    subject: "ヤツデの花",
    count: 2,
    detail: "ハチ2匹"
  });
  assert.deepEqual(parseGuideVoiceUtterance("１２番 カワセミ 1羽"), {
    badgeNumber: 12,
    subject: "カワセミ",
    count: 1,
    detail: "1羽"
  });
  assert.deepEqual(parseGuideVoiceUtterance("ヤツデの花"), {
    badgeNumber: null,
    subject: "ヤツデの花",
    count: 1,
    detail: ""
  });
});

test("renderGuideVoiceConsolePage and renderGuideBadgeTakeawayPage render offline sync and registration-free takeaway", () => {
  const consoleHtml = renderGuideVoiceConsolePage({
    sessionId: "evt_guide_1",
    title: "秋の観察会",
    eventCode: "AKI-2026",
    lang: "ja",
    cspNonce: "nonce-1",
    initialDiscoveries: []
  });
  assert.match(consoleHtml, /zukan_guide_queue_/);
  assert.match(consoleHtml, /"evt_guide_1"/);
  assert.match(consoleHtml, /guide-discoveries\/sync/);
  assert.match(consoleHtml, /AKI-2026/);
  assert.match(consoleHtml, /data-global-record-trigger="photo"/);

  const takeawayHtml = renderGuideBadgeTakeawayPage({
    sessionId: "evt_guide_1",
    eventTitle: "秋の観察会",
    badgeNumber: 3,
    nextEventNote: "次回は12月14日です",
    lang: "ja",
    cspNonce: "nonce-2",
    discoveries: [
      {
        discovery_id: "gvd_1",
        session_id: "evt_guide_1",
        badge_number: 3,
        client_entry_id: "c1",
        utterance: "3番、ヤツデの花、ハチ2匹",
        subject: "ヤツデの花",
        count: 2,
        detail: "ハチ2匹",
        ai_comment: buildGuideDiscoveryAiComment({ badgeNumber: 3, subject: "ヤツデの花", count: 2, detail: "ハチ2匹" }),
        recorder_label: "guide-1",
        latitude: null,
        longitude: null,
        area_label: "入口の林",
        face_privacy_status: "verified_no_faces",
        observed_at: "2026-11-23T07:00:00.000Z",
        created_at: 1795417200000
      }
    ]
  });
  assert.match(takeawayHtml, /名札 3番・登録不要の持ち帰り/);
  assert.match(takeawayHtml, /ヤツデの花（2）/);
  assert.match(takeawayHtml, /この説明はAIが作成しました/);
  assert.match(takeawayHtml, /次回は12月14日です/);
  assert.match(takeawayHtml, /data-global-record-trigger="photo"/);
});
