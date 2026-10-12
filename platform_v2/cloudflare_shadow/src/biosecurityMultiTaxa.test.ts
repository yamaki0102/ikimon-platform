import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { MULTI_TAXA_VERSION, VISIBLE_TAXA, buildMultiTaxaRequest, generateMultiTaxaHints, mergeMultiTaxaPhotos, parseMultiTaxaResult } from "./biosecurityMultiTaxa";
import type { BiosecurityPhotoHintAsset } from "./biosecurityPhotoHints";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPUyLNhYGBgYmBgYGBgAAAJ7gDW/OIFpQAAAABJRU5ErkJggg==", "base64");
const photo = (id: string): BiosecurityPhotoHintAsset => ({
  assetId: id, sha256: createHash("sha256").update(PNG).digest("hex"),
  bytes: Uint8Array.from(PNG).buffer, mime: "image/png",
});
function reply(request: Record<string, unknown>, selected: readonly string[]) {
  const questions = request.questions as Record<string,{type:string;criteria?:Record<string,string>}>;
  const answers: Record<string,unknown> = {};
  for (const [key,q] of Object.entries(questions)) {
    if (q.type === "noul") {
      answers[key] = { type:"noul", noul:selected.includes(key.slice(5)) ? 0.91 : 0.04 };
    } else {
      const options = Object.keys(q.criteria||{});
      const choice = selected.includes(key.slice(6)) ? "two_three" : "unknown";
      answers[key] = {type:"choice",choice,
        probabilities:Object.fromEntries(options.map(o=>[o,o===choice?0.9:0.1/(options.length-1)])),
        confidence:0.9};
    }
  }
  return {model:"clef-flash",answers,usage:{input_tokens:2450,output_tokens:0}};
}
test("one photo may contain multiple families and genera, while absent taxa remain unasserted", () => {
  const asset=photo("asset_1"),request=buildMultiTaxaRequest(asset);
  const q=request.questions as Record<string,unknown>;
  assert.equal(Object.keys(q).length,VISIBLE_TAXA.length);
  assert.ok(Object.keys(q).length<=64);
  assert.equal((request.images as {base64:string}[])[0]?.base64,PNG.toString("base64"));
  const raw=reply(request,["cerambycidae","aromia","formicidae"]);
  const counts=reply(buildMultiTaxaRequest(asset,["cerambycidae","aromia","formicidae"]),["cerambycidae","aromia","formicidae"]);
  const result=parseMultiTaxaResult(raw,asset,1,counts);
  assert.equal(result.status,"candidates");
  assert.deepEqual(result.candidates.map(x=>x.taxonId).sort(),["aromia","cerambycidae","formicidae"]);
  assert.equal(result.candidates.find(x=>x.taxonId==="aromia")?.parentId,"cerambycidae");
  assert.ok(result.candidates.every(x=>x.verification==="unverified"&&x.countBand==="two_three"));
  assert.equal(result.inputTokens,4900);
});
test("one post can contain different taxa across photos; same taxon never gets its individuals summed", () => {
  const a=photo("asset_1"),b=photo("asset_2");
  const pa=parseMultiTaxaResult(reply(buildMultiTaxaRequest(a),["formicidae","aromia"]),a,1);
  const pb=parseMultiTaxaResult(reply(buildMultiTaxaRequest(b),["formicidae","poaceae"]),b,2);
  const combined=mergeMultiTaxaPhotos([pa,pb]);
  assert.equal(combined.schema,MULTI_TAXA_VERSION);
  assert.equal(combined.photosEvaluated,2);
  assert.deepEqual(combined.candidates.map(x=>x.taxonId).sort(),["aromia","formicidae","poaceae"]);
  const ant=combined.candidates.find(x=>x.taxonId==="formicidae")!;
  assert.equal(ant.countAcrossPhotos,"not_deduplicated");
  assert.equal(ant.observations.length,2);
  assert.deepEqual(ant.observations.map(x=>x.photoNumber),[1,2]);
  assert.deepEqual(ant.observations.map(x=>x.assetId),["asset_1","asset_2"]);
  assert.throws(()=>mergeMultiTaxaPhotos([pa,pa]),/photo_number_invalid/);
});
test("malformed / uncalibrated responses fail closed, and low counts do not become exact observations", () => {
  const a=photo("asset_1"),request=buildMultiTaxaRequest(a),valid=reply(request,["aromia"]);
  assert.equal(parseMultiTaxaResult({ ...valid, answers:{...valid.answers, seen_aromia:{type:"noul",noul:2}} },a,1).status,"unavailable");
  assert.equal(parseMultiTaxaResult({ ...valid, answers:{...valid.answers, irrelevant:{type:"noul",noul:1}} },a,1).status,"unavailable");
  const low=reply(buildMultiTaxaRequest(a,["aromia"]),["aromia"]) as {answers:Record<string,any>};
  low.answers.count_aromia.choice="unknown";
  low.answers.count_aromia.probabilities={unknown:0.9,one:0.025,two_three:0.025,four_nine:0.025,ten_plus:0.025};
  assert.equal(parseMultiTaxaResult(valid,a,1,low).candidates.find(x=>x.taxonId==="aromia")?.countBand,"unknown");
  const wrong={...a,assetSha256:"0".repeat(64)};
  let calls=0;
  return generateMultiTaxaHints({run:async()=>{calls++;return valid}},wrong,1).then(out=>{
    assert.equal(out.status,"unavailable");assert.equal(calls,0);
  });
});
test("live candidate generation keeps private metadata out of the model request", async () => {
  const a={...photo("asset_1"), privateGps:"35.0000", note:"private note"} as BiosecurityPhotoHintAsset;
  const bodies: unknown[]=[];
  const result=await generateMultiTaxaHints({run:async (_model,input)=>{bodies.push(input);return reply(input,["aromia","formicidae"])}},a,1);
  assert.equal(result.status,"candidates");
  assert.equal(result.candidates.length,2);
  assert.equal(bodies.length,2);
  assert.ok(!JSON.stringify(bodies).includes("private note"));
  assert.ok(!JSON.stringify(bodies).includes("35.0000"));
});
