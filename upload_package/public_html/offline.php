<?php
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/CspNonce.php';
Lang::init();
$meta_title = __('offline.title');
?>
<!DOCTYPE html>
<html lang="<?php echo Lang::get('meta_lang', 'ja'); ?>">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', sans-serif;
            background: #f8faf8;
            color: #1e293b;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 2rem;
        }

        .container {
            max-width: 400px;
        }

        .icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 2rem;
            background: rgba(250, 204, 21, 0.15);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .icon svg {
            width: 40px;
            height: 40px;
            color: #facc15;
        }

        h1 {
            font-size: 1.75rem;
            margin-bottom: 1rem;
        }

        p {
            color: #64748b;
            margin-bottom: 2rem;
            line-height: 1.6;
        }

        .btn {
            display: inline-block;
            padding: 1rem 2rem;
            background: #10b981;
            color: white;
            font-weight: 700;
            border-radius: 1rem;
            text-decoration: none;
            cursor: pointer;
            border: none;
            font-size: 1rem;
        }

        .btn:hover {
            background: #059669;
        }

        .tips {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #e2e8f0;
        }

        .tips h3 {
            font-size: 0.875rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
        }

        .tips ul {
            list-style: none;
            text-align: left;
            font-size: 0.875rem;
            color: #64748b;
        }

        .tips li {
            padding: 0.5rem 0;
            padding-left: 1.5rem;
            position: relative;
        }

        .tips li::before {
            content: "→";
            position: absolute;
            left: 0;
            color: #10b981;
        }
    </style>
</head>

<body class="bg-base text-text font-body">
    <div class="container">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
        </div>

        <h1><?php echo __('offline.title'); ?></h1>
        <p>
            <?php echo __('offline.message'); ?>
        </p>

        <button class="btn" onclick="location.reload()">
            <?php echo __('offline.reload'); ?>
        </button>

        <div class="tips">
            <h3><?php echo __('offline.tips_title'); ?></h3>
            <ul>
                <li><?php echo __('offline.tip_1'); ?></li>
                <li><?php echo __('offline.tip_2'); ?></li>
                <li><?php echo __('offline.tip_3'); ?></li>
            </ul>
        </div>
    </div>


    <script nonce="<?= CspNonce::attr() ?>">
        // Auto-retry when online
        window.addEventListener('online', () => {
            location.reload();
        });
    </script>
</body>

</html>