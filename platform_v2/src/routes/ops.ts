import type { FastifyInstance, FastifyRequest } from "fastify";

import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import {
  emptyCatalogEntry,
  readDigitizedBookDetail,
  readDigitizedBooksCatalog,
} from "../services/digitizedBooks.js";
import { answerDigitizedRag } from "../services/digitizedBookRagAnswer.js";
import { searchDigitizedRag } from "../services/digitizedBookRag.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import { getReadinessSnapshot } from "../services/readiness.js";
import { renderSiteDocument } from "../ui/siteShell.js";

type BooksQuery = {
  q?: string;
  bookId?: string;
  limit?: string;
  offset?: string;
};

type RagQuery = {
  q?: string;
  bookId?: string;
  type?: string;
  limit?: string;
  offset?: string;
};

type RagAnswerBody = {
  question?: string;
  bookId?: string;
  type?: string;
};

function parseLimit(raw: string | undefined, fallback: number, max = 200): number {
  return Math.min(max, Math.max(1, Number.parseInt(raw ?? String(fallback), 10) || fallback));
}

function parseOffset(raw: string | undefined): number {
  return Math.max(0, Number.parseInt(raw ?? "0", 10) || 0);
}

function opsErrorStatus(message: string): number {
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "privileged_write_api_key_not_configured") return 503;
  return 500;
}

async function assertDigitizedBooksOpsAccess(
  request: FastifyRequest,
): Promise<{ reviewerUserId: string; via: "session" | "write_key" }> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  if (session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    return { reviewerUserId: session.userId, via: "session" };
  }
  assertPrivilegedWriteAccess(request);
  return { reviewerUserId: "system_write_key", via: "write_key" };
}

async function hasDigitizedBooksOpsSession(request: FastifyRequest): Promise<boolean> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  return Boolean(session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel));
}

function digitizedBooksLoginGate(): string {
  return `
<div style="max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-family:-apple-system,system-ui,sans-serif;">
  <h2 style="margin-top:0;">Digitized books console is restricted</h2>
  <p style="color:#555;font-size:14px;">Log in with an admin or analyst role to review internal digitized-book RAG material.</p>
  <p style="font-size:13px;"><a href="/login?next=${encodeURIComponent("/ops/digitized-books")}">Log in</a></p>
</div>`;
}

