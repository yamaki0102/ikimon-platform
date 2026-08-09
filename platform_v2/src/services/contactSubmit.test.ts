import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./contactSubmit.js";

test("contact mail presents ZUKAN while retaining the legacy sender address", () => {
  const input = {
    category: "question",
    name: "テスト利用者",
    message: "公開URLの確認です。",
  };
  const admin = __test__.buildAdminNotification(input, "submission-1");
  const reply = __test__.buildAutoReply(input, "submission-1");

  assert.match(admin.subject, /^\[ZUKAN\]/);
  assert.match(admin.body, /ZUKAN お問い合わせ通知/);
  assert.equal(__test__.noreplyFrom, "ZUKAN <noreply@ikimon.life>");
  assert.equal(reply.subject, "[ZUKAN] お問い合わせを受け付けました");
  assert.match(reply.body, /https:\/\/zukan\.earth\/contact/);
  assert.match(reply.body, /ZUKAN 運営チーム/);
  assert.doesNotMatch(reply.body, /https:\/\/ikimon\.life/);
});
