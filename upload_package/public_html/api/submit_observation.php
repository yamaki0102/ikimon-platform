<?php
// Emergency alias for observation submissions.
// On the current shared host, the original post_observation.php path can return
// a poisoned 500 at the reverse-proxy layer even when PHP itself is healthy.
require __DIR__ . '/post_observation.php';
