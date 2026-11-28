import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminCodes } from "../adminUnits";
import { loadAdminIndexForBbox } from "./adminLookup";
import { migratedDb } from "./sqliteDb.testkit";

const square = (x0: number, y0: number, x1: number, y1: number) => JSON.stringify({ type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] });

test("point in a ward resolves ward and city codes; missing tables do not throw", async () => {
  const { db, sqlite } = migratedDb();
  sqlite.exec(`INSERT INTO admin_units (code,level,parent_code,name_ja,boundary_version) VALUES ('22130','city',NULL,'浜松市','t'),('22131','ward','22130','中央区','t');
    INSERT INTO admin_unit_boundaries (code,bbox_min_lng,bbox_min_lat,bbox_max_lng,bbox_max_lat,geometry_json) VALUES ('22131',137,34,138,35,'${square(137, 34, 138, 35)}')`);
  const index = await loadAdminIndexForBbox(db, [137.5, 34.5, 137.6, 34.6]);
  const codes = resolveAdminCodes(137.5, 34.5, index);
  assert.equal(codes.ward_code, "22131");
  assert.equal(codes.city_code, "22130");
  assert.equal((await loadAdminIndexForBbox(db, [100, 10, 101, 11])).leaves.length, 0);
  sqlite.exec("DROP TABLE admin_unit_boundaries");
  assert.equal((await loadAdminIndexForBbox(db, [137, 34, 138, 35])).leaves.length, 0);
});
