import assert from "node:assert/strict";
import test from "node:test";
import { googleResponseText } from "./aiModelRouter.js";

test("googleResponseText joins multi-part Gemini text responses", () => {
  assert.equal(
    googleResponseText({
      text: "{",
      candidates: [{
        content: {
          parts: [
            { text: "{\n  \"sentence\":" },
            { text: " \"次は葉の裏側も写すと特徴が分かりやすくなります。\"" },
            { text: ",\n  \"priority\": \"angle\",\n  \"visualSignals\": [\"葉の表側\"]\n}" },
          ],
        },
      }],
    }),
    "{\n  \"sentence\": \"次は葉の裏側も写すと特徴が分かりやすくなります。\",\n  \"priority\": \"angle\",\n  \"visualSignals\": [\"葉の表側\"]\n}",
  );
});
