// ContentClaimsValidator
// 連動: ikimon-internal/docs/content_claims_style_guide.md (Relationship Score v0.1 用ガイド v1.0)
//
// ハード違反 (forbidden_terms) は検出 → 1回リトライ → 失敗時テンプレ落ち。
// ソフト警告は表示通過、ログ記録のみ。

import type { SiteLang } from "../i18n.js";

export const CONTENT_CLAIMS_STYLE_GUIDE_VERSION = "1.0.0";

export type ClaimViolation = {
  id: string;
  matchedTerm: string;
  reason: string;
};

export type ClaimWarning = {
  id: string;
  matchedTerm: string;
  note: string;
};

export type ValidationResult = {
  ok: boolean;
  hardViolations: ClaimViolation[];
  softWarnings: ClaimWarning[];
  styleGuideVersion: string;
};

type ForbiddenEntry = {
  id: string;
  reason: string;
  patterns: Partial<Record<SiteLang, string[]>>;
};

type SoftWarningEntry = {
  id: string;
  note: string;
  patterns: string[]; // 言語横断
};

const FORBIDDEN_TERMS: ForbiddenEntry[] = [
  {
    id: "nri_certification",
    reason: "NRI 正式版未発表段階での権威付け回避",
    patterns: {
      ja: ["NRI対応", "NRI 認定", "Nature Relationship Index 認定"],
      en: ["NRI compliant", "NRI certified", "Nature Relationship Index certified"],
      es: ["certificado NRI", "cumple con NRI"],
      "pt-BR": ["certificado NRI", "compatível com NRI"],
    },
  },
  {
    id: "tnfd_compliance",
    reason: "TNFD は枠組みであり認証ではない",
    patterns: {
      ja: ["TNFD準拠", "TNFD 準拠", "TNFD 認定"],
      en: ["TNFD certified", "TNFD compliant", "TNFD-compliant"],
      es: ["certificado TNFD", "cumple con TNFD"],
      "pt-BR": ["certificado TNFD", "compatível com TNFD"],
    },
  },
  {
    id: "extinction_savior",
    reason: "過剰な保全主体感",
    patterns: {
      ja: ["絶滅から守る", "絶滅危惧種を救う", "絶滅を防ぐ"],
      en: ["save from extinction", "rescue endangered species", "prevent extinction"],
      es: ["salvar de la extinción", "rescatar especies en peligro"],
      "pt-BR": ["salvar da extinção", "resgatar espécies ameaçadas"],
    },
  },
  {
    id: "biodiversity_improved",
    reason: "記録活動を測るスコアであり生態系改善の証明ではない",
    patterns: {
      ja: ["生物多様性が改善した", "生物多様性が向上した"],
      en: ["biodiversity improved", "biodiversity increased"],
      es: ["la biodiversidad mejoró", "se incrementó la biodiversidad"],
      "pt-BR": ["a biodiversidade melhorou", "aumento da biodiversidade"],
    },
  },
  {
    id: "medical_claims",
    reason: "医療・薬機法クレームの誤用",
    patterns: {
      ja: ["健康効果が確認された", "医学的に証明された"],
      en: ["medically proven", "health benefits confirmed"],
      es: ["beneficios médicos comprobados"],
      "pt-BR": ["benefícios médicos comprovados"],
    },
  },
  {
    id: "official_certification",
    reason: "認証バッジモデルの誘惑回避",
    patterns: {
      ja: ["公式認証", "公式認定"],
      en: ["official certification", "officially certified"],
      es: ["certificación oficial"],
      "pt-BR": ["certificação oficial"],
    },
  },
  {
    id: "top_ranked",
    reason: "比較禁止 (§11) に直接違反",
    patterns: {
      ja: ["このスコアが高いほど良い企業", "ランキング上位"],
      en: ["top-ranked company", "higher score means better company"],
      es: ["empresa mejor clasificada"],
      "pt-BR": ["empresa melhor classificada"],
    },
  },
  {
    id: "nature_coexistence_proven",
    reason: "単独指標では証明にならない",
    patterns: {
      ja: ["自然共生を証明", "自然との共生を保証"],
      en: ["proves coexistence with nature", "guarantees nature harmony"],
    },
  },
];

