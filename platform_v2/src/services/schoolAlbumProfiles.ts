import type { ObservationField } from "./observationFieldRegistry.js";

export type SchoolAlbumProfileKind = "biotope" | "commute_route" | "campus_season";

export type SchoolAlbumProfile = {
  kind: SchoolAlbumProfileKind;
  title: string;
  lead: string;
  href: string;
};

function isSchoolField(field: Pick<ObservationField, "source" | "adminLevel">): boolean {
  return field.source === "school" || field.adminLevel === "school";
}

export function buildSchoolAlbumProfiles(field: Pick<ObservationField, "fieldId" | "source" | "adminLevel" | "name">): SchoolAlbumProfile[] {
  if (!isSchoolField(field)) return [];
  const base = `/community/fields/${encodeURIComponent(field.fieldId)}`;
  return [
    {
      kind: "biotope",
      title: "学校ビオトープ図鑑",
      lead: "校庭、花壇、水辺、樹木まわりの発見を学校の自然資産として残す。",
      href: `${base}?album=school_biotope`,
    },
    {
      kind: "commute_route",
      title: "通学路いきもの図鑑",
      lead: "登下校や地域探検で見つけた生きものを、学校の外側の学びに広げる。",
      href: `${base}?album=commute_route`,
    },
    {
      kind: "campus_season",
      title: "キャンパス季節図鑑",
      lead: "春夏秋冬で変わる校内・キャンパスの自然を、年ごとに比べる。",
      href: `${base}?album=campus_season`,
    },
  ];
}

export const __test__ = {
  isSchoolField,
};
