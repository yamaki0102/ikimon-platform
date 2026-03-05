# Codex CLI プロンプト集 — ikimon.life

すべて `suggest` モードで安全に実行可能。
リポジトリルートで実行すること。

---

## 1. セキュリティ総合監査

```bash
codex --approval-mode suggest "
Perform a security audit on all PHP files in upload_package/public_html/ and upload_package/libs/.

Check for:
1. SQL injection (even though we use JSON storage, check any exec/eval/shell patterns)
2. XSS: Find any echo/print that outputs user input without htmlspecialchars()
3. CSRF: Find forms or state-changing API endpoints missing CSRF token validation
4. Path traversal: Check file operations that use user-supplied paths
5. Open redirect: Check header('Location:') using unvalidated user input
6. Insecure file upload: Check post.php and any file handling for MIME bypass
7. Information disclosure: Check error_reporting, var_dump, print_r left in production code
8. Session fixation: Check session handling in Auth.php
9. Dev endpoints: List all dev_*.php files and assess their exposure risk

Output format: a markdown table with columns [Severity | File:Line | Issue | Recommendation]
Sort by severity (Critical > High > Medium > Low).
"
```

## 2. フロントエンド品質チェック

```bash
codex --approval-mode suggest "
Audit frontend code quality across all PHP files in upload_package/public_html/.

Check:
1. Alpine.js issues:
   - x-data objects referencing undefined methods or properties
   - x-on handlers calling functions not defined in x-data scope
   - Missing x-cloak on elements that flash unstyled content
2. Tailwind CSS issues:
   - Conflicting utility classes on same element (e.g. both p-4 and p-6)
   - Missing responsive prefixes where needed for mobile (< 640px)
   - Hardcoded colors/sizes instead of design tokens (bg-base, text-text, etc.)
3. HTML issues:
   - Missing alt on <img> tags
   - Missing <label> for form inputs
   - Incorrect heading hierarchy (h1 > h2 > h3)
   - Missing <main> landmark element
4. Accessibility (a11y):
   - Touch targets smaller than 44x44px
   - Low color contrast text
   - Missing aria-labels on icon-only buttons
5. Pages missing pt-14 on body or pb-20 on main content (header/footer overlap)

Output as a checklist grouped by file, with specific line numbers.
"
```

## 3. JavaScript バグ探索

```bash
codex --approval-mode suggest "
Find JavaScript and Alpine.js bugs in these files:
- upload_package/public_html/id_workbench.php
- upload_package/public_html/observation_detail.php
- upload_package/public_html/index.php
- upload_package/public_html/explore.php
- upload_package/public_html/post.php
- upload_package/public_html/dashboard.php
- upload_package/public_html/profile.php

Look for:
1. fetch() calls without .catch() or try/catch error handling
2. DOM references that may be null (getElementById on elements that don't exist)
3. Alpine.js x-data with async init() that can race condition
4. localStorage/sessionStorage usage without try/catch
5. Event listeners added in loops without cleanup (memory leaks)
6. Template literals or string concatenation that could break with special chars
7. Comparison bugs: == instead of === where type matters
8. Infinite loops or recursive calls without termination
9. Variables used before declaration in Alpine.js scope

For each bug found, show: file, line number, the problematic code, and a fix suggestion.
"
```

## 4. API エンドポイント監査

```bash
codex --approval-mode suggest "
Review all API endpoints in upload_package/public_html/api/.

For each endpoint file, check:
1. Does it validate the HTTP method (POST vs GET)?
2. Does it validate and sanitize all input parameters?
3. Does it check authentication where needed?
4. Does it have CSRF protection for state-changing operations?
5. Does it have rate limiting for sensitive operations?
6. Does it return proper HTTP status codes?
7. Does it handle errors gracefully (no stack traces to client)?
8. Are there any dev_*.php files that should not be in production?

Create a table:
[Endpoint | Method | Auth Required | CSRF | Input Validation | Issues Found]

Also list any endpoints that seem unused or orphaned (not referenced from any frontend page).
"
```

## 5. コード品質・デッドコード

```bash
codex --approval-mode suggest "
Analyze code quality in upload_package/ directory.

Find:
1. Dead code: Functions/methods never called from anywhere
2. Unused PHP files that are never included/required
3. Duplicate logic: Similar code blocks in multiple files that should be extracted
4. Overly complex functions (cyclomatic complexity > 10)
5. PHP files missing strict_types declaration
6. Magic numbers or hardcoded strings that should be constants
7. TODO/FIXME/HACK comments left in code
8. Inconsistent error handling patterns (some throw, some return false, some die())
9. Files over 500 lines that should be split

Output: prioritized list with file:line references.
Focus on upload_package/libs/ and upload_package/public_html/ (skip vendor/).
"
```

## 6. パフォーマンス分析

```bash
codex --approval-mode suggest "
Analyze upload_package/ for performance bottlenecks.

Check:
1. JSON file reads: DataStore calls inside loops (N+1 pattern)
2. Images: Missing loading='lazy', missing width/height attributes
3. Large inline JavaScript that should be external and deferred
4. Alpine.js: Excessive watchers or x-effect that trigger too often
5. CSS: Unused Tailwind utilities bloating page size (though CDN, check for conflicts)
6. API endpoints that read entire data files when only one record is needed
7. Missing HTTP caching headers for static assets
8. Synchronous external API calls (GBIF, Nominatim) blocking page render
9. PHP: require_once in hot paths that could be moved to top-level

For each issue: file, line, estimated impact (High/Medium/Low), and fix suggestion.
"
```

## 7. デザイン一貫性チェック

```bash
codex --approval-mode suggest "
Check design consistency across all pages in upload_package/public_html/*.php.

Verify:
1. All pages include meta.php in <head>
2. All pages include nav.php for bottom navigation
3. All pages have <main> element with proper padding (pt-14 pb-20)
4. All pages use bg-base and text-text on body (not hardcoded colors)
5. All buttons use btn-primary or consistent Tailwind button styles
6. All cards use bg-surface, rounded-2xl, border border-border consistently
7. Heading sizes follow a consistent scale across pages
8. All pages have a proper <title> tag with ' | ikimon' suffix
9. Footer is consistent across pages (same links, same structure)
10. Mobile bottom nav doesn't overlap content on any page

Create a compliance matrix: rows = pages, columns = checks, cells = ✅/❌.
"
```

## 8. 全チェック一括実行（要約レポート）

```bash
codex --approval-mode suggest "
Perform a comprehensive code review of the ikimon.life codebase.
Focus on upload_package/public_html/ and upload_package/libs/.

Produce a prioritized report with these sections:

## Critical (must fix before next deploy)
- Security vulnerabilities
- Data loss risks
- Broken user-facing features

## High (fix soon)
- Accessibility failures
- Performance bottlenecks
- Inconsistent UI/UX

## Medium (improve when possible)
- Code quality issues
- Missing error handling
- Design inconsistencies

## Low (nice to have)
- Code style improvements
- Minor optimizations
- Documentation gaps

For each item: one-line description, file:line, and suggested fix.
Keep the total report under 200 lines.
"
```

---

## 使い方

```bash
# リポジトリルートに移動
cd C:/Users/YAMAKI/AppData/Local/Temp/ikimon-platform-push

# まず全体レポート (#8) を実行
codex --approval-mode suggest "..."

# 気になった分野を個別チェック (#1-#7)
codex --approval-mode suggest "..."

# 修正が必要なら auto-edit モードで
codex --approval-mode auto-edit "Fix the XSS vulnerability in observation_detail.php line 142 by adding htmlspecialchars() to the echo statement."
```
