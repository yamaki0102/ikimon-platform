<?php
/**
 * Affiliate Admin API — 書籍 CRUD + 統計
 *
 * GET  ?action=stats           → クリック統計
 * GET  ?action=stats&month=... → 月指定統計
 * POST action=save_book        → 書籍追加/更新
 * POST action=delete_book      → 書籍削除
 * POST action=save_mapping     → マッピング追加/更新
 * POST action=delete_mapping   → マッピング削除
 */
require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/CSRF.php';
require_once __DIR__ . '/../../../libs/AffiliateManager.php';

Auth::init();
Auth::requireRole('Admin');

header('Content-Type: application/json; charset=utf-8');

$booksFile    = DATA_DIR . '/affiliate/books.json';
$mappingsFile = DATA_DIR . '/affiliate/mappings.json';

function loadJson(string $file): array {
    if (!file_exists($file)) return [];
    return json_decode(file_get_contents($file), true) ?: [];
}
function saveJson(string $file, array $data): void {
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

// GET requests
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'stats') {
        $month = $_GET['month'] ?? date('Y-m');
        echo json_encode(AffiliateManager::getClickStats($month));
        exit;
    }

    if ($action === 'books') {
        $books = loadJson($booksFile);
        unset($books['_meta']);
        echo json_encode($books);
        exit;
    }

    if ($action === 'mappings') {
        $mappings = loadJson($mappingsFile);
        unset($mappings['_meta']);
        echo json_encode($mappings);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

// POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $input['action'] ?? '';

    if (!CSRF::validate($input['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token']);
        exit;
    }

    if ($action === 'save_book') {
        $id    = trim($input['id'] ?? '');
        $book  = $input['book'] ?? [];
        if (!$id || !$book) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id or book data']);
            exit;
        }
        $books = loadJson($booksFile);
        $books[$id] = array_merge($books[$id] ?? [], $book);
        saveJson($booksFile, $books);
        echo json_encode(['ok' => true, 'id' => $id]);
        exit;
    }

    if ($action === 'delete_book') {
        $id = trim($input['id'] ?? '');
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            exit;
        }
        $books = loadJson($booksFile);
        unset($books[$id]);
        saveJson($booksFile, $books);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'save_mapping') {
        $level = trim($input['level'] ?? '');
        $key   = trim($input['key'] ?? '');
        $entry = $input['entry'] ?? [];
        if (!$level || !$entry) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing level or entry']);
            exit;
        }
        $mappings = loadJson($mappingsFile);
        if ($level === '_general') {
            $mappings['_general'] = $entry;
        } else {
            if (!$key) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing key']);
                exit;
            }
            $mappings[$level][$key] = $entry;
        }
        saveJson($mappingsFile, $mappings);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'delete_mapping') {
        $level = trim($input['level'] ?? '');
        $key   = trim($input['key'] ?? '');
        if (!$level || !$key) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing level or key']);
            exit;
        }
        $mappings = loadJson($mappingsFile);
        unset($mappings[$level][$key]);
        saveJson($mappingsFile, $mappings);
        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}
