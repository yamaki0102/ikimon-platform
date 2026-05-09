import { searchDigitizedRag, type DigitizedRagSearchResult } from "./digitizedBookRag.js";
import { generateAiTextWithRoleChain } from "./aiModelRouter.js";

export type DigitizedRagCitation = {
  citationId: string;
  unitId: string;
  type: "continuity_chain" | "page_anchor";
  bookId: string;
  bookTitle: string;
  articleId: string | null;
  title: string | null;
  pageStart: number;
  pageEnd: number;
  anchorPage: number | null;
  summary: string;
  facts: string[];
  keywords: string[];
  taxa: Array<{
    label: string;
    mentionType: "explicit" | "inferred";
    confidence: number;
  }>;
};

export type DigitizedRagAnswer = {
  ok: boolean;
  provider: "gemini" | "fallback";
  model: string;
  question: string;
  confidence: "high" | "medium" | "low";
  answer: string;
  notes: string[];
  citations: DigitizedRagCitation[];
  usedCitationIds: string[];
};

type AnswerOptions = {
  question: string;
  bookId?: string;
  type?: "all" | "continuity_chain" | "page_anchor";
};

type ParsedGeminiAnswer = {
  answer?: string;
  confidence?: "high" | "medium" | "low";
  used_citations?: string[];
  notes?: string[];
};

type GeminiAnswerResult = {
  model: string;
  payload: ParsedGeminiAnswer;
};

function toCitation(result: DigitizedRagSearchResult, index: number): DigitizedRagCitation {
  return {
    citationId: `C${index + 1}`,
    unitId: result.unitId,
    type: result.type,
    bookId: result.bookId,
    bookTitle: result.bookTitle,
    articleId: result.articleId,
    title: result.title,
    pageStart: result.pageStart,
    pageEnd: result.pageEnd,
    anchorPage: result.anchorPage,
    summary: result.summary,
    facts: result.facts.slice(0, 6),
    keywords: result.keywords.slice(0, 10),
    taxa: result.taxa.slice(0, 8).map((taxon) => ({
      label: [taxon.japaneseName, taxon.scientificName].filter(Boolean).join(" / ") || taxon.group || "taxon",
      mentionType: taxon.mentionType,
      confidence: taxon.confidence,
    })),
  };
}

function buildFallbackAnswer(question: string, citations: DigitizedRagCitation[]): DigitizedRagAnswer {
  const top = citations.slice(0, 3);
  const answer = top.length > 0
    ? top
        .map((citation) => {
          const title = citation.title ?? citation.bookTitle;
          const pages = citation.pageStart === citation.pageEnd ? `p.${citation.pageStart}` : `p.${citation.pageStart}-${citation.pageEnd}`;
          return `${title} (${pages}) では、${citation.summary} [${citation.citationId}]`;
        })
        .join(" ")
    : "関連する RAG citation が見つからなかった。";

  return {
    ok: true,
    provider: "fallback",
    model: "deterministic-summary",
    question,
    confidence: top.length >= 2 ? "medium" : "low",
    answer,
    notes: [
      "Gemini を使わず、retrieval summary だけで回答を組み立てた。",
      "必要なら citation を見て人間が要約を磨く前提。",
    ],
    citations,
    usedCitationIds: top.map((citation) => citation.citationId),
  };
}

