<?php

/**
 * distill_review.php
 * Admin interface to review and approve Gemini-distilled ecological constraints and identification keys.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

session_start();
// Replace with actual admin logic
// if (!isset($_SESSION['is_admin'])) die("Unauthorized");

$distilledStore = 'library/distilled_knowledge';
$distilledData = DataStore::get($distilledStore, 0) ?: [];

// Handle actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $doi = $_POST['doi'] ?? '';
    $action = $_POST['action'] ?? '';

    if (isset($distilledData[$doi])) {
        if ($action === 'approve') {
            $distilledData[$doi]['review_status'] = 'approved';
        } elseif ($action === 'reject') {
            $distilledData[$doi]['review_status'] = 'rejected';
        }
        DataStore::save($distilledStore, $distilledData);
        header("Location: distill_review.php?msg=Success");
        exit;
    }
}

$pendingReviews = array_filter($distilledData, function ($item) {
    return isset($item['review_status']) && $item['review_status'] === 'pending';
});

?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <title>Review Distilled Papers</title>
    <style>
        body {
            font-family: sans-serif;
            padding: 20px;
            background: #f4f4f4;
        }

        .card {
            background: #fff;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .card h3 {
            margin-top: 0;
        }

        pre {
            background: #eee;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }

        .actions button {
            padding: 10px 15px;
            border: none;
            cursor: pointer;
            border-radius: 4px;
            font-weight: bold;
        }

        .btn-approve {
            background: #4caf50;
            color: white;
        }

        .btn-reject {
            background: #f44336;
            color: white;
        }
    </style>
</head>

<body>

    <h1>Human-in-the-Loop: Review Distilled Knowledge</h1>
    <p>Pending Reviews: <?= count($pendingReviews) ?></p>

    <?php if (isset($_GET['msg'])): ?>
        <p style="color: green; font-weight: bold;"><?= htmlspecialchars($_GET['msg']) ?></p>
    <?php endif; ?>

    <?php foreach ($pendingReviews as $doi => $item): ?>
        <div class="card">
            <h3>DOI: <?= htmlspecialchars($doi) ?></h3>
            <p><strong>Distilled At:</strong> <?= $item['distilled_at'] ?></p>

            <h4>Ecological Constraints</h4>
            <pre><?= json_encode($item['data']['ecological_constraints'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?></pre>

            <h4>Identification Keys</h4>
            <pre><?= json_encode($item['data']['identification_keys'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?></pre>

            <form method="post" class="actions">
                <input type="hidden" name="doi" value="<?= htmlspecialchars($doi) ?>">
                <button type="submit" name="action" value="approve" class="btn-approve">Approve</button>
                <button type="submit" name="action" value="reject" class="btn-reject">Reject / Delete</button>
            </form>
        </div>
    <?php endforeach; ?>

    <?php if (empty($pendingReviews)): ?>
        <p>No pending knowledge extractions left to review. Good job!</p>
    <?php endif; ?>

</body>

</html>