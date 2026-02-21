<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CorporateSites.php';
Auth::init();

$siteId = $_GET['site'] ?? $_GET['id'] ?? 'ikimon_forest';
$site = CorporateSites::SITES[$siteId] ?? CorporateSites::SITES['ikimon_forest'];

// Determine View
$view = $_GET['view'] ?? 'overview';
$allowedViews = ['overview', 'events', 'reports', 'settings', 'map_3d', 'system'];
if (!in_array($view, $allowedViews)) {
    $view = 'overview';
}
$meta_title = ucfirst($view) . ' - ikimon for Business';
$meta_robots = 'noindex, nofollow, noarchive';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <!-- MapLibre -->
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <link rel="stylesheet" href="assets/css/dashboard.css">
    <style>
        /* Inline critical overwrites if necessary */
        body {
            background-color: var(--color-bg-base);
            color: var(--color-text);
            font-family: var(--font-body);
        }
    </style>
</head>

<body x-data="{ sidebarOpen: false }" class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body flex h-screen overflow-hidden relative">

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
    <script nonce="<?= CspNonce::attr() ?>">
        // Initialize Dashboard Components
        // Pass the current view to highlight sidebar
        loadDashboardSidebar('<?php echo "?view=" . $view; ?>'); // Modified logic in dashboard.js to handle param style
        loadDashboardHeader();
    </script>
</body>

</html>