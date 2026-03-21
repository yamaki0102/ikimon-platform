<?php

/**
 * DwcExportAdapter — Canonical Schema → Darwin Core Archive エクスポート
 *
 * Canonical Schema (SQLite 5層) のデータを GBIF 準拠の DwC-A 形式にエクスポートする。
 * デフォルトでは Evidence Tier 2 以上のみ公開。
 *
 * ADR-001, ADR-002 準拠。100年耐久フィールド対応。
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/CanonicalStore.php';

class DwcExportAdapter
{
    /**
     * DwC-A ヘッダー (GBIF Core + 拡張フィールド)
     */
    const DWC_HEADERS = [
        'occurrenceID',
        'basisOfRecord',
        'eventDate',
        'scientificName',
        'taxonRank',
        'taxonConceptID',
        'recordedBy',
        'decimalLatitude',
        'decimalLongitude',
        'geodeticDatum',
        'coordinateUncertaintyInMeters',
        'country',
        'individualCount',
        'samplingProtocol',
        'samplingEffort',
        'identificationVerificationStatus',
        'identifiedBy',
        'dateIdentified',
        'associatedMedia',
        'informationWithheld',
        'license',
        'rightsHolder',
        'dynamicProperties',
    ];

    /**
     * Canonical Schema から DwC-A CSV を生成
     *
     * @param float  $minTier    最低 Evidence Tier (デフォルト 2)
     * @param string $siteId     特定サイトのみ (空=全サイト)
     * @param string $format     'csv' | 'archive'
     * @return string CSV 文字列 or ZIP ファイルパス
     */
    public static function export(float $minTier = 2.0, string $siteId = '', string $format = 'csv'): string
    {
        $pdo = self::getPDO();

        // Tier 以上の occurrence を取得（events と JOIN）
        $sql = "
            SELECT
                o.occurrence_id,
                o.scientific_name,
                o.taxon_rank,
                o.taxon_concept_version,
                o.basis_of_record,
                o.individual_count,
                o.evidence_tier,
                o.data_quality,
                o.observation_source,
                o.detection_model,
                o.confidence_context,
                o.created_at AS occ_created,
                e.event_date,
                e.decimal_latitude,
                e.decimal_longitude,
                e.geodetic_datum,
                e.coordinate_uncertainty_m,
                e.sampling_protocol,
                e.sampling_effort,
                e.recorded_by,
                e.site_id
            FROM occurrences o
            JOIN events e ON o.event_id = e.event_id
            WHERE o.evidence_tier >= :min_tier
        ";
        $params = [':min_tier' => $minTier];

        if ($siteId) {
            $sql .= " AND e.site_id = :site_id";
            $params[':site_id'] = $siteId;
        }

        $sql .= " ORDER BY e.event_date DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 各行を DwC マッピング
        $csvRows = [];
        foreach ($rows as $row) {
            // 最新の identification を取得
            $ids = CanonicalStore::getIdentificationHistory($row['occurrence_id']);
            $currentId = !empty($ids) ? $ids[0] : null;

            // 証拠メディアを取得
            $evidence = CanonicalStore::getEvidenceByOccurrence($row['occurrence_id']);
            $mediaUrls = array_map(fn($ev) => 'https://ikimon.life/' . $ev['media_path'], $evidence);

            // プライバシーチェック（希少種は座標を丸める）
            $lat = $row['decimal_latitude'];
            $lng = $row['decimal_longitude'];
            $withheld = '';

            // PrivacyAccess を確認
            $privacy = self::getPrivacyAccess($row['occurrence_id']);
            if ($privacy && $privacy['coordinate_precision'] !== 'exact') {
                $lat = round($lat, 2);  // ~1km 精度
                $lng = round($lng, 2);
                $withheld = 'Coordinates generalized to protect sensitive species';
            }

            // verification status マッピング
            $verificationStatus = match (true) {
                $row['evidence_tier'] >= 3 => 'verified',
                $row['evidence_tier'] >= 2 => 'reviewed',
                default                    => 'unverified',
            };

            // sampling_protocol のマッピング
            $protocol = match ($row['sampling_protocol'] ?? '') {
                'walk-audio'    => 'Audio transect walk with BirdNET automated classification',
                'live-scan'     => 'Continuous multi-sensor scanning (audio + optional video)',
                'manual-photo'  => 'Manual photographic observation',
                'survey'        => 'Structured biodiversity survey',
                default         => $row['sampling_protocol'] ?? 'Observation',
            };

            // dynamicProperties（ikimon 固有の拡張データ）
            $dynamic = json_encode([
                'evidenceTier'     => $row['evidence_tier'],
                'detectionModel'   => $row['detection_model'],
                'observationSource' => $row['observation_source'],
            ], JSON_UNESCAPED_UNICODE);

            $csvRows[] = [
                $row['occurrence_id'],                          // occurrenceID
                $row['basis_of_record'] ?? 'HumanObservation', // basisOfRecord
                $row['event_date'],                             // eventDate
                $row['scientific_name'],                        // scientificName
                $row['taxon_rank'] ?? 'species',               // taxonRank
                $row['taxon_concept_version'] ?? '',            // taxonConceptID
                $row['recorded_by'] ?? '',                     // recordedBy
                $lat,                                           // decimalLatitude
                $lng,                                           // decimalLongitude
                $row['geodetic_datum'] ?? 'EPSG:4326',         // geodeticDatum
                $row['coordinate_uncertainty_m'] ?? '',         // coordinateUncertaintyInMeters
                'JP',                                           // country
                $row['individual_count'] ?? '',                // individualCount
                $protocol,                                      // samplingProtocol
                $row['sampling_effort'] ?? '',                 // samplingEffort
                $verificationStatus,                           // identificationVerificationStatus
                $currentId ? $currentId['identified_by'] : '', // identifiedBy
                $currentId ? $currentId['created_at'] : '',    // dateIdentified
                implode(' | ', $mediaUrls),                    // associatedMedia
                $withheld,                                      // informationWithheld
                'CC-BY 4.0',                                   // license
                'ikimon.life',                                  // rightsHolder
                $dynamic,                                       // dynamicProperties
            ];
        }

        // CSV 生成
        $output = fopen('php://temp', 'r+');
        fputcsv($output, self::DWC_HEADERS);
        foreach ($csvRows as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        if ($format === 'archive') {
            return self::createArchive($csv, $rows);
        }

        return $csv;
    }

    /**
     * DwC-A ZIP アーカイブを生成
     */
    private static function createArchive(string $csv, array $rows): string
    {
        $tmpDir = sys_get_temp_dir() . '/dwca_' . uniqid();
        mkdir($tmpDir, 0755, true);

        // occurrence.csv
        file_put_contents("{$tmpDir}/occurrence.csv", $csv);

        // meta.xml
        $metaXml = self::generateMetaXml();
        file_put_contents("{$tmpDir}/meta.xml", $metaXml);

        // eml.xml
        $emlXml = self::generateEmlXml(count($rows));
        file_put_contents("{$tmpDir}/eml.xml", $emlXml);

        // ZIP 作成
        $zipPath = sys_get_temp_dir() . '/dwca_' . date('Ymd_His') . '.zip';
        $zip = new ZipArchive();
        $zip->open($zipPath, ZipArchive::CREATE);
        $zip->addFile("{$tmpDir}/occurrence.csv", 'occurrence.csv');
        $zip->addFile("{$tmpDir}/meta.xml", 'meta.xml');
        $zip->addFile("{$tmpDir}/eml.xml", 'eml.xml');
        $zip->close();

        // クリーンアップ
        array_map('unlink', glob("{$tmpDir}/*"));
        rmdir($tmpDir);

        return $zipPath;
    }

    /**
     * meta.xml を生成
     */
    private static function generateMetaXml(): string
    {
        $fields = '';
        foreach (self::DWC_HEADERS as $i => $term) {
            $ns = in_array($term, ['license', 'rightsHolder'])
                ? 'http://purl.org/dc/terms/'
                : 'http://rs.tdwg.org/dwc/terms/';
            $fields .= "      <field index=\"{$i}\" term=\"{$ns}{$term}\"/>\n";
        }

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/"
         metadata="eml.xml">
  <core encoding="UTF-8"
        fieldsTerminatedBy=","
        linesTerminatedBy="\\n"
        fieldsEnclosedBy="&quot;"
        ignoreHeaderLines="1"
        rowType="http://rs.tdwg.org/dwc/terms/Occurrence">
    <files>
      <location>occurrence.csv</location>
    </files>
    <id index="0"/>
{$fields}
  </core>
</archive>
XML;
    }

    /**
     * eml.xml（データセットメタデータ）を生成
     */
    private static function generateEmlXml(int $recordCount): string
    {
        $date = date('Y-m-d');
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="eml://ecoinformatics.org/eml-2.1.1 eml.xsd"
         packageId="ikimon-life-canonical-{$date}" system="ikimon.life">
  <dataset>
    <title>ikimon.life Biodiversity Observations (Canonical Schema Export)</title>
    <creator>
      <organizationName>ikimon.life</organizationName>
      <electronicMailAddress>info@ikimon.life</electronicMailAddress>
    </creator>
    <pubDate>{$date}</pubDate>
    <language>ja</language>
    <abstract>
      <para>
        Citizen science biodiversity observations from ikimon.life platform.
        Includes photo observations, audio walk detections (BirdNET), and live scan data.
        Evidence Tier 2+ records only (community verified or above).
        Records: {$recordCount}
      </para>
    </abstract>
    <intellectualRights>
      <para>Creative Commons Attribution 4.0 International (CC-BY 4.0)</para>
    </intellectualRights>
  </dataset>
</eml:eml>
XML;
    }

    // ─── Internal helpers ───────────────────────────────────────

    private static function getPrivacyAccess(string $occId): ?array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM privacy_access WHERE record_id = :id");
        $stmt->execute([':id' => $occId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private static function getPDO(): PDO
    {
        static $pdo = null;
        if ($pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->exec('PRAGMA journal_mode = WAL');
        }
        return $pdo;
    }
}
