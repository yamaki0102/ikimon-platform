import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("area sketch assessment draft creation requires login before DB work", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/fields/11111111-1111-4111-8111-111111111111/area-sketch-assessments",
      payload: {
        sketch_polygon: {
          type: "Polygon",
          coordinates: [[
            [137.7043, 34.6984],
            [137.706, 34.6984],
            [137.706, 34.6996],
            [137.7043, 34.6996],
            [137.7043, 34.6984],
          ]],
        },
        land_cover: [{ category: "trees_planting", ratio: 0.2 }],
      },
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("area sketch assessment list requires login before DB work", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/fields/11111111-1111-4111-8111-111111111111/area-sketch-assessments",
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }
});
