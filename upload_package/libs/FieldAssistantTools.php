<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/OmoikaneDB.php';
require_once __DIR__ . '/OmoikaneSearchEngine.php';
require_once __DIR__ . '/OmoikaneInferenceEnhancer.php';
require_once __DIR__ . '/RedListManager.php';
require_once __DIR__ . '/DataStore.php';

class FieldAssistantTools
{
    private OmoikaneSearchEngine $searchEngine;
    private OmoikaneInferenceEnhancer $inferenceEnhancer;
    private RedListManager $redListManager;

    public function __construct()
    {
        $db = new OmoikaneDB();
        $this->searchEngine = new OmoikaneSearchEngine($db);
        $this->inferenceEnhancer = new OmoikaneInferenceEnhancer($db);
        $this->redListManager = new RedListManager();
    }

    public static function getToolDeclarations(): array
    {
        return [
            [
                'name' => 'lookup_species',
                'description' => '種の詳細情報を図鑑DBから検索する。生息地、形態的特徴、季節性、類似種との違いを返す',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'query' => ['type' => 'STRING', 'description' => '和名または学名'],
                    ],
                    'required' => ['query'],
                ],
            ],
            [
                'name' => 'check_conservation_status',
                'description' => '種の保全状況(レッドリスト)を確認する(国+都道府県)',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'species_name' => ['type' => 'STRING', 'description' => '和名'],
                    ],
                    'required' => ['species_name'],
                ],
            ],
            [
                'name' => 'get_session_detections',
                'description' => '今日のBioScanセッションで検出された種一覧を返す',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [],
                ],
            ],
            [
                'name' => 'save_voice_note',
                'description' => 'ユーザーの口頭メモを観察ノートとして記録する',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'note' => ['type' => 'STRING', 'description' => 'メモ内容'],
                    ],
                    'required' => ['note'],
                ],
            ],
        ];
    }

    public function executeTool(string $toolName, array $args, array $sessionContext = []): array
    {
        return match ($toolName) {
            'lookup_species' => $this->lookupSpecies($args['query'] ?? ''),
            'check_conservation_status' => $this->checkConservationStatus($args['species_name'] ?? ''),
            'get_session_detections' => $this->getSessionDetections($sessionContext),
            'save_voice_note' => $this->saveVoiceNote($args['note'] ?? '', $sessionContext),
            default => ['error' => 'Unknown tool: ' . $toolName],
        };
    }

    private function lookupSpecies(string $query): array
    {
        if (empty(trim($query))) {
            return ['error' => 'query is empty'];
        }

        $result = $this->searchEngine->getTraitsByScientificName($query);

        if (!$result) {
            $results = $this->searchEngine->search(['keyword' => $query], 3);
            if (!empty($results)) {
                $result = $results[0];
            }
        }

        if (!$result) {
            return ['found' => false, 'message' => "{$query} は図鑑に見つかりませんでした"];
        }

        return [
            'found' => true,
            'scientific_name' => $result['scientific_name'] ?? '',
            'habitat' => $result['habitat'] ?? '',
            'altitude' => $result['altitude'] ?? '',
            'season' => $result['season'] ?? '',
            'notes' => $result['notes'] ?? '',
            'morphological_traits' => $result['morphological_traits'] ?? '',
            'similar_species' => $result['similar_species'] ?? '',
            'key_differences' => $result['key_differences'] ?? '',
        ];
    }

    private function checkConservationStatus(string $speciesName): array
    {
        if (empty(trim($speciesName))) {
            return ['error' => 'species_name is empty'];
        }

        $result = $this->redListManager->lookup($speciesName);

        if (!$result) {
            return ['listed' => false, 'message' => "{$speciesName} はレッドリストに掲載されていません"];
        }

        $summary = [];
        if (isset($result['national'])) {
            $summary['national'] = [
                'category' => $result['national']['category'] ?? '',
                'category_ja' => $result['national']['category_ja'] ?? '',
            ];
        }
        foreach ($result as $key => $val) {
            if ($key !== 'national' && is_array($val) && isset($val['category'])) {
                $summary[$key] = [
                    'category' => $val['category'] ?? '',
                    'category_ja' => $val['category_ja'] ?? '',
                ];
            }
        }

        return ['listed' => true, 'status' => $summary];
    }

    private function getSessionDetections(array $sessionContext): array
    {
        $detections = $sessionContext['recent_detections'] ?? [];

        if (empty($detections)) {
            return ['count' => 0, 'species' => [], 'message' => 'まだ種は検出されていません'];
        }

        return [
            'count' => count($detections),
            'species' => array_slice($detections, 0, 20),
        ];
    }

    private function saveVoiceNote(string $note, array $sessionContext): array
    {
        if (empty(trim($note))) {
            return ['error' => 'note is empty'];
        }

        $entry = [
            'id' => 'vnote-' . bin2hex(random_bytes(4)),
            'type' => 'voice_note',
            'note' => $note,
            'timestamp' => date('c'),
            'lat' => $sessionContext['lat'] ?? null,
            'lng' => $sessionContext['lng'] ?? null,
            'session_id' => $sessionContext['session_id'] ?? null,
        ];

        $userId = $sessionContext['user_id'] ?? 'anonymous';
        $file = 'voice_notes/' . $userId;

        $existing = DataStore::get($file);
        if (!is_array($existing)) {
            $existing = ['notes' => []];
        }
        $existing['notes'][] = $entry;

        if (count($existing['notes']) > 500) {
            $existing['notes'] = array_slice($existing['notes'], -500);
        }

        DataStore::save($file, $existing);

        return ['saved' => true, 'id' => $entry['id']];
    }
}
