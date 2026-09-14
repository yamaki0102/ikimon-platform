import assert from "node:assert/strict";
import test from "node:test";
import {
  readParticipationTerms,
  renderParticipationTerms,
  summarizeParticipationTerms,
} from "./participationTerms.js";

const labels = {
  heading: "募集条件",
  roleLabel: "役割",
  relationshipLabel: "関係性",
  compensationLabel: "対価・謝礼",
  expensesLabel: "経費・交通費",
  participantCostLabel: "参加者負担",
  unknownValue: "未確認",
  notApplicableValue: "非該当",
  zeroValue: "0円",
  capLabel: "上限",
  disclaimer: "掲載された募集条件の表示です。法的分類を確定するものではありません。",
};

test("keeps role, compensation, expenses, and participant cost independent", () => {
  const config = {
    participationTerms: {
      roles: [
        {
          roleLabel: "案内係",
          relationshipType: "無償ボランティア",
          compensation: { state: "not_applicable" },
          expenses: { state: "not_applicable" },
          participantCost: { amount: 0, currency: "JPY", unit: "per person" },
        },
        {
          roleLabel: "現地講師",
          relationshipType: "業務委託",
          compensation: { amount: 3000, currency: "JPY", unit: "per session" },
          expenses: {
            display: "実費精算",
            cap: { amount: 1000, currency: "JPY", unit: "per session" },
          },
          participantCost: { state: "zero", currency: "JPY", unit: "per person" },
        },
      ],
    },
  };

  const projection = readParticipationTerms(config);
  assert.ok(projection);
  assert.equal(projection.roles.length, 2);
  assert.equal(projection.roles[0]?.compensation.state, "not_applicable");
  assert.equal(projection.roles[1]?.compensation.amount, 3000);
  assert.equal(projection.roles[1]?.expenses.capAmount, 1000);
  assert.equal(projection.roles[1]?.participantCost.state, "zero");

  const html = renderParticipationTerms(config, labels);
  assert.match(html, /data-participation-terms/);
  assert.match(html, /案内係/);
  assert.match(html, /現地講師/);
  assert.match(html, /無償ボランティア/);
  assert.match(html, /業務委託/);
  assert.match(html, /3,000 JPY \/ per session/);
  assert.match(html, /実費精算 \/ 上限 1,000 JPY \/ per session/);
  assert.match(html, /0 JPY \/ per person/);
  assert.match(html, /非該当/);

  const summary = summarizeParticipationTerms(config, labels);
  assert.ok(summary);
  const roleSummaries = summary.split(" ｜ ");
  assert.equal(roleSummaries.length, 2);
  assert.doesNotMatch(roleSummaries[0] ?? "", /3,000/);
  assert.match(roleSummaries[1] ?? "", /3,000 JPY/);
});

test("distinguishes unknown, not applicable, and zero without turning null into free", () => {
  const config = {
    terms: {
      compensation: { amount: null },
      expenses: { state: "not_applicable" },
      participantCost: 0,
    },
  };

  const projection = readParticipationTerms(config);
  assert.ok(projection);
  assert.equal(projection.compensation.state, "unknown");
  assert.equal(projection.expenses.state, "not_applicable");
  assert.equal(projection.participantCost.state, "zero");

  const html = renderParticipationTerms(config, labels);
  assert.match(html, /対価・謝礼[\s\S]*?未確認/);
  assert.match(html, /経費・交通費[\s\S]*?非該当/);
  assert.match(html, /参加者負担[\s\S]*?0円/);
  assert.doesNotMatch(html, /対価・謝礼[\s\S]*?無料/);
});

test("keeps an explicitly zero fact readable when only currency and unit are supplied", () => {
  const projection = readParticipationTerms({
    participationTerms: {
      participantCost: { state: "zero", currency: "JPY", unit: "per person" },
    },
  });
  assert.ok(projection);
  assert.equal(projection.participantCost.state, "zero");
  assert.match(renderParticipationTerms({
    participationTerms: {
      participantCost: { state: "zero", currency: "JPY", unit: "per person" },
    },
  }, labels), /0 JPY \/ per person/);
});

test("renders explicit relationship text without deriving legal or insurance status", () => {
  const config = {
    participation: {
      terms: {
        role: "協力者",
        relationshipType: "有償ボランティア",
        compensation: { display: "条件は相談" },
      },
    },
  };

  const html = renderParticipationTerms(config, labels);
  assert.match(html, /有償ボランティア/);
  assert.match(html, /法的分類を確定するものではありません/);
  assert.doesNotMatch(html, /労働者性|保険適用済み|雇用契約済み/);
  assert.doesNotMatch(html, /internal|private-note/);
});

test("ignores legacy cost-only profiles and arbitrary raw source fields", () => {
  const legacyConfig = {
    cost: "500円",
    description: "従来の観察会プロフィール",
    raw: { compensation: "秘密の条件" },
  };
  assert.equal(readParticipationTerms(legacyConfig), null);
  assert.equal(renderParticipationTerms(legacyConfig, labels), "");
  assert.equal(summarizeParticipationTerms(legacyConfig, labels), null);
});

test("escapes explicit public term text before rendering", () => {
  const html = renderParticipationTerms({
    participationTerms: {
      roleLabel: "<講師>",
      compensation: { display: "<script>alert(1)</script>" },
    },
  }, labels);
  assert.match(html, /&lt;講師&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
