<?php
// Backward compatibility: redirect old ranking.php → compass.php
header('Location: compass.php' . ($_SERVER['QUERY_STRING'] ? '?' . $_SERVER['QUERY_STRING'] : ''), true, 301);
exit;