export async function registerOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ops/readiness", async () => {
    return getReadinessSnapshot();
  });

  app.get("/ops/digitized-books/data", async (request, reply) => {
    try {
      await assertDigitizedBooksOpsAccess(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "forbidden";
      reply.code(opsErrorStatus(message));
      return { ok: false, error: message };
    }

    const query = request.query as BooksQuery;
    const limit = parseLimit(query.limit, 100);
    const offset = parseOffset(query.offset);
    const bookId = (query.bookId ?? "").trim();

    reply.type("application/json; charset=utf-8");

    if (!bookId) {
      const books = await readDigitizedBooksCatalog(query.q ?? "", limit);
      return {
        ok: true,
        query: (query.q ?? "").trim(),
        count: books.length,
        books,
      };
    }

    const detail = await readDigitizedBookDetail(bookId, limit, offset);
    if (!detail.book && !detail.manifest) {
      reply.code(404);
      return {
        ok: false,
        error: "book_not_found",
      };
    }

    return {
      ok: true,
      book: detail.book ?? emptyCatalogEntry(bookId, detail.manifest?.title),
      manifest: detail.manifest ?? {
        bookId,
        title: detail.book?.title ?? bookId,
        pageCount: detail.book?.pageCount ?? 0,
        pages: [],
      },
      offset,
      limit,
    };
  });

  app.get("/ops/digitized-books/rag-data", async (request, reply) => {
    try {
      await assertDigitizedBooksOpsAccess(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "forbidden";
      reply.code(opsErrorStatus(message));
      return { ok: false, error: message };
    }

    const query = request.query as RagQuery;
    const limit = parseLimit(query.limit, 40);
    const offset = parseOffset(query.offset);
    const type = query.type === "continuity_chain" || query.type === "page_anchor" ? query.type : "all";

    reply.type("application/json; charset=utf-8");

    const payload = await searchDigitizedRag({
      q: query.q ?? "",
      bookId: query.bookId ?? "",
      type,
      limit,
      offset,
    });

    return {
      ok: true,
      ...payload,
      offset,
      limit,
    };
  });

  app.post("/ops/digitized-books/rag-answer", async (request, reply) => {
    try {
      await assertDigitizedBooksOpsAccess(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "forbidden";
      reply.code(opsErrorStatus(message));
      return { ok: false, error: message };
    }

    const body = (request.body ?? {}) as RagAnswerBody;
    const question = (body.question ?? "").trim();
    if (!question) {
      reply.code(400);
      return {
        ok: false,
        error: "question_required",
      };
    }

    reply.type("application/json; charset=utf-8");
    const payload = await answerDigitizedRag({
      question,
      bookId: (body.bookId ?? "").trim() || undefined,
      type: body.type === "continuity_chain" || body.type === "page_anchor" ? body.type : "all",
    });
    return payload;
  });

  app.get("/ops/digitized-books", async (request, reply) => {
    if (!(await hasDigitizedBooksOpsSession(request))) {
      reply.code(403).type("text/html; charset=utf-8");
      return digitizedBooksLoginGate();
    }

    const basePath = getForwardedBasePath(request.headers);
    const currentPath = withBasePath(basePath, String(request.raw.url ?? request.url ?? "/ops/digitized-books"));
    const lang = detectLangFromUrl(String(request.raw.url ?? request.url ?? "/ops/digitized-books")) as SiteLang;
    const title = "Digitized Books Console";
    const dataHref = withBasePath(basePath, "/ops/digitized-books/data");
    const ragHref = withBasePath(basePath, "/ops/digitized-books/rag-data");

    const body = `
      <section class="section digitized-console">
        <div class="digitized-toolbar">
          <div>
            <div class="eyebrow">staging only</div>
            <h2>Digitized books index</h2>
            <p class="meta">Raw scans stay outside the web root. This console reviews catalog entries, page manifests, and continuity-aware RAG units for internal retrieval only.</p>
          </div>
          <div class="digitized-actions">
            <input id="digitized-search" class="digitized-search" type="search" placeholder="Search title or folder" />
            <button id="digitized-reload" class="btn btn-solid" type="button">Reload</button>
          </div>
        </div>

        <div class="digitized-grid">
          <div class="card digitized-list-card">
            <div class="digitized-stats">
              <strong id="digitized-book-count">0 books</strong>
              <span id="digitized-page-count">0 pages</span>
            </div>
            <div id="digitized-book-list" class="digitized-book-list"></div>
          </div>
          <div class="card digitized-detail-card">
            <div id="digitized-empty" class="digitized-empty">Select a book to review its manifest.</div>
            <div id="digitized-detail" hidden>
              <div class="eyebrow">review panel</div>
              <h2 id="digitized-title">Digitized book</h2>
              <p id="digitized-meta" class="meta"></p>
              <div id="digitized-policy" class="digitized-policy"></div>
              <div id="digitized-rag-status" class="digitized-rag-status">RAG pilot status not loaded yet.</div>
              <div class="digitized-table-wrap">
                <table class="digitized-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Page</th>
                      <th>File</th>
                    </tr>
                  </thead>
                  <tbody id="digitized-pages"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="card digitized-rag-shell">
          <div class="digitized-rag-toolbar">
            <div>
              <div class="eyebrow">continuity-aware rag</div>
              <h2>RAG pilot retrieval review</h2>
              <p class="meta">Search continuity chains and page anchors generated from Gemini extraction. Output remains internal-only and summary-first.</p>
            </div>
          </div>
          <div class="digitized-rag-controls">
            <input id="rag-search" class="digitized-search" type="search" placeholder="Search summary, taxon, keyword, article" />
            <select id="rag-type" class="digitized-select">
              <option value="all">All Units</option>
              <option value="continuity_chain">Continuity Chains</option>
              <option value="page_anchor">Page Anchors</option>
            </select>
            <label class="digitized-toggle">
              <input id="rag-scope" type="checkbox" checked />
              Selected book only
            </label>
            <button id="rag-refresh" class="btn btn-solid" type="button">Search</button>
          </div>
          <div class="digitized-stats digitized-rag-meta">
            <strong id="rag-result-count">0 results</strong>
            <span id="rag-book-stats">No RAG pilot manifest loaded.</span>
          </div>
          <div class="digitized-rag-grid">
            <div id="rag-result-list" class="digitized-rag-list"></div>
            <div class="digitized-rag-preview">
              <div id="rag-empty" class="digitized-empty">No RAG result selected yet.</div>
              <div id="rag-detail" hidden>
                <div class="eyebrow" id="rag-detail-eyebrow">continuity chain</div>
                <h2 id="rag-title">RAG result</h2>
                <p id="rag-meta" class="meta"></p>
                <p id="rag-summary" class="digitized-rag-summary"></p>
                <div>
                  <div class="eyebrow">facts</div>
                  <ul id="rag-facts" class="digitized-rag-listing"></ul>
                </div>
                <div>
                  <div class="eyebrow">keywords</div>
                  <div id="rag-keywords" class="digitized-chip-row"></div>
                </div>
                <div>
                  <div class="eyebrow">taxa</div>
                  <div id="rag-taxa" class="digitized-chip-row"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="digitized-answer-shell">
            <div class="digitized-rag-toolbar">
              <div>
                <div class="eyebrow">rag answer</div>
                <h2>AI answer with required citations</h2>
                <p class="meta">The answer must cite continuity chains or page anchors. This is an internal review tool, not a public output surface.</p>
              </div>
            </div>
            <div class="digitized-answer-controls">
              <textarea id="rag-question" class="digitized-question" rows="3" placeholder="Ask a question about the selected book or all pilot books. Example: What does this book observe about diving beetle care?"></textarea>
              <button id="rag-answer-run" class="btn btn-solid" type="button">Answer with citations</button>
            </div>
            <div id="rag-answer-status" class="digitized-rag-status">No question submitted yet.</div>
            <div id="rag-answer-empty" class="digitized-empty">Ask a question to generate a citation-backed answer.</div>
            <div id="rag-answer-detail" class="digitized-rag-preview" hidden>
              <div class="eyebrow" id="rag-answer-provider">gemini</div>
              <h2 id="rag-answer-title">Answer</h2>
              <p id="rag-answer-meta" class="meta"></p>
              <p id="rag-answer-text" class="digitized-rag-summary"></p>
              <div>
                <div class="eyebrow">notes</div>
                <ul id="rag-answer-notes" class="digitized-rag-listing"></ul>
              </div>
              <div>
                <div class="eyebrow">citations used</div>
                <div id="rag-answer-citations" class="digitized-rag-list"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title,
      lang,
      currentPath,
      activeNav: "Learn",
      hero: {
        eyebrow: "staging operations",
        heading: "Digitized books review console",
        lead: "Review the staging catalog for digitized books without exposing raw scans. Internal retrieval can use continuity-aware RAG units; public output stays at summary, citation, and factual metadata.",
        tone: "light",
        align: "left",
      },
      extraStyles: `
        .digitized-console { display:grid; gap:24px; }
        .digitized-toolbar,
        .digitized-rag-toolbar { display:flex; gap:16px; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; }
        .digitized-actions,
        .digitized-rag-controls { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
        .digitized-search,
        .digitized-select {
          min-width:220px;
          border:1px solid rgba(15,23,42,.12);
          border-radius:999px;
          padding:12px 16px;
          font:inherit;
          background:#fff;
        }
        .digitized-select { min-width:180px; }
        .digitized-toggle {
          display:inline-flex;
          gap:8px;
          align-items:center;
          padding:10px 14px;
          border-radius:999px;
          background:#fff;
          border:1px solid rgba(15,23,42,.08);
          color:#334155;
          font-size:14px;
          font-weight:700;
        }
        .digitized-grid { display:grid; grid-template-columns:minmax(280px, 360px) minmax(0, 1fr); gap:20px; }
        .digitized-list-card, .digitized-detail-card, .digitized-rag-shell { padding:20px; }
        .digitized-book-list,
        .digitized-rag-list { display:grid; gap:12px; margin-top:16px; }
        .digitized-book-item,
        .digitized-rag-item {
          width:100%;
          text-align:left;
          border:1px solid rgba(15,23,42,.08);
          border-radius:18px;
          background:#fff;
          padding:14px 16px;
          cursor:pointer;
        }
        .digitized-book-item.is-active,
        .digitized-rag-item.is-active {
          border-color:#0f766e;
          box-shadow:0 0 0 2px rgba(15,118,110,.12);
          background:linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%);
        }
        .digitized-book-item strong,
        .digitized-rag-item strong { display:block; margin-bottom:4px; }
        .digitized-book-item .meta,
        .digitized-rag-item .meta { font-size:13px; }
        .digitized-stats { display:flex; gap:12px; color:#475569; font-size:14px; align-items:center; flex-wrap:wrap; }
        .digitized-empty { color:#64748b; min-height:220px; display:grid; place-items:center; text-align:center; }
        .digitized-policy,
        .digitized-rag-status {
          margin-top:16px;
          padding:14px 16px;
          border-radius:16px;
          background:#f8fafc;
          color:#334155;
          font-size:14px;
          line-height:1.6;
        }
        .digitized-rag-status {
          background:linear-gradient(180deg, rgba(14,165,233,.06), rgba(16,185,129,.06));
          border:1px solid rgba(14,165,233,.08);
        }
        .digitized-table-wrap { margin-top:18px; overflow:auto; }
        .digitized-table { width:100%; border-collapse:collapse; font-size:14px; }
        .digitized-table th, .digitized-table td { text-align:left; padding:10px 12px; border-bottom:1px solid rgba(15,23,42,.08); vertical-align:top; }
        .digitized-table th { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#64748b; }
        .digitized-rag-grid { display:grid; grid-template-columns:minmax(320px, 420px) minmax(0, 1fr); gap:20px; margin-top:18px; }
        .digitized-answer-shell { margin-top:24px; display:grid; gap:16px; }
        .digitized-answer-controls { display:grid; gap:12px; margin-top:8px; }
        .digitized-question {
          width:100%;
          padding:14px 16px;
          border-radius:20px;
          border:1px solid rgba(15,23,42,.12);
          background:#fff;
          color:#0f172a;
          font:inherit;
          resize:vertical;
          min-height:96px;
        }
        .digitized-rag-preview {
          min-height:320px;
          padding:20px;
          border-radius:22px;
          background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
          border:1px solid rgba(15,23,42,.08);
        }
        .digitized-rag-summary { color:#334155; line-height:1.8; }
        .digitized-rag-listing { margin:8px 0 0; padding-left:18px; color:#334155; display:grid; gap:8px; }
        .digitized-chip-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .digitized-chip {
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:7px 12px;
          border-radius:999px;
          background:rgba(15,118,110,.08);
          color:#0f766e;
          border:1px solid rgba(15,118,110,.10);
          font-size:12px;
          font-weight:700;
        }
        .digitized-chip.is-inferred {
          background:rgba(245,158,11,.10);
          color:#b45309;
          border-color:rgba(245,158,11,.18);
        }
        @media (max-width: 980px) {
          .digitized-grid,
          .digitized-rag-grid { grid-template-columns:1fr; }
        }
        @media (max-width: 880px) {
          .digitized-search,
          .digitized-select { min-width:0; width:100%; }
        }
      `,
      body: `${body}
      <script type="module">
        const dataHref = ${JSON.stringify(dataHref)};
        const ragHref = ${JSON.stringify(ragHref)};
        const state = {
          books: [],
          selectedBookId: "",
          ragResults: [],
          selectedRagId: "",
          ragBook: null,
        };

        const listNode = document.querySelector("#digitized-book-list");
        const bookCountNode = document.querySelector("#digitized-book-count");
        const pageCountNode = document.querySelector("#digitized-page-count");
        const detailNode = document.querySelector("#digitized-detail");
        const emptyNode = document.querySelector("#digitized-empty");
        const titleNode = document.querySelector("#digitized-title");
        const metaNode = document.querySelector("#digitized-meta");
        const policyNode = document.querySelector("#digitized-policy");
        const ragStatusNode = document.querySelector("#digitized-rag-status");
        const pagesNode = document.querySelector("#digitized-pages");
        const searchNode = document.querySelector("#digitized-search");
        const reloadNode = document.querySelector("#digitized-reload");

        const ragSearchNode = document.querySelector("#rag-search");
        const ragTypeNode = document.querySelector("#rag-type");
        const ragScopeNode = document.querySelector("#rag-scope");
        const ragRefreshNode = document.querySelector("#rag-refresh");
        const ragResultCountNode = document.querySelector("#rag-result-count");
        const ragBookStatsNode = document.querySelector("#rag-book-stats");
        const ragResultListNode = document.querySelector("#rag-result-list");
        const ragEmptyNode = document.querySelector("#rag-empty");
        const ragDetailNode = document.querySelector("#rag-detail");
        const ragEyebrowNode = document.querySelector("#rag-detail-eyebrow");
        const ragTitleNode = document.querySelector("#rag-title");
        const ragMetaNode = document.querySelector("#rag-meta");
        const ragSummaryNode = document.querySelector("#rag-summary");
        const ragFactsNode = document.querySelector("#rag-facts");
        const ragKeywordsNode = document.querySelector("#rag-keywords");
        const ragTaxaNode = document.querySelector("#rag-taxa");
        const ragQuestionNode = document.querySelector("#rag-question");
        const ragAnswerRunNode = document.querySelector("#rag-answer-run");
        const ragAnswerStatusNode = document.querySelector("#rag-answer-status");
        const ragAnswerEmptyNode = document.querySelector("#rag-answer-empty");
        const ragAnswerDetailNode = document.querySelector("#rag-answer-detail");
        const ragAnswerProviderNode = document.querySelector("#rag-answer-provider");
        const ragAnswerTitleNode = document.querySelector("#rag-answer-title");
        const ragAnswerMetaNode = document.querySelector("#rag-answer-meta");
        const ragAnswerTextNode = document.querySelector("#rag-answer-text");
        const ragAnswerNotesNode = document.querySelector("#rag-answer-notes");
        const ragAnswerCitationsNode = document.querySelector("#rag-answer-citations");

        function escapeHtml(value) {
          return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          }[char] ?? char));
        }

        function formatRange(start, end) {
          return start === end ? "p" + start : "p" + start + "-" + end;
        }

        function formatTokenUsage(book) {
          if (!book || !book.usage) {
            return "No RAG pilot manifest loaded.";
          }
          return [
            "schema=" + (book.schemaVersion ?? "unknown"),
            "chains=" + Number(book.chainCount ?? 0).toLocaleString("en-US"),
            "units=" + Number(book.retrievalUnitCount ?? 0).toLocaleString("en-US"),
            "tokens=" + Number(book.usage.totalTokenCount ?? 0).toLocaleString("en-US")
          ].join(" / ");
        }

        function formatCitationMeta(citation) {
          const pages = formatRange(Number(citation.pageStart ?? 0), Number(citation.pageEnd ?? 0));
          return [
            citation.bookTitle,
            pages,
            citation.type === "continuity_chain" ? "chain" : "anchor",
            citation.articleId ? "article=" + citation.articleId : ""
          ].filter(Boolean).join(" / ");
        }

        async function loadCatalog() {
          const query = searchNode.value.trim();
          const response = await fetch(query ? dataHref + "?q=" + encodeURIComponent(query) : dataHref, {
            credentials: "same-origin"
          });
          const payload = await response.json();
          state.books = Array.isArray(payload.books) ? payload.books : [];
          if (!state.selectedBookId && state.books.length > 0) {
            state.selectedBookId = state.books[0].id;
          }
          if (state.selectedBookId && !state.books.some((book) => book.id === state.selectedBookId)) {
            state.selectedBookId = state.books.length > 0 ? state.books[0].id : "";
          }
          renderList();
          if (state.selectedBookId) {
            await loadBook(state.selectedBookId);
          } else {
            detailNode.hidden = true;
            emptyNode.hidden = false;
            emptyNode.textContent = "No digitized books are loaded into staging yet.";
            await loadRag();
          }
        }

        function renderList() {
          const totalPages = state.books.reduce((sum, book) => sum + Number(book.pageCount ?? 0), 0);
          bookCountNode.textContent = state.books.length + " books";
          pageCountNode.textContent = totalPages.toLocaleString("en-US") + " pages";
          if (state.books.length === 0) {
            listNode.innerHTML = '<div class="meta">No catalog entries found.</div>';
            return;
          }
          listNode.innerHTML = state.books.map((book) => \`
            <button class="digitized-book-item \${book.id === state.selectedBookId ? "is-active" : ""}" data-book-id="\${escapeHtml(book.id)}" type="button">
              <strong>\${escapeHtml(book.title)}</strong>
              <div class="meta">\${escapeHtml(book.folderName)} · \${Number(book.pageCount ?? 0).toLocaleString("en-US")} pages</div>
            </button>
          \`).join("");
          for (const node of listNode.querySelectorAll("[data-book-id]")) {
            node.addEventListener("click", async () => {
              state.selectedBookId = node.getAttribute("data-book-id") ?? "";
              renderList();
              await loadBook(state.selectedBookId);
            });
          }
        }

        async function loadBook(bookId) {
          const response = await fetch(dataHref + "?bookId=" + encodeURIComponent(bookId) + "&limit=40", {
            credentials: "same-origin"
          });
          const payload = await response.json();
          if (!payload.ok) {
            detailNode.hidden = true;
            emptyNode.hidden = false;
            emptyNode.textContent = "Failed to load book manifest.";
            return;
          }
          const book = payload.book ?? {};
          const manifest = payload.manifest ?? { pages: [], pageCount: 0 };
          emptyNode.hidden = true;
          detailNode.hidden = false;
          titleNode.textContent = book.title ?? manifest.title ?? bookId;
          metaNode.textContent = "bookId=" + (book.id ?? manifest.bookId ?? bookId) + " / folder=" + (book.folderName ?? "-") + " / pages=" + Number(manifest.pageCount ?? book.pageCount ?? 0).toLocaleString("en-US");
          const policy = book.usagePolicy ?? {};
          policyNode.textContent = [
            "visibility=" + (book.visibility ?? policy.visibility ?? "internal_only"),
            "public_output=" + (book.publicUsage ?? policy.publicOutput ?? "citation_and_summary_only"),
            "raw_scan=" + (policy.rawScanHandling ?? "do_not_publish"),
            policy.note ?? ""
          ].filter(Boolean).join(" / ");
          const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
          pagesNode.innerHTML = pages.map((page) => \`
            <tr>
              <td>\${escapeHtml(page.pageIndex)}</td>
              <td>\${escapeHtml(page.pageNumber)}</td>
              <td>\${escapeHtml(page.filename)}</td>
            </tr>
          \`).join("");
          ragStatusNode.textContent = "Loading RAG pilot summary...";
          await loadRag();
        }

        async function loadRag() {
          const params = new URLSearchParams();
          const query = ragSearchNode.value.trim();
          if (query) {
            params.set("q", query);
          }
          const selectedOnly = Boolean(ragScopeNode.checked);
          if (selectedOnly && state.selectedBookId) {
            params.set("bookId", state.selectedBookId);
          }
          const type = ragTypeNode.value;
          if (type && type !== "all") {
            params.set("type", type);
          }
          params.set("limit", query ? "80" : "40");

          const response = await fetch(ragHref + "?" + params.toString(), {
            credentials: "same-origin"
          });
          const payload = await response.json();
          state.ragResults = Array.isArray(payload.results) ? payload.results : [];
          state.ragBook = payload.book ?? null;
          if (!state.selectedRagId || !state.ragResults.some((result) => result.resultId === state.selectedRagId)) {
            state.selectedRagId = state.ragResults[0]?.resultId ?? "";
          }
          renderRagMeta(payload);
          renderRagList();
          renderRagDetail();
        }

        function renderRagMeta(payload) {
          ragResultCountNode.textContent = Number(payload.total ?? state.ragResults.length).toLocaleString("en-US") + " results";
          const scopeText = ragScopeNode.checked && state.selectedBookId ? "selected book" : Number(payload.booksWithRag ?? 0).toLocaleString("en-US") + " pilot books";
          ragBookStatsNode.textContent = state.ragBook ? formatTokenUsage(state.ragBook) : scopeText;
          if (state.selectedBookId) {
            if (state.ragBook) {
              ragStatusNode.textContent = "RAG pilot ready / " + formatTokenUsage(state.ragBook);
            } else {
              ragStatusNode.textContent = "No continuity-aware RAG pilot manifest for the selected book yet.";
            }
          } else {
            ragStatusNode.textContent = "Select a book to inspect manifest and RAG coverage together.";
          }
        }

        function renderRagList() {
          if (state.ragResults.length === 0) {
            ragResultListNode.innerHTML = '<div class="meta">No RAG results matched this scope.</div>';
            return;
          }
          ragResultListNode.innerHTML = state.ragResults.map((result) => {
            const eyebrow = [
              result.bookTitle,
              formatRange(Number(result.pageStart ?? 0), Number(result.pageEnd ?? 0)),
              result.type === "continuity_chain" ? "chain" : "anchor"
            ].filter(Boolean).join(" / ");
            const keywordChips = Array.isArray(result.keywords)
              ? result.keywords.slice(0, 4).map((keyword) => \`<span class="digitized-chip">\${escapeHtml(keyword)}</span>\`).join("")
              : "";
            return \`
              <button class="digitized-rag-item \${result.resultId === state.selectedRagId ? "is-active" : ""}" data-rag-id="\${escapeHtml(result.resultId)}" type="button">
                <div class="eyebrow">\${escapeHtml(eyebrow)}</div>
                <strong>\${escapeHtml(result.title ?? "(untitled)")}</strong>
                <div class="meta">\${escapeHtml(String(result.summary ?? "").slice(0, 180))}</div>
                <div class="digitized-chip-row">\${keywordChips}</div>
              </button>
            \`;
          }).join("");
          for (const node of ragResultListNode.querySelectorAll("[data-rag-id]")) {
            node.addEventListener("click", () => {
              state.selectedRagId = node.getAttribute("data-rag-id") ?? "";
              renderRagList();
              renderRagDetail();
            });
          }
        }

        function renderRagDetail() {
          const result = state.ragResults.find((item) => item.resultId === state.selectedRagId) ?? null;
          if (!result) {
            ragDetailNode.hidden = true;
            ragEmptyNode.hidden = false;
            ragEmptyNode.textContent = "No RAG result selected yet.";
            return;
          }

          ragDetailNode.hidden = false;
          ragEmptyNode.hidden = true;
          ragEyebrowNode.textContent = result.type === "continuity_chain" ? "continuity chain" : "page anchor";
          ragTitleNode.textContent = result.title ?? "(untitled)";
          ragMetaNode.textContent = [
            result.bookTitle,
            formatRange(Number(result.pageStart ?? 0), Number(result.pageEnd ?? 0)),
            result.articleId ? "article=" + result.articleId : "",
            result.anchorPage ? "anchor=" + result.anchorPage : ""
          ].filter(Boolean).join(" / ");
          ragSummaryNode.textContent = result.summary ?? "";
          const facts = Array.isArray(result.facts) ? result.facts : [];
          ragFactsNode.innerHTML = facts.length > 0
            ? facts.map((fact) => \`<li>\${escapeHtml(fact)}</li>\`).join("")
            : '<li class="meta">No structured facts extracted for this unit.</li>';
          const keywords = Array.isArray(result.keywords) ? result.keywords : [];
          ragKeywordsNode.innerHTML = keywords.length > 0
            ? keywords.map((keyword) => \`<span class="digitized-chip">\${escapeHtml(keyword)}</span>\`).join("")
            : '<span class="meta">No keywords</span>';
          const taxa = Array.isArray(result.taxa) ? result.taxa : [];
          ragTaxaNode.innerHTML = taxa.length > 0
            ? taxa.map((taxon) => {
                const label = [taxon.japaneseName, taxon.scientificName].filter(Boolean).join(" / ") || taxon.group || "taxon";
                const suffix = taxon.mentionType === "inferred" ? " inferred" : "";
                return \`<span class="digitized-chip\${suffix ? " is-inferred" : ""}">\${escapeHtml(label)}\${suffix ? ' · inferred' : ''}</span>\`;
              }).join("")
            : '<span class="meta">No taxa</span>';
        }

        async function askRagQuestion() {
          const question = ragQuestionNode.value.trim();
          if (!question) {
            ragAnswerStatusNode.textContent = "Question is required.";
            return;
          }

          ragAnswerStatusNode.textContent = "Generating citation-backed answer...";
          ragAnswerDetailNode.hidden = true;
          ragAnswerEmptyNode.hidden = false;
          ragAnswerEmptyNode.textContent = "Working...";

          const payload = {
            question,
            bookId: ragScopeNode.checked ? state.selectedBookId : "",
            type: ragTypeNode.value,
          };

          const response = await fetch(${JSON.stringify(withBasePath(basePath, "/ops/digitized-books/rag-answer"))}, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
          });
          const answer = await response.json();
          if (!response.ok || !answer.ok) {
            ragAnswerStatusNode.textContent = "Failed to generate answer.";
            ragAnswerEmptyNode.hidden = false;
            ragAnswerEmptyNode.textContent = "Question failed. Check retrieval scope or try again.";
            ragAnswerDetailNode.hidden = true;
            return;
          }

          ragAnswerStatusNode.textContent = "Answer ready.";
          ragAnswerEmptyNode.hidden = true;
          ragAnswerDetailNode.hidden = false;
          ragAnswerProviderNode.textContent = answer.provider + " / " + (answer.model ?? "unknown");
          ragAnswerTitleNode.textContent = "Answer";
          ragAnswerMetaNode.textContent = [
            "confidence=" + (answer.confidence ?? "medium"),
            ragScopeNode.checked && state.selectedBookId ? "selected book" : "all pilot books",
            "citations=" + Number((answer.citations ?? []).length).toLocaleString("en-US")
          ].join(" / ");
          ragAnswerTextNode.textContent = answer.answer ?? "";
          const notes = Array.isArray(answer.notes) ? answer.notes : [];
          ragAnswerNotesNode.innerHTML = notes.length > 0
            ? notes.map((note) => \`<li>\${escapeHtml(note)}</li>\`).join("")
            : '<li class="meta">No extra notes.</li>';
          const citations = Array.isArray(answer.citations) ? answer.citations : [];
          ragAnswerCitationsNode.innerHTML = citations.length > 0
            ? citations.map((citation) => \`
                <div class="digitized-rag-item">
                  <div class="eyebrow">\${escapeHtml(citation.citationId)}</div>
                  <strong>\${escapeHtml(citation.title ?? citation.bookTitle)}</strong>
                  <div class="meta">\${escapeHtml(formatCitationMeta(citation))}</div>
                  <div class="meta">\${escapeHtml(citation.summary ?? "")}</div>
                </div>
              \`).join("")
            : '<div class="meta">No citations returned.</div>';
        }

        let catalogTimer = null;
        searchNode.addEventListener("input", () => {
          window.clearTimeout(catalogTimer);
          catalogTimer = window.setTimeout(() => { void loadCatalog(); }, 180);
        });
        reloadNode.addEventListener("click", () => { void loadCatalog(); });

        let ragTimer = null;
        ragSearchNode.addEventListener("input", () => {
          window.clearTimeout(ragTimer);
          ragTimer = window.setTimeout(() => { void loadRag(); }, 180);
        });
        ragTypeNode.addEventListener("change", () => { void loadRag(); });
        ragScopeNode.addEventListener("change", () => { void loadRag(); });
        ragRefreshNode.addEventListener("click", () => { void loadRag(); });
        ragAnswerRunNode.addEventListener("click", () => { void askRagQuestion(); });

        void loadCatalog();
      </script>`,
      footerNote: "Staging-only console. Raw scans remain internal-only.",
    });
  });
}