const SOFT_WARNINGS: SoftWarningEntry[] = [
  {
    id: "overstated_assertion",
    note: "過剰な断定。Relationship Score の趣旨に反する",
    patterns: ["絶対に", "必ず", "間違いなく", "always", "definitely", "absolutely"],
  },
  {
    id: "alarmist_tone",
    note: "煽動的表現。観察・対話のトーンに寄せる",
    patterns: ["危機", "破壊", "崩壊", "crisis", "destruction", "collapse"],
  },
  {
    id: "rare_species_boast",
    note: "種数誇示は §11 比較禁止と隣接",
    patterns: ["絶滅危惧種", "保護種", "endangered species", "rare species"],
  },
  {
    id: "locked_example",
    note: "個別種名を「型」の例文に固定しない",
    patterns: ["クビアカ", "サシバ", "ニジマス", "アメリカザリガニ"],
  },
];

function findMatch(text: string, term: string): boolean {
  if (!term) return false;
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  return haystack.includes(needle);
}

export function validateNarrative(text: string, lang: SiteLang): ValidationResult {
  const hardViolations: ClaimViolation[] = [];
  const softWarnings: ClaimWarning[] = [];

  for (const entry of FORBIDDEN_TERMS) {
    const langPatterns = entry.patterns[lang] ?? [];
    const allPatterns = [
      ...langPatterns,
      ...(entry.patterns.en ?? []), // 英語は全言語で念のためチェック
    ];
    for (const pattern of allPatterns) {
      if (findMatch(text, pattern)) {
        hardViolations.push({ id: entry.id, matchedTerm: pattern, reason: entry.reason });
        break; // 同一カテゴリで1個見つかれば次のカテゴリへ
      }
    }
  }

  for (const entry of SOFT_WARNINGS) {
    for (const pattern of entry.patterns) {
      if (findMatch(text, pattern)) {
        softWarnings.push({ id: entry.id, matchedTerm: pattern, note: entry.note });
        break;
      }
    }
  }

  return {
    ok: hardViolations.length === 0,
    hardViolations,
    softWarnings,
    styleGuideVersion: CONTENT_CLAIMS_STYLE_GUIDE_VERSION,
  };
}

// テンプレート落ち時の固定アクション文 (LLM 失敗時のフォールバック)
// 仕様書 §10.1 と整合。種名・地名なし、業種非依存
const FALLBACK_NEXT_ACTION: Record<string, Record<SiteLang, string>> = {
  access: {
    ja: "観察可能範囲と安全導線を明文化する",
    en: "Document the observable area and safety pathways",
    es: "Documentar el área observable y las rutas de seguridad",
    "pt-BR": "Documentar a área observável e os caminhos de segurança",
  },
  engagement: {
    ja: "同じ場所で季節を変えた観察会を設計する",
    en: "Design observation sessions across different seasons at the same site",
    es: "Diseñar sesiones de observación en diferentes estaciones en el mismo sitio",
    "pt-BR": "Planejar sessões de observação em diferentes estações no mesmo local",
  },
  learning: {
    ja: "同定コメントと次回観察の問いを返す",
    en: "Return identification comments and questions for next observation",
    es: "Devolver comentarios de identificación y preguntas para la próxima observación",
    "pt-BR": "Devolver comentários de identificação e perguntas para a próxima observação",
  },
  stewardship: {
    ja: "管理作業と観察結果を同じ日誌に記録する",
    en: "Record management work and observations in the same journal",
    es: "Registrar el trabajo de gestión y las observaciones en el mismo diario",
    "pt-BR": "Registrar o trabalho de manejo e as observações no mesmo diário",
  },
  evidence: {
    ja: "effort 項目と専門家レビューの対象を決める",
    en: "Decide on effort fields and expert review targets",
    es: "Decidir los campos de esfuerzo y los objetivos de revisión por expertos",
    "pt-BR": "Definir os campos de esforço e os alvos de revisão por especialistas",
  },
};

export function fallbackNextActionText(axis: string, lang: SiteLang): string {
  const map = FALLBACK_NEXT_ACTION[axis] ?? FALLBACK_NEXT_ACTION.engagement;
  if (!map) {
    return "Plan the next observation";
  }
  return map[lang] ?? map.ja;
}
