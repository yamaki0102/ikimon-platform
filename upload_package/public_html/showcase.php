<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CorporateSites.php';
Auth::init();

$siteId = $_GET['id'] ?? 'ikimon_forest';
$site = CorporateSites::SITES[$siteId] ?? CorporateSites::SITES['ikimon_forest'];

// Determine View
$view = $_GET['view'] ?? 'overview';
$allowedViews = ['overview', 'events', 'reports', 'settings', 'map_3d', 'system'];
if (!in_array($view, $allowedViews)) {
    $view = 'overview';
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <title><?php echo ucfirst($view); ?> - ikimon for Business</title>

    <!-- External Libraries -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- Alpine.js -->
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js"></script>
    <!-- MapLibre -->
    <script src="https://unpkg.com/maplibre-gl@^4.7.1/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@^4.7.1/dist/maplibre-gl.css" rel="stylesheet" />

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">

    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/style.css"> 
    <link rel="stylesheet" href="assets/css/dashboard.css">
    
    <style>
        /* Inline critical overwrites if necessary */
        body { background-color: var(--color-bg-base); color: var(--color-text); font-family: var(--font-body); }
    </style>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body flex h-screen overflow-hidden">

    <div id="sidebar-container"></div>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden">
        <div id="dashboard-header-container"></div>

        <!-- Dashboard Content View Loader -->
        <?php
            // Safe include
            $viewPath = __DIR__ . "/views/dashboard_{$view}.php";
            if (file_exists($viewPath)) {
                include $viewPath;
            } else {
                echo '<div class="p-8">View not found.</div>';
            }
        ?>
    </main>
    
    <!-- Common JS -->
    <script src="assets/js/dashboard.js"></script>
    <script>
        // Initialize Dashboard Components
        // Pass the current view to highlight sidebar
        loadDashboardSidebar('<?php echo "?view=" . $view; ?>'); // Modified logic in dashboard.js to handle param style
        loadDashboardHeader();
    </script>
</body>
</html>