function buildPrompt(question: string, citations: DigitizedRagCitation[]): string {
  const context = citations
    .map((citation) => {
      const pages = citation.pageStart === citation.pageEnd ? `p.${citation.pageStart}` : `p.${citation.pageStart}-${citation.pageEnd}`;
      return [
        `Citation ${citation.citationId}`,
        `book: ${citation.bookTitle}`,
        `pages: ${pages}`,
        `type: ${citation.type}`,
        `article_id: ${citation.articleId ?? "-"}`,
        `title: ${citation.title ?? "-"}`,
        `summary: ${citation.summary}`,
        `facts: ${citation.facts.join(" | ") || "-"}`,
        `keywords: ${citation.keywords.join(", ") || "-"}`,
        `taxa: ${
          citation.taxa.map((taxon) => `${taxon.label} (${taxon.mentionType}, ${taxon.confidence.toFixed(2)})`).join(" | ") || "-"
        }`,
      ].join("\n");
    })
    .join("\n\n");

  return `You are answering an INTERNAL-ONLY question for a digitized biological book staging console.

Rules:
- Answer in concise Japanese.
- Use only the provided citation summaries/facts; do not invent unseen details.
- Do not reproduce long verbatim text from the original book.
- Every substantive claim must cite one or more citation ids like [C1].
- If the retrieval evidence is weak, say so explicitly.
- Prefer continuity_chain citations when they cover the answer better than page_anchor citations.

Question:
${question}

Citations:
${context}

Return strict JSON:
{
  "answer": "Japanese answer with inline citation ids like [C1][C2]",
  "confidence": "high|medium|low",
  "used_citations": ["C1", "C2"],
  "notes": ["short note"]
}`;
}

async function callAiAnswer(question: string, citations: DigitizedRagCitation[]): Promise<GeminiAnswerResult | null> {
  const result = await generateAiTextWithRoleChain({
    chainName: "digitizedRagAnswer",
    text: buildPrompt(question, citations),
    responseMimeType: "application/json",
    temperature: 0.2,
    retriesPerModel: 4,
    retryDelayMs: 1500,
    cost: {
      layer: "hot",
      endpoint: "digitized_book_rag_answer",
    },
  });
  const clean = result.text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(clean) as ParsedGeminiAnswer;
  return {
    model: result.model,
    payload: parsed,
  };
}

export async function answerDigitizedRag(options: AnswerOptions): Promise<DigitizedRagAnswer> {
  const question = options.question.trim();
  let retrieval = await searchDigitizedRag({
    q: question,
    bookId: options.bookId,
    type: options.type ?? "all",
    limit: 8,
    offset: 0,
  });

  if (retrieval.results.length === 0 && options.bookId) {
    retrieval = await searchDigitizedRag({
      q: "",
      bookId: options.bookId,
      type: options.type ?? "all",
      limit: 12,
      offset: 0,
    });
  }

  const ranked = retrieval.results
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "continuity_chain" ? -1 : 1;
      }
      return right.score - left.score;
    })
    .slice(0, 6);
  const citations = ranked.map((result, index) => toCitation(result, index));

  if (question === "" || citations.length === 0) {
    return {
      ok: true,
      provider: "fallback",
      model: "deterministic-summary",
      question,
      confidence: "low",
      answer: "質問に対して参照できる RAG citation がまだ見つからない。",
      notes: ["検索語を増やすか、book scope を広げると改善する可能性がある。"],
      citations,
      usedCitationIds: [],
    };
  }

  try {
    const gemini = await callAiAnswer(question, citations);
    if (!gemini?.payload?.answer) {
      return buildFallbackAnswer(question, citations);
    }

    const usedCitationIds = Array.isArray(gemini.payload.used_citations)
      ? gemini.payload.used_citations.filter((citationId): citationId is string => typeof citationId === "string")
      : citations.slice(0, 3).map((citation) => citation.citationId);

    return {
      ok: true,
      provider: "gemini",
      model: gemini.model,
      question,
      confidence:
        gemini.payload.confidence === "high" || gemini.payload.confidence === "medium" || gemini.payload.confidence === "low"
          ? gemini.payload.confidence
          : "medium",
      answer: gemini.payload.answer.trim(),
      notes: Array.isArray(gemini.payload.notes) ? gemini.payload.notes.map((note) => String(note)) : [],
      citations,
      usedCitationIds,
    };
  } catch (error) {
    return {
      ...buildFallbackAnswer(question, citations),
      notes: [
        `Gemini unavailable: ${error instanceof Error ? error.message : "unknown_error"}`,
        "retrieval summary だけでフォールバック回答を組み立てた。",
      ],
    };
  }
}
