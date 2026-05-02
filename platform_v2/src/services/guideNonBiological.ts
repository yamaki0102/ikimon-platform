function cleanGuideName(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/[()]/g, (ch) => ch === "(" ? "（" : "）")
    .trim();
}

const COMMERCIAL_OR_VEHICLE_CONTEXT_RE =
  /看板|標識|ロゴ|文字|店舗|販売店|店名|屋号|広告|道路|舗装|車|自動車|車両|バン|ワゴン|軽自動車|SUV|ミニバン|ハッチバック|ナンバー|メーカー|ブランド|ディーラー|ショールーム|Volkswagen|Scirocco|Suzuki|Honda|Toyota|Nissan|Mazda|Daihatsu|Subaru|Mitsubishi|Yamaha|Kawasaki/i;

const NON_BIOLOGICAL_NAME_RE =
  /看板|標識|ロゴ|文字|店舗|販売店|店名|屋号|広告|道路|舗装|車両|自動車|自転車|バイク|バン|ワゴン|軽自動車|SUV|ミニバン|ハッチバック|ナンバー|信号|ガードレール|電柱|電線|ATM|ENEOS|Volkswagen|Scirocco|Daihatsu|Move|Canbus|ムーヴ|キャンバス|ホンダ|トヨタ|日産|マツダ|ダイハツ|スバル|三菱|ヤマハ|カワサキ|SUZUKI|Honda|Toyota|Nissan|Mazda|Subaru|Mitsubishi|Yamaha|Kawasaki/i;

const CONTEXT_SENSITIVE_BRAND_RE =
  /^(スズキ|Suzuki|SUZUKI|ホンダ|Honda|HONDA|トヨタ|Toyota|TOYOTA|日産|Nissan|NISSAN|マツダ|Mazda|MAZDA|ダイハツ|Daihatsu|DAIHATSU|スバル|Subaru|SUBARU|三菱|Mitsubishi|MITSUBISHI|ヤマハ|Yamaha|YAMAHA|カワサキ|Kawasaki|KAWASAKI)$/i;

const VEHICLE_MODEL_OR_GENERIC_RE =
  /^(車|車両|自動車|黒いバン|白いバン|バン|ワゴン|軽自動車|SUV|ミニバン|ハッチバック|VolkswagenScirocco|Scirocco|ダイハツムーヴキャンバス|ムーヴキャンバス|キャンバス|MoveCanbus)$/iu;

export function hasGuideCommercialOrVehicleContext(value: string): boolean {
  return COMMERCIAL_OR_VEHICLE_CONTEXT_RE.test(value);
}

export function isLikelyGuideNonBiologicalName(name: string, contextText = ""): boolean {
  const cleaned = cleanGuideName(name);
  if (!cleaned) return true;
  if (VEHICLE_MODEL_OR_GENERIC_RE.test(cleaned)) return true;
  if (NON_BIOLOGICAL_NAME_RE.test(cleaned)) return true;
  if (CONTEXT_SENSITIVE_BRAND_RE.test(cleaned) && hasGuideCommercialOrVehicleContext(contextText)) return true;
  return false;
}

export function cleanGuideCanonicalName(raw: string): string {
  return cleanGuideName(raw);
}
