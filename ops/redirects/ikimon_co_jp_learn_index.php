<?php
declare(strict_types=1);

$target = 'https://ikimon.life/ja/learn';
header('Location: ' . $target, true, 301);
header('X-Redirect-By: ikimon.life-migration');
exit;
