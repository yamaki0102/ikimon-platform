from pathlib import Path

CURRENT = Path("platform_v2/cloudflare_shadow/src")
SOURCE = Path(".tmp-worker-authz-source")


def section(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[start_index:end_index]


runtime_path = CURRENT / "index.ts"
source_runtime_path = SOURCE / "index.ts"
runtime = runtime_path.read_text(encoding="utf-8")
source_runtime = source_runtime_path.read_text(encoding="utf-8")

preferences_start = "async function getPlaceMemoryPreferencesNative"
preferences_end = "async function upsertPlaceMemoryForObservationNative"
runtime = runtime.replace(
    section(runtime, preferences_start, preferences_end),
    section(source_runtime, preferences_start, preferences_end),
    1,
)

place_memory_start = "async function handlePlaceMemoryRuntime"
place_memory_end = "function isSafeFieldId"
runtime = runtime.replace(
    section(runtime, place_memory_start, place_memory_end),
    section(source_runtime, place_memory_start, place_memory_end),
    1,
)

owner_guard = '''  const requestedObservationId = normalizeOptionalId(input.observationId);
  if (requestedObservationId) {
    const existingObservation = await env.OBS_DB.prepare(
      "SELECT owner_user_id FROM observations WHERE observation_id = ?"
    ).bind(requestedObservationId).first<{ owner_user_id: string }>();
    if (existingObservation && existingObservation.owner_user_id !== input.userId) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
  }

'''
idempotency_marker = "  const clientSubmissionId = normalizeCompatibleClientSubmissionId(input.clientSubmissionId);\n"
if "const requestedObservationId = normalizeOptionalId(input.observationId);" not in runtime:
    if idempotency_marker not in runtime:
        raise RuntimeError("observation idempotency marker not found")
    runtime = runtime.replace(idempotency_marker, owner_guard + idempotency_marker, 1)

runtime_path.write_text(runtime, encoding="utf-8")

current_test_path = CURRENT / "index.test.ts"
source_test_path = SOURCE / "index.test.ts"
test_source = current_test_path.read_text(encoding="utf-8")
source_test = source_test_path.read_text(encoding="utf-8")

preferences_case = '''    if (normalized.startsWith("SELECT user_id, default_photo_echo_enabled, default_tags_public")) {
      return (this.db.placeMemoryPreferences.get(string(v[0])) as T | undefined) ?? null;
    }

'''
access_case = '''    if (normalized.startsWith("SELECT EXISTS( SELECT 1 FROM place_memory_entries")) {
      const userId = string(v[0]);
      const cellId = string(v[1]);
      const hasAccess = [...this.db.placeMemoryEntries.values()].some((row) =>
        row.user_id === userId && row.cell_id === cellId && !row.deleted_at
      );
      return ({ has_access: hasAccess ? 1 : 0 } as T);
    }

'''
if access_case not in test_source:
    if preferences_case not in test_source:
        raise RuntimeError("place memory preference test handler not found")
    test_source = test_source.replace(preferences_case, preferences_case + access_case, 1)

report_count_case = '''    if (normalized.startsWith("SELECT COUNT(*) AS count FROM place_memory_reports")) {
      const count = this.db.placeMemoryReports.filter((row) => row.entry_id === string(v[0])).length;
      return ({ count } as T);
    }

'''
report_query_cases = '''    if (normalized.startsWith("SELECT COUNT(DISTINCT user_id) AS count FROM place_memory_reports")) {
      const count = new Set(this.db.placeMemoryReports.filter((row) => row.entry_id === string(v[0])).map((row) => row.user_id)).size;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT report_id FROM place_memory_reports")) {
      const row = this.db.placeMemoryReports.find((candidate) => candidate.entry_id === string(v[0]) && candidate.user_id === string(v[1]));
      return row ? ({ report_id: row.report_id } as T) : null;
    }

'''
if "SELECT COUNT(DISTINCT user_id) AS count FROM place_memory_reports" not in test_source:
    if report_count_case not in test_source:
        raise RuntimeError("place memory report count test handler not found")
    test_source = test_source.replace(report_count_case, report_query_cases + report_count_case, 1)

place_memory_test_start = 'test("place memory runtime stores D1 entries and serves preferences list and moderation actions"'
place_memory_test_end = 'test("v1 observation upsert persists civic context only for event, risk, or explicit context writes"'
test_source = test_source.replace(
    section(test_source, place_memory_test_start, place_memory_test_end),
    section(source_test, place_memory_test_start, place_memory_test_end),
    1,
)

idor_test_start = 'test("production observation upsert cannot take over another user\'s observation or place memory"'
idor_test_end = 'test("production runtime honors private visibility before public readmodel refresh"'
if idor_test_start not in test_source:
    idor_test = section(source_test, idor_test_start, idor_test_end)
    if idor_test_end not in test_source:
        raise RuntimeError("production visibility test marker not found")
    test_source = test_source.replace(idor_test_end, idor_test + idor_test_end, 1)

current_test_path.write_text(test_source, encoding="utf-8")

contract_source = (SOURCE / "workerAuthzContract.test.ts").read_text(encoding="utf-8")
(CURRENT / "workerAuthzContract.test.ts").write_text(contract_source, encoding="utf-8")
