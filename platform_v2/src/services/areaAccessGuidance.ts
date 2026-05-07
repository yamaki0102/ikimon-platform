import type { FieldSource } from "./observationFieldRegistry.js";

export type AreaAccessStatus = "public_access" | "permission_required" | "private_or_restricted" | "unknown";

export type AreaAccessGuidance = {
  status: AreaAccessStatus;
  label: string;
  body: string;
};

type AccessInput = {
  source?: FieldSource | string | null;
  adminLevel?: string | null;
  payload?: Record<string, unknown> | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = text(value);
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

function payloadValue(payload: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (payload[key] != null) return payload[key];
  }
  return undefined;
}

export function buildAreaAccessGuidance(input: AccessInput): AreaAccessGuidance {
  const payload = input.payload ?? {};
  const rawAccess = text(payloadValue(payload, ["access", "access_status", "public_access", "entry_status", "立入可否"]));
  const privateLand = bool(payloadValue(payload, ["private_land", "is_private_land", "私有地"]));
  const permissionRequired = bool(payloadValue(payload, ["permission_required", "requires_permission", "要許可"]));
  const source = String(input.source ?? "");
  const adminLevel = String(input.adminLevel ?? "");

  if (privateLand === true || ["private", "no", "restricted"].includes(rawAccess)) {
    return {
      status: "private_or_restricted",
      label: "立入注意",
      body: "私有地または立入制限のある区域の可能性があります。管理者の許可なく入らず、道路・公開園路など入れる場所から観察してください。",
    };
  }

  if (permissionRequired === true || ["permit", "permission", "permission_required", "customers"].includes(rawAccess)) {
    return {
      status: "permission_required",
      label: "許可確認",
      body: "入る前に管理者・学校・施設の許可が必要な区域の可能性があります。観察会を開く場合は、事前に利用条件と集合場所を確認してください。",
    };
  }

  if (source === "school" || adminLevel === "school") {
    return {
      status: "permission_required",
      label: "学校・キャンパス",
      body: "学校やキャンパスは関係者区域を含むことがあります。無許可で敷地内に入らず、公開範囲・学校行事・管理者許可のある観察だけにしてください。",
    };
  }

  if (["yes", "public", "permissive", "designated"].includes(rawAccess) || privateLand === false) {
    return {
      status: "public_access",
      label: "公開範囲を確認",
      body: "公開されている範囲でも、夜間閉鎖・保護区域・立入禁止ロープなど現地ルールが優先です。案内板と管理者の指示に従ってください。",
    };
  }

  return {
    status: "unknown",
    label: "立入可否 不明",
    body: "このエリアが私有地か、無許可で入れる場所かは未確認です。立入前に現地の案内、管理者、公開範囲を確認してください。",
  };
}

export const __test__ = {
  bool,
};
