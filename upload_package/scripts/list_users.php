<?php
$data = json_decode(file_get_contents('/home/r1522484/public_html/ikimon.life/data/users.json'), true);
foreach ($data as $u) {
    echo $u['id'] . ' | ' . ($u['name'] ?? '?') . ' | posts:' . ($u['post_count'] ?? 0) . ' | score:' . ($u['score'] ?? 0) . "\n";
}
