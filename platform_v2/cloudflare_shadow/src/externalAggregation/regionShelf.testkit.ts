export function seedExt(sqlite: any, opts: { n?: number } = {}) {
  sqlite.prepare("INSERT INTO admin_units (code,level,parent_code,name_ja,boundary_version) VALUES ('22130','city',NULL,'浜松市','t')").run();
  sqlite.prepare("INSERT INTO admin_units (code,level,parent_code,name_ja,boundary_version) VALUES ('22131','ward','22130','中央区','t')").run();
  sqlite.prepare("INSERT INTO ext_places (place_id,name,admin_unit_id,city_unit_id,created_at) VALUES ('p1','市民会館','22131','22130','x')").run();
  sqlite.prepare("INSERT INTO ext_orgs (org_id,org_type,display_name,created_at,updated_at) VALUES ('o1','city','浜松市みどり課','x','x')").run();
  sqlite.prepare("INSERT INTO ext_sources (source_id,name,listing_url,method,enabled) VALUES ('S1','浜松市オープンデータ（イベント情報）','https://x/','csv',1)").run();
  const ev = (id: string, title: string, starts: string, o: { status?: string; source?: boolean; city?: string } = {}) => {
    sqlite.prepare("INSERT INTO ext_events (event_id,org_id,place_id,title,starts_at,status,city_unit_id,updated_at) VALUES (?,?,?,?,?,?,?,'x')").run(id, "o1", "p1", title, starts, o.status ?? "active", o.city ?? "22130");
    if (o.source !== false) {
      sqlite.prepare("INSERT INTO ext_source_records (record_id,source_id,external_ref,url,kind,raw_json,content_hash,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)").run(`r-${id}`, "S1", id, `https://x/${id}`, "event", "{}", "h", "2026-11-20", "2026-11-27T01:00:00Z");
      sqlite.prepare("INSERT INTO ext_item_sources (item_kind,item_id,record_id,role) VALUES ('event',?,?,'official')").run(id, `r-${id}`);
    }
  };
  ev("e-ok", "自然観察会", "2026-12-05T10:00:00+09:00");
  ev("e-nosrc", "出典なし行事", "2026-12-06T10:00:00+09:00", { source: false });
  ev("e-past", "過去の行事", "2026-11-20T10:00:00+09:00");
  ev("e-hidden", "非表示", "2026-12-07T10:00:00+09:00", { status: "hidden" });
  ev("e-other", "他市の行事", "2026-12-08T10:00:00+09:00", { city: "22100" });
  for (let i = 0; i < (opts.n ?? 0); i++) ev(`e-x${i}`, `追加${i}`, `2026-12-1${i}T10:00:00+09:00`);
}

