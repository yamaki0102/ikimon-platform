CREATE TABLE IF NOT EXISTS ext_sources (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL, operator TEXT, listing_url TEXT NOT NULL,
  method TEXT NOT NULL,
  terms_status TEXT NOT NULL DEFAULT 'unverified',
  terms_note TEXT, terms_checked_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ext_source_records (
  record_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES ext_sources(source_id),
  external_ref TEXT NOT NULL,
  url TEXT NOT NULL, kind TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, gone_at TEXT,
  UNIQUE (source_id, external_ref)
);
CREATE TABLE IF NOT EXISTS ext_orgs (
  org_id TEXT PRIMARY KEY,
  org_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  identity_level TEXT NOT NULL DEFAULT 'unresolved',
  parent_org_id TEXT REFERENCES ext_orgs(org_id),
  admin_unit_id TEXT,
  merged_into TEXT REFERENCES ext_orgs(org_id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ext_org_keys (
  org_id TEXT NOT NULL REFERENCES ext_orgs(org_id),
  key_type TEXT NOT NULL,
  key_value TEXT NOT NULL,
  source_record_id TEXT,
  PRIMARY KEY (key_type, key_value, org_id)
);
CREATE INDEX IF NOT EXISTS ext_org_keys_lookup ON ext_org_keys(key_type, key_value);
CREATE TABLE IF NOT EXISTS ext_org_merges (
  op_id TEXT PRIMARY KEY, op TEXT NOT NULL,
  from_org_id TEXT NOT NULL, to_org_id TEXT NOT NULL,
  reason TEXT, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ext_places (
  place_id TEXT PRIMARY KEY,
  zukan_place_id TEXT,
  name TEXT NOT NULL, lat REAL, lng REAL,
  admin_unit_id TEXT,
  city_unit_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ext_places_city ON ext_places(city_unit_id);
CREATE TABLE IF NOT EXISTS ext_events (
  event_id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES ext_orgs(org_id), place_id TEXT REFERENCES ext_places(place_id),
  title TEXT NOT NULL, category TEXT,
  starts_at TEXT NOT NULL, ends_at TEXT, all_day INTEGER NOT NULL DEFAULT 0,
  fee_text TEXT, audience TEXT, summary_short TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  city_unit_id TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ext_events_city_time ON ext_events(city_unit_id, starts_at);
CREATE TABLE IF NOT EXISTS ext_jobs (
  job_id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES ext_orgs(org_id), place_id TEXT REFERENCES ext_places(place_id),
  title TEXT NOT NULL, category TEXT NOT NULL,
  employment_type TEXT, pay_text TEXT, deadline_at TEXT,
  deadline_conflict INTEGER NOT NULL DEFAULT 0,
  summary_short TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  city_unit_id TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ext_jobs_city_deadline ON ext_jobs(city_unit_id, deadline_at);
CREATE TABLE IF NOT EXISTS ext_item_sources (
  item_kind TEXT NOT NULL, item_id TEXT NOT NULL,
  record_id TEXT NOT NULL REFERENCES ext_source_records(record_id),
  role TEXT NOT NULL DEFAULT 'listing',
  PRIMARY KEY (item_kind, item_id, record_id)
);
CREATE TABLE IF NOT EXISTS ext_claim_links (
  org_id TEXT PRIMARY KEY REFERENCES ext_orgs(org_id),
  nocosil_org_id TEXT NOT NULL UNIQUE,
  verified_by TEXT NOT NULL,
  linked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ext_fetch_state (
  source_id TEXT PRIMARY KEY REFERENCES ext_sources(source_id),
  last_fetched_at TEXT,
  etag TEXT,
  last_modified TEXT,
  last_status TEXT
);
INSERT OR IGNORE INTO ext_sources (source_id,name,operator,listing_url,method,terms_status,terms_note,enabled) VALUES
('E1','浜松市','浜松市','https://www.city.hamamatsu.shizuoka.jp/','jsonld','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E2','静岡県','静岡県','https://www.pref.shizuoka.jp/','selector','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E3','浜松市文化振興財団','浜松市文化振興財団','https://www.hcf.or.jp/','jsonld','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E4','こくちーずプロ 浜松','こくちーずプロ','https://www.kokuchpro.com/s/q-浜松.rss','rss','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E5','Peatix','Peatix','https://peatix.com/','link_only','blocked','取得しない(規約上不可)',0),
('E6','浜松科学館','浜松科学館','https://www.hamamatsu-sci.jp/','selector','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E7','浜松市動物園','浜松市動物園','https://www.hamamatsu-zoo.jp/','selector','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E8','浜松市美術館','浜松市美術館','https://www.hamamatsu-museum.jp/','selector','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E9','浜松市立図書館','浜松市立図書館','https://www.lib-city-hamamatsu.jp/','selector','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E11','浜松観光コンベンションビューロー','浜松観光コンベンションビューロー','https://www.hamamatsu-daisuki.net/','selector','conditional','事実(題名・日時・場所・主催者)＋リンク＋出典のみ。本文複製しない。robots遵守',0),
('E12','いこーよ','アクトインディ','https://iko-yo.net/','link_only','blocked','取得しない(規約上不可)',0),
('E13','ウォーカープラス','KADOKAWA','https://www.walkerplus.com/','link_only','blocked','取得しない(規約上不可)',0),
('E14','じゃらん','リクルート','https://www.jalan.net/','link_only','blocked','取得しない(規約上不可)',0);
